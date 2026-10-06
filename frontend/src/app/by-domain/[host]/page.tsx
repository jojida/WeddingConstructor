import { notFound } from 'next/navigation';
import TemplatePreview from '@/components/TemplatePreview';
import UnpublishedNotice from '@/components/UnpublishedNotice';
import GuestSeat, { type GuestSeatView } from '@/components/GuestSeat';
import { applyGuest, resolveGuest } from '@/lib/guestLink';

interface Props {
  params: Promise<{ host: string }>;
  searchParams: Promise<{ g?: string }>;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getByDomain(host: string) {
  try {
    const res = await fetch(`${API}/api/invites/by-domain/${host}`, { cache: 'no-store' });
    if (res.status === 402) return { unpaid: true }; // сайт есть, но не оплачен
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export default async function DomainInvitePage({ params, searchParams }: Props) {
  const { host } = await params;
  const { g } = await searchParams;
  const invite = await getByDomain(decodeURIComponent(host));
  if (!invite) notFound();
  if (invite.unpaid) return <UnpublishedNotice />;

  let seat: GuestSeatView | null = null;
  if (g) {
    const guest = await resolveGuest(API, g, invite.id);
    if (guest) {
      applyGuest(invite, guest, g);
      seat = guest.planner ?? null;
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <TemplatePreview data={invite} apiBase={API} fullPage slug={invite.slug} />
      {seat && <GuestSeat view={seat} />}
    </div>
  );
}
