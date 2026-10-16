import { notFound } from 'next/navigation';
import TemplatePreview from '@/components/TemplatePreview';
import UnpublishedNotice from '@/components/UnpublishedNotice';
import GuestSeat, { type GuestSeatView } from '@/components/GuestSeat';
import { applyGuest, resolveGuest } from '@/lib/guestLink';
import { inviteMetadata, unpublishedMetadata } from '@/lib/inviteMetadata';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ g?: string }>;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getInvite(slug: string) {
  try {
    const res = await fetch(`${API}/api/invites/by-slug/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (res.status === 402) return { unpaid: true }; // сайт есть, но не оплачен
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export default async function InvitePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { g } = await searchParams;
  const invite = await getInvite(slug);

  if (!invite) {
    notFound();
  }
  if (invite.unpaid) return <UnpublishedNotice />;

  // Персональная ссылка ?g=<token>: обращение и имя гостя, а если пара включила — «Ваш стол»
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
      <TemplatePreview data={invite} apiBase={API} fullPage slug={slug} />
      {seat && <GuestSeat view={seat} />}
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const invite = await getInvite(slug);
  if (!invite) return {};
  // Основной адрес сайта — корневой /<slug>: им и представляемся в превью
  if (invite.unpaid) return unpublishedMetadata(`/${slug}`);
  return inviteMetadata(invite, API, `/${slug}`);
}
