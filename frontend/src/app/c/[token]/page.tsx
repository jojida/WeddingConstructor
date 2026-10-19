import type { Metadata } from 'next';
import ConfirmAttendance from './ConfirmAttendance';

// Ссылка из SMS-напоминания: weddingcraft.ru/c/<token> — гость подтверждает, что придёт,
// или сообщает, что планы изменились. Токен — ключ к ответу гостя, в поиск страница не идёт.
export const metadata: Metadata = {
  title: 'Подтверждение участия',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ConfirmAttendance token={token} />;
}
