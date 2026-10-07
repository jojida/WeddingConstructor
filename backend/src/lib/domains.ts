import crypto from 'crypto';
import { domainToASCII } from 'url';
import prisma from './prisma';
import { jwtSecret } from './security';
import { hasCustomDomain, isPaid } from './plans';

/** Domain names only; URLs from the settings form are accepted for convenience. */
export function normalizeDomain(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  const raw = value.trim();
  if (!raw) return '';
  if (/[\s\\\x00-\x1f]/.test(raw)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || url.search || url.hash || (url.pathname && url.pathname !== '/')) return null;
    const host = domainToASCII(url.hostname).toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    const labels = host.split('.');
    if (host.length > 253 || labels.length < 2 || !/[a-z]/.test(labels[labels.length - 1]) ||
      labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return null;
    return host;
  } catch { return null; }
}

export function domainVerification(inviteId: string, domain: string) {
  const token = crypto.createHmac('sha256', jwtSecret()).update(`domain:${inviteId}:${domain}`).digest('hex');
  return { name: `_weddingcraft.${domain}`, type: 'TXT' as const, value: `weddingcraft-verification=${token}` };
}

export const domainIsPublic = (invite: { status: string; plan: string; customDomainVerifiedAt: Date | null }): boolean =>
  !!invite.customDomainVerifiedAt && isPaid(invite.status) && hasCustomDomain(invite.plan);

/** Shared by domain resolution, TLS issuance and CORS. Never trust a pending binding. */
export async function findPublicDomain(domain: string) {
  const invite = await prisma.invitation.findFirst({ where: {
    customDomain: domain, customDomainVerifiedAt: { not: null }, status: { in: ['paid', 'published'] },
  } });
  return invite && domainIsPublic(invite) ? invite : null;
}
