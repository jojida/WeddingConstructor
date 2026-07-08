import { Router, Request, Response } from 'express';
import { promises as dns } from 'dns';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isPaid } from '../lib/plans';

const router = Router();

/** IP нашего сервера — на него клиент направляет A-записи своего домена. */
const SERVER_IP = process.env.SERVER_IP || '89.191.226.237';

/** Нормализация домена: без порта, протокола, слэшей и www, в нижнем регистре. */
function normalizeDomain(raw: string): string {
  return String(raw || '')
    .trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^www\./, '');
}

// GET /api/domains/check?domain=X — валидатор для Caddy on_demand_tls (ask).
// Caddy спрашивает ПЕРЕД выпуском SSL-сертификата: выдаём 200 только для
// доменов, привязанных к ОПЛАЧЕННОМУ приглашению. Иначе любой желающий мог бы
// направить свой домен на наш IP и жечь лимиты Let's Encrypt.
router.get('/check', async (req: Request, res: Response) => {
  const domain = normalizeDomain(String(req.query.domain || ''));
  if (!domain) return res.status(400).send('no domain');

  const invite = await prisma.invitation.findFirst({ where: { customDomain: domain } });
  if (!invite || !isPaid(invite.status)) return res.status(404).send('unknown domain');
  return res.status(200).send('ok');
});

// GET /api/domains/status/:inviteId — проверка DNS для владельца:
// куда реально указывают A-записи домена и совпадают ли с нашим сервером.
router.get('/status/:inviteId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invite = await prisma.invitation.findUnique({ where: { id: req.params.inviteId as string } });
  if (!invite || invite.userId !== req.userId) return res.status(404).json({ error: 'Не найдено' });
  if (!invite.customDomain) return res.status(400).json({ error: 'Домен не указан' });

  const domain = invite.customDomain;
  const resolve = async (host: string): Promise<string[]> => {
    try { return await dns.resolve4(host); } catch { return []; }
  };
  const [ips, wwwIps] = await Promise.all([resolve(domain), resolve(`www.${domain}`)]);

  return res.json({
    domain,
    expectedIp: SERVER_IP,
    ips,
    wwwIps,
    dnsOk: ips.includes(SERVER_IP),
    wwwOk: wwwIps.includes(SERVER_IP),
    paid: isPaid(invite.status),
  });
});

export default router;
