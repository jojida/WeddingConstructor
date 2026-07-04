import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { notifyOwner } from '../lib/notify';

const router = Router();

const DRINK_LABELS: Record<string, string> = {
  wine: '🍷 Вино',
  champagne: '🥂 Шампанское',
  juice: '🧃 Сок',
  water: '💧 Вода',
  no_alcohol: '🚫 Без алкоголя',
  other: '🍹 Другое',
};

// POST /api/rsvp/:slug — публичная отправка анкеты гостем
router.post('/:slug', async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  try {
    const invite = await prisma.invitation.findUnique({ where: { slug } });
    if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });
    // Оплата временно отключена: сайт доступен по slug сразу (см. by-slug),
    // поэтому и анкета должна работать для draft — иначе гости видят сайт,
    // но получают «Ошибка» при отправке ответа.

    const { guestName, attending, drinkChoice, wishes, guestToken } = req.body;

    // Персональная ссылка (продвинутый тариф): связываем ответ с гостем.
    let guest = null as Awaited<ReturnType<typeof prisma.guest.findUnique>> | null;
    if (guestToken) {
      guest = await prisma.guest.findUnique({ where: { token: String(guestToken) } });
      if (guest && guest.invitationId !== invite.id) guest = null; // токен от другого приглашения
    }

    const finalName = (guestName && String(guestName).trim()) || (guest ? guest.names : '');
    if (!finalName) return res.status(400).json({ error: 'Укажите ваше имя' });

    const response = await prisma.guestResponse.create({
      data: {
        invitationId: invite.id,
        guestId: guest ? guest.id : null,
        guestName: finalName,
        attending: attending !== false,
        drinkChoice: drinkChoice || '',
        wishes: wishes || '',
      },
    });

    if (guest) {
      await prisma.guest.update({ where: { id: guest.id }, data: { responseId: response.id } });
    }

    // Уведомление владельцу по выбранному каналу (best-effort, не блокирует ответ)
    notifyOwner(invite as any, {
      guestName: finalName,
      attending: attending !== false,
      drinkChoice: drinkChoice || '',
      wishes: wishes || '',
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

  const responses = await prisma.guestResponse.findMany({
    where: { invitationId },
    orderBy: { createdAt: 'desc' },
  });

  const stats = {
    total: responses.length,
    attending: responses.filter(r => r.attending).length,
    notAttending: responses.filter(r => !r.attending).length,
    drinks: responses.reduce((acc, r) => {
      if (r.attending && r.drinkChoice) {
        acc[r.drinkChoice] = (acc[r.drinkChoice] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>),
  };

  return res.json({ responses, stats, drinkLabels: DRINK_LABELS });
});

export default router;
