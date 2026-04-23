import { notFound } from 'next/navigation';
import TemplatePreview from '@/components/TemplatePreview';

interface Props {
  params: Promise<{ slug: string }>;
}

async function getInvite(slug: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/invites/by-slug/${slug}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export default async function InvitePage({ params }: Props) {
  const { slug } = await params;
  const invite = await getInvite(slug);

  if (!invite) {
    notFound();
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  return (
    <div style={{ minHeight: '100vh' }}>
      <TemplatePreview data={invite} apiBase={apiBase} fullPage slug={slug} />
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

  return {
    title,
    description: invite.inviteText || `Вас приглашают на свадьбу! ${invite.weddingDate ? new Date(invite.weddingDate).toLocaleDateString('ru-RU') : ''}`,
    openGraph: {
      title,
      images: invite.coverPhoto ? [`${process.env.NEXT_PUBLIC_API_URL}${invite.coverPhoto}`] : [],
    },
  };
}
