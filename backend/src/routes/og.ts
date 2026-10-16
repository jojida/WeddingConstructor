// GET /api/og/:slug — картинка превью ссылки на опубликованный сайт (lib/ogImage.ts).
// В адресе у страницы есть ?v=<версия содержимого>, поэтому ответ можно кэшировать надолго.
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { isPaid } from '../lib/plans';
import { ogImage } from '../lib/ogImage';
import { errName } from '../lib/planner/util';

const router = Router();

router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const invite = await prisma.invitation.findUnique({
      where: { slug: String(req.params.slug) },
      select: { status: true, groomName: true, brideName: true, weddingDate: true, templateId: true, coverPhoto: true },
    });
    // Черновик не показываем и в превью: сайт открывается гостям только после публикации
    if (!invite || !isPaid(invite.status)) return res.status(404).end();
    const jpg = await ogImage(invite);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.send(jpg);
  } catch (e) {
    console.error('Превью ссылки: картинка не собралась:', errName(e));
    return res.status(500).end();
  }
});

export default router;
