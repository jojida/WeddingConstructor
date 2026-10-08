import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { checkUnsubscribeToken } from '../lib/lifecycleEmails';

const router = Router();

const page = (title: string, text: string) => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f6f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#3a3631;padding:20px">
<div style="max-width:440px;background:#fffdf9;border:1px solid #ece3d4;border-radius:18px;padding:32px 28px;text-align:center">
<div style="font-family:Georgia,serif;font-size:20px;margin-bottom:14px">WeddingCraft</div>
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;margin:0 0 12px">${title}</h1>
<p style="font-size:15px;line-height:1.6;margin:0">${text}</p>
</div></body></html>`;

/* Отписка от серии писем (lib/lifecycleEmails). GET — ссылка из письма,
   POST — «одним нажатием» из почтовика по заголовку List-Unsubscribe-Post.
   Подпись в ссылке — HMAC от id пользователя: чужой адрес отписать нельзя. */
async function unsubscribe(req: Request, res: Response) {
  const userId = String(req.query.u || '');
  const token = String(req.query.t || '');
  if (!userId || !checkUnsubscribeToken(userId, token)) {
    return res.status(400).type('html').send(page('Ссылка устарела', 'Не удалось распознать ссылку. Напишите нам на support@weddingcraft.ru — отпишем вручную.'));
  }
  await prisma.user.updateMany({ where: { id: userId }, data: { emailOptOut: true } });
  return res.type('html').send(page('Вы отписались', 'Больше не будем присылать советы и напоминания. Уведомления об ответах гостей продолжат приходить, если они подключены.'));
}

router.get('/unsubscribe', unsubscribe);
router.post('/unsubscribe', unsubscribe);

export default router;
