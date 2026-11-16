'use client';
import { useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { DEVICES, fitScale, type PreviewDevice } from './PreviewDevice';
import s from './SitePreview.module.css';

/* Сайт-приглашение слева от настроек — в анкете «Расскажите о вашей свадьбе»
   (SetupStep) и в редакторе. Варианты переключателя:
   · «Окно» — сайт без рамки, как на странице демо: колонка до 500 px во всю
     высоту на сером фоне («превью сайта осталось, не в телефоне», 16.11.26);
   · «Телефон» и «Планшет» — в рамке устройства (360×720 и 816×1072 с рамкой);
   · «Компьютер» — окно 1440×900 без рамки.
   Рамки и окно уменьшаются под место только transform: шаблон верстается под
   ширину своего экрана. На телефоне (≤768 px) редактор показывает только
   «Окно» во всю ширину; касания оно не ловит (свайп листал бы приглашение, а не
   страницу), нажатие — onTap. */
const DESKTOP = { w: 1440, h: 900 };

export default function SitePreview({ device, innerRef, onTap, children }: {
  device: PreviewDevice;
  /** Обёртка, в которой лежит iframe шаблона — редактор находит его там */
  innerRef?: Ref<HTMLDivElement>;
  /** Нажатие на сайт на телефоне (≤768 px) — обычно «во весь экран» */
  onTap?: () => void;
  children: ReactNode;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el || device === 'window') return;
    // Всё целиком в свободном месте, с полями по 24 px
    const fit = () => {
      const w = el.clientWidth - 48, h = el.clientHeight - 48;
      if (device === 'desktop') {
        const k = Math.min(w / DESKTOP.w, h / DESKTOP.h, 1);
        setScale(Math.max(0.15, Math.floor(k * 1000) / 1000));
      } else {
        setScale(fitScale(device, w, h));
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);

  const tap = onTap
    ? () => { if (window.matchMedia('(max-width: 768px)').matches) onTap(); }
    : undefined;

  if (device === 'window') {
    return (
      <div ref={areaRef} className={s.area}>
        <div ref={innerRef} className={s.column} onClick={tap}>
          {children}
        </div>
      </div>
    );
  }

  // Рамка устройства или окно компьютера: размер обёртки — уже уменьшенный
  const size = device === 'desktop' ? DESKTOP : DEVICES[device];
  const box = scale ? { width: size.w * scale, height: size.h * scale } : { visibility: 'hidden' as const };
  const inner = { width: size.w, height: size.h, transform: `scale(${scale ?? 1})` };
  return (
    <div ref={areaRef} className={s.area}>
      {device === 'desktop' ? (
        <div className={s.window} style={box}>
          <div ref={innerRef} className={s.scaled} style={inner}>{children}</div>
        </div>
      ) : (
        <div className={s.frameBox} style={box}>
          <div className={`${s.frame} ${device === 'tablet' ? s.frameTablet : ''}`} style={inner}>
            <div className={s.frameScreen}>
              <div ref={innerRef} className={s.frameContent}>{children}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
