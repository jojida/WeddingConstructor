'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { reachGoal, GOAL } from '@/lib/metrika';

/* «Выбрать этот шаблон» на демо: переход в редактор + цель template_choose.
   Ссылка внутри приложения, без перезагрузки — цель успевает уйти до перехода.
   Без предзагрузки: редактор тяжёлый, а нажимают его не все. */
export default function ChooseTemplateLink({ templateId, templateName, style, className, children }: {
  templateId: string; templateName: string; style?: CSSProperties; className?: string; children: ReactNode;
}) {
  return (
    <Link href={`/editor?template=${templateId}`} prefetch={false} style={style} className={className}
      onClick={() => reachGoal(GOAL.templateChoose, { template: templateName, from: 'demo' })}>
      {children}
    </Link>
  );
}
