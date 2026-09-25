import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { notifyOwner } from '../lib/notify';
import { isPaid } from '../lib/plans';
import { inviteDrinkLabels } from '../lib/drinks';
import { rateLimit } from '../middleware/rateLimit';
import { Attendance, attendanceOf, cleanAnswers, isAttendance, parseAnswers, summarizeAnswers } from '../lib/rsvpDetails';

const router = Router();

// POST /api/rsvp/:slug — публичная отправка анкеты гостем
router.post('/:slug', rateLimit(30, 10 * 60_000), async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  try {
    const invite = await prisma.invitation.findUnique({ where: { slug } });
    if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });
    // Сайт (и анкета) доступны гостям только после оплаты — как и by-slug.
    if (!isPaid(invite.status)) {
      return res.status(402).json({ error: 'Сайт ещё не опубликован — анкета заработает после оплаты' });
    }

    const { guestName, attending, attendance, drinkChoice, wishes, guestToken, guestsCount, childrenCount, answers } = req.body;
    // Новые анкеты шлют attendance (yes | no | maybe), старые страницы — только attending
    const status: Attendance | null = attendance != null
      ? (isAttendance(attendance) ? attendance : null)
      : (typeof attending === 'boolean' ? (attending ? 'yes' : 'no') : null);
    const cleanedAnswers = cleanAnswers(answers);
    if (!status || cleanedAnswers === null ||
        (guestName != null && (typeof guestName !== 'string' || guestName.length > 200)) ||
        (drinkChoice != null && (typeof drinkChoice !== 'string' || drinkChoice.length > 500)) ||
        (wishes != null && (typeof wishes !== 'string' || wishes.length > 4000)) ||
        (guestToken != null && (typeof guestToken !== 'string' || guestToken.length > 100)) ||
        (guestsCount != null && !(Number.isInteger(guestsCount) && guestsCount >= 1 && guestsCount <= 20)) ||
        (childrenCount != null && !(Number.isInteger(childrenCount) && childrenCount >= 0 && childrenCount <= 20))) {
      return res.status(400).json({ error: 'Проверьте поля анкеты' });
    }
    // Сколько человек придёт по ответу (у «пока не знаю» — сколько может прийти).
    // Старые страницы шаблонов поля не шлют — тогда один; у отказа не спрашивается.
    const people = status !== 'no' && Number.isInteger(guestsCount) ? guestsCount as number : 1;
    // Дети — часть people; хотя бы один взрослый остаётся всегда
    const children = status !== 'no' && Number.isInteger(childrenCount) ? Math.min(childrenCount as number, people - 1) : 0;

    // Персональная ссылка (продвинутый тариф): связываем ответ с гостем.
    let guest = null as Awaited<ReturnType<typeof prisma.guest.findUnique>> | null;
    if (guestToken) {
      guest = await prisma.guest.findUnique({ where: { token: String(guestToken) } });
      if (guest && guest.invitationId !== invite.id) guest = null; // токен от другого приглашения
      if (!guest) return res.status(400).json({ error: 'Персональная ссылка недействительна' });
    }

    const finalName = (guestName && String(guestName).trim()) || (guest ? guest.names : '');
    if (!finalName) return res.status(400).json({ error: 'Укажите ваше имя' });

    const response = await prisma.$transaction(async tx => {
      // A personal link represents one answer, including after resubmission.
      if (guest) await tx.guestResponse.deleteMany({ where: { invitationId: invite.id, guestId: guest.id } });
      const saved = await tx.guestResponse.create({
      data: {
        invitationId: invite.id,
        guestId: guest ? guest.id : null,
        guestName: finalName,
        attending: status === 'yes',
        attendance: status,
        drinkChoice: drinkChoice || '',
        wishes: wishes || '',
        guestsCount: people,
        childrenCount: children,
        answers: JSON.stringify(cleanedAnswers),
      },
      });
      if (guest) await tx.guest.update({ where: { id: guest.id }, data: { responseId: saved.id } });
      return saved;
    });

    // Уведомление владельцу по выбранному каналу (best-effort, не блокирует ответ)
    notifyOwner(invite as any, {
      guestName: finalName,
      attending: status === 'yes',
      attendance: status,
      drinkChoice: drinkChoice || '',
      wishes: wishes || '',
      guestsCount: people,
      childrenCount: children,
      answers: cleanedAnswers,
    });

    return res.json({ success: true, id: response.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка сохранения ответа' });
  }
});

// GET /api/rsvp/:invitationId — список ответов (только для владельца)
router.get('/:invitationId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invitationId = req.params.invitationId as string;
  const invite = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invite || invite.userId !== req.userId) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  const rows = await prisma.guestResponse.findMany({
    where: { invitationId },
    orderBy: { createdAt: 'desc' },
  });
  // Статус и ответы на вопросы — в готовом виде, кабинету не нужно разбирать JSON
  const responses = rows.map(r => ({ ...r, attendance: attendanceOf(r), answers: parseAnswers(r.answers) }));
  const coming = responses.filter(r => r.attendance === 'yes');
  const maybe = responses.filter(r => r.attendance === 'maybe');

  const stats = {
    total: responses.length,
    attending: coming.length,
    notAttending: responses.filter(r => r.attendance === 'no').length,
    maybe: maybe.length,
    // Людей, а не ответов: «Денис и Мария» одной анкетой — это двое.
    attendingGuests: coming.reduce((sum, r) => sum + (r.guestsCount || 1), 0),
    attendingChildren: coming.reduce((sum, r) => sum + (r.childrenCount || 0), 0),
    maybeGuests: maybe.reduce((sum, r) => sum + (r.guestsCount || 1), 0),
    // Сводка по вопросам с вариантами — среди тех, кто придёт
    answers: summarizeAnswers(coming.map(r => r.answers)),
    // drinkChoice может быть мультивыбором ("sparkling,red") — считаем каждый.
    drinks: responses.reduce((acc, r) => {
      if (r.attendance === 'yes' && r.drinkChoice) {
        for (const choice of String(r.drinkChoice).split(',').map(s => s.trim()).filter(Boolean)) {
          acc[choice] = (acc[choice] || 0) + 1;
        }
      }
      return acc;
    }, Object.create(null) as Record<string, number>),
  };

  return res.json({ responses, stats, drinkLabels: inviteDrinkLabels(invite.customData) });
});

export default router;
