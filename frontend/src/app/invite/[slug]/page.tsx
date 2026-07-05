import { notFound } from 'next/navigation';
import TemplatePreview from '@/components/TemplatePreview';
import { TEMPLATE_GREETING_KEY } from '@/lib/constants';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ g?: string }>;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getInvite(slug: string) {
  try {
    const res = await fetch(`${API}/api/invites/by-slug/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// Персональная ссылка: ?g=<token> → личное обращение и имя гостя
async function getGuest(token: string) {
  try {
    const res = await fetch(`${API}/api/guests/resolve/${token}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<{ greeting: string; names: string; attending: boolean | null }>;
  } catch { return null; }
}

export default async function InvitePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { g } = await searchParams;
  const invite = await getInvite(slug);

  if (!invite) {
    notFound();
  }

  // Внедряем персональные данные гостя в customData — они дойдут до script.js
  // через существующий postMessage-spread (обёртки шаблонов не меняются).
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
      <TemplatePreview data={invite} apiBase={API} fullPage slug={slug} />
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const invite = await getInvite(slug);
  if (!invite) return {};

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
