'use client';
import { useEffect, useState } from 'react';
import TemplatePreview, { type InviteData } from '@/components/TemplatePreview';
import { readPreviewNames, withPreviewNames } from '@/lib/preview-names';

/* Демо с именами, которые человек вписал в каталоге шаблонов: сервер отдаёт
   пример (его видят поисковики), а в браузере после загрузки подставляем свои
   имена — приглашение в iframe получает их тем же сообщением wc:data, что и
   живое превью в редакторе, без перезагрузки. */
export default function DemoPreview({ data, apiBase }: { data: InviteData; apiBase: string }) {
  const [shown, setShown] = useState(data);
  useEffect(() => { setShown(withPreviewNames(data, readPreviewNames())); }, [data]);
  return <TemplatePreview data={shown} apiBase={apiBase} fullPage />;
}
