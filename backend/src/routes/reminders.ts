import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { record } from '../lib/inviteValidation';
import { hasGuestReminders } from '../lib/plans';
import { errName } from '../lib/planner/util';
import { TOKEN_RE, answerReminder, isDaysOption, reminderOverview, reminderPage, saveReminderSettings } from '../lib/reminders';

const router = Router();

// ─── Гость: страничка подтверждения /c/<token> (ссылка из SMS) ──────────
router.get('/c/:token', rateLimit(60, 10 * 60_000), async (req: Request, res: Response) => {
  const token = String(req.params.token);
  if (!TOKEN_RE.test(token)) return res.status(404).json({ error: 'Ссылка недействительна' });
  try {
    const page = await reminderPage(token);
    return page ? res.json(page) : res.status(404).json({ error: 'Ссылка недействительна' });
  } catch (e) {
    console.error('Напоминание: не удалось открыть страницу:', errName(e));
    return res.status(500).json({ error: 'Не удалось загрузить' });
  }
});

router.post('/c/:token', rateLimit(20, 10 * 60_000), async (req: Request, res: Response) => {
  const token = String(req.params.token);
  if (!TOKEN_RE.test(token) || !record(req.body)) return res.status(400).json({ error: 'Некорректный ответ' });
  const { answer, guestsCount } = req.body as Record<string, unknown>;
  if ((answer !== 'yes' && answer !== 'no') ||
      (guestsCount != null && !(Number.isInteger(guestsCount) && (guestsCount as number) >= 1 && (guestsCount as number) <= 20))) {
    return res.status(400).json({ error: 'Некорректный ответ' });
  }
  try {
    const result = await answerReminder(token, answer, guestsCount as number | undefined);
    if (!result.ok) {
      return result.error === 'past'
        ? res.status(410).json({ error: 'Свадьба уже прошла' })
        : res.status(404).json({ error: 'Ссылка недействительна' });
    }
    return res.json(result);
  } catch (e) {
    console.error('Напоминание: не удалось сохранить ответ:', errName(e));
    return res.status(500).json({ error: 'Не удалось сохранить ответ' });
  }
});

// ─── Пара: настройки и сводка ───────────────────────────────────────────
async function ownInvite(req: AuthRequest) {
  const invite = await prisma.invitation.findUnique({ where: { id: String(req.params.inviteId) } });
  return invite && invite.userId === req.userId ? invite : null;
}

router.get('/:inviteId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invite = await ownInvite(req);
  if (!invite) return res.status(404).json({ error: 'Не найдено' });
  if (!hasGuestReminders(invite.plan)) return res.status(403).json({ error: 'Напоминания гостям — в тарифе «Максимум»' });
  try {
    return res.json(await reminderOverview(invite));
  } catch (e) {
    console.error('Напоминания: сводка не собрана:', errName(e));
    return res.status(500).json({ error: 'Не удалось загрузить' });
  }
});

router.put('/:inviteId', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!record(req.body)) return res.status(400).json({ error: 'Некорректные настройки' });
  const invite = await ownInvite(req);
  if (!invite) return res.status(404).json({ error: 'Не найдено' });
  if (!hasGuestReminders(invite.plan)) return res.status(403).json({ error: 'Напоминания гостям — в тарифе «Максимум»' });
  const { enabled, days } = req.body as Record<string, unknown>;
  if (typeof enabled !== 'boolean' || !isDaysOption(days)) return res.status(400).json({ error: 'Некорректные настройки' });
  try {
    await saveReminderSettings(invite.id, enabled, days);
    return res.json(await reminderOverview(invite));
  } catch (e) {
    console.error('Напоминания: настройки не сохранены:', errName(e));
    return res.status(500).json({ error: 'Не удалось сохранить' });
  }
});

export default router;
