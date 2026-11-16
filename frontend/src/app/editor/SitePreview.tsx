'use client';
import { useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import type { PreviewDevice } from './PreviewDevice';
import s from './SitePreview.module.css';

/* Сайт-приглашение слева от настроек — в анкете «Расскажите о вашей свадьбе»
   (SetupStep) и в редакторе. С 16.11.26 — как на странице демо, без рамок
   устройств («превью сайта осталось, не в телефоне»):
   · «Телефон» — колонка до 500 px во всю высоту на сером фоне, как демо;
   · «Планшет» и «Компьютер» — окно 768×1024 / 1440×900, уменьшенное под
     место: шаблон верстается под эту ширину, уменьшает только transform.
   На телефоне (≤768 px) — всегда колонка во всю ширину; касания она не ловит
   (свайп листал бы приглашение, а не страницу), нажатие — onTap. */
const SCREENS = {
  tablet: { w: 768, h: 1024 },
  desktop: { w: 1440, h: 900 },
} as const;

export default function SitePreview({ device, innerRef, onTap, children }: {
  device: PreviewDevice;
  /** Обёртка, в которой лежит iframe шаблона — редактор находит его там */
  innerRef?: Ref<HTMLDivElement>;
  /** Нажатие на сайт на телефоне (≤768 px) — обычно «во весь экран» */
  onTap?: () => void;
  children: ReactNode;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const size = device === 'phone' ? null : SCREENS[device];
  const [scale, setScale] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el || !size) return;
    // Окно целиком в свободном месте, с полями по 24 px; крупнее родного не растёт
    const fit = () => {
      const k = Math.min((el.clientWidth - 48) / size.w, (el.clientHeight - 48) / size.h, 1);
      setScale(Math.max(0.15, Math.floor(k * 1000) / 1000));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  const tap = onTap
    ? () => { if (window.matchMedia('(max-width: 768px)').matches) onTap(); }
    : undefined;

  return (
    <div ref={areaRef} className={s.area}>
      {size ? (
        <div className={s.window}
          style={scale ? { width: size.w * scale, height: size.h * scale } : { visibility: 'hidden' }}>
          <div ref={innerRef} className={s.windowScreen}
            style={{ width: size.w, height: size.h, transform: `scale(${scale ?? 1})` }}>
            {children}
          </div>
        </div>
      ) : (
        <div ref={innerRef} className={s.column} onClick={tap}>
          {children}
        </div>
      )}
    </div>
  );
}
