import { notFound } from 'next/navigation';
import TemplatePreview from '@/components/TemplatePreview';
import UnpublishedNotice from '@/components/UnpublishedNotice';
import GuestSeat, { type GuestSeatView } from '@/components/GuestSeat';
import { applyGuest, resolveGuest } from '@/lib/guestLink';

/* Корневой адрес сайта-приглашения: weddingcraft.ru/<slug>.
   Зеркалит /invite/[slug] — статические маршруты (editor, demo, templates,
   dashboard, auth, payment, invite, by-domain) имеют приоритет над этим
   динамическим сегментом, поэтому сюда попадают только пользовательские slug. */

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ g?: string }>;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getInvite(slug: string) {
  try {
    const res = await fetch(`${API}/api/invites/by-slug/${slug}`, { cache: 'no-store' });
    if (res.status === 402) return { unpaid: true }; // сайт есть, но не оплачен
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export default async function SiteBySlugPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { g } = await searchParams;
  const invite = await getInvite(slug);

  if (!invite) {
    notFound();
  }
  if (invite.unpaid) return <UnpublishedNotice />;

  // Персональная ссылка: обращение и имя гостя, а если пара включила — «Ваш стол»
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
  if (invite.unpaid) {
    return { title: 'Сайт ещё не опубликован', robots: { index: false, follow: false } };
  }

  const title = invite.groomName && invite.brideName
    ? `Свадьба ${invite.groomName} & ${invite.brideName}`
    : 'Свадебное приглашение';

  // Загруженные фото живут на бэкенде (/uploads/…), ассеты шаблонов — в public
  // фронтенда (резолвятся через metadataBase), внешние URL остаются как есть.
  const ogImage = !invite.coverPhoto ? undefined
    : invite.coverPhoto.startsWith('http') ? invite.coverPhoto
    : invite.coverPhoto.startsWith('/uploads') ? `${API}${invite.coverPhoto}`
    : invite.coverPhoto;

  return {
    title,
    description: invite.inviteText || `Вас приглашают на свадьбу! ${invite.weddingDate ? new Date(invite.weddingDate).toLocaleDateString('ru-RU') : ''}`,
    // Личные страницы пар не должны индексироваться поисковиками.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      images: ogImage ? [ogImage] : [],
    },
  };
}
