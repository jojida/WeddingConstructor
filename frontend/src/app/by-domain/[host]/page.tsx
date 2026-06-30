import { notFound } from 'next/navigation';
import TemplatePreview from '@/components/TemplatePreview';
import { TEMPLATE_GREETING_KEY } from '@/lib/constants';

interface Props {
  params: Promise<{ host: string }>;
  searchParams: Promise<{ g?: string }>;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getByDomain(host: string) {
  try {
    const res = await fetch(`${API}/api/invites/by-domain/${host}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function getGuest(token: string) {
  try {
    const res = await fetch(`${API}/api/guests/resolve/${token}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<{ greeting: string; names: string; attending: boolean | null }>;
  } catch { return null; }
}

export default async function DomainInvitePage({ params, searchParams }: Props) {
  const { host } = await params;
  const { g } = await searchParams;
  const invite = await getByDomain(decodeURIComponent(host));
  if (!invite) notFound();

  if (g) {
    const guest = await getGuest(g);
    if (guest) {
      const greetingKey = TEMPLATE_GREETING_KEY[invite.templateId];
      invite.customData = { ...(invite.customData || {}) };
      if (greetingKey) invite.customData[greetingKey] = guest.greeting;
      invite.customData.guestName = guest.names;
      invite.customData.guestToken = g;
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <TemplatePreview data={invite} apiBase={API} fullPage slug={invite.slug} />
    </div>
  );
}
