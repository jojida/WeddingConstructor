import { Router, Request, Response } from 'express';
import { promises as dns } from 'dns';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hasCustomDomain, isPaid } from '../lib/plans';
import { normalizeDomain, domainVerification, findPublicDomain } from '../lib/domains';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

/** IP нашего сервера — на него клиент направляет A-записи своего домена. */
const SERVER_IP = process.env.SERVER_IP || '89.191.226.237';

// GET /api/domains/check?domain=X — валидатор для Caddy on_demand_tls (ask).
// Caddy спрашивает ПЕРЕД выпуском SSL-сертификата: выдаём 200 только для
// доменов, привязанных к ОПЛАЧЕННОМУ приглашению. Иначе любой желающий мог бы
// направить свой домен на наш IP и жечь лимиты Let's Encrypt.
router.get('/check', async (req: Request, res: Response) => {
  const domain = normalizeDomain(req.query.domain);
  if (!domain) return res.status(400).send('no domain');

  const invite = await findPublicDomain(domain);
  if (!invite) return res.status(404).send('unknown domain');
  return res.status(200).send('ok');
});

// GET /api/domains/status/:inviteId — проверка DNS для владельца:
// куда реально указывают A-записи домена и совпадают ли с нашим сервером.
router.get('/status/:inviteId', authMiddleware, rateLimit(30, 10 * 60_000, req => (req as AuthRequest).userId!), async (req: AuthRequest, res: Response) => {
  const invite = await prisma.invitation.findUnique({ where: { id: req.params.inviteId as string } });
  if (!invite || invite.userId !== req.userId) return res.status(404).json({ error: 'Не найдено' });
  if (!invite.customDomain) return res.status(400).json({ error: 'Домен не указан' });
  if (!hasCustomDomain(invite.plan)) return res.status(403).json({ error: 'Свой домен недоступен на этом тарифе' });

  const domain = normalizeDomain(invite.customDomain);
  if (!domain) return res.status(400).json({ error: 'Неверный формат домена' });
  const verification = domainVerification(invite.id, domain);
  // Bound DNS queries and release their sockets even if a nameserver does not answer.
  const resolver = new dns.Resolver({ timeout: 2500, tries: 1 });
  const resolve = async (host: string): Promise<string[]> => {
    try { return await resolver.resolve4(host); } catch { return []; }
  };
  const txt = async (): Promise<string[]> => {
    try { return (await resolver.resolveTxt(verification.name)).map(parts => parts.join('')); } catch { return []; }
  };
  const [ips, wwwIps, records] = await Promise.all([resolve(domain), resolve(`www.${domain}`), txt()]);
  let verified = !!invite.customDomainVerifiedAt;
  if (!verified && records.includes(verification.value)) {
    try {
      const result = await prisma.invitation.updateMany({
        where: { id: invite.id, customDomain: domain }, data: { customDomainVerifiedAt: new Date() },
      });
      verified = result.count === 1;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') return res.status(409).json({ error: 'Этот домен уже подтверждён для другого сайта' });
      throw error;
    }
  }

  return res.json({
    domain,
    expectedIp: SERVER_IP,
    ips,
    wwwIps,
    dnsOk: ips.includes(SERVER_IP),
    wwwOk: wwwIps.includes(SERVER_IP),
    paid: isPaid(invite.status),
    verification,
    verified,
  });
});

export default router;
