'use client';
import { useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import RingsLoader from '@/components/RingsLoader';
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
   страницу), нажатие — onTap.

   Пока шаблон в окне грузится, поверх него — загрузка «бесконечность → кольца»,
   как на главной (components/RingsLoader.tsx, 24.11.26), только с быстрым
   финалом. Кольца начинают складываться, когда ответил скрипт шаблона
   (сообщение wc:ready), а тает загрузка, когда iframe догрузился с картинками
   первого экрана (событие load). Другое устройство или другой шаблон — новый
   iframe, и загрузка показывается заново. */
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
  const contentRef = useRef<HTMLDivElement>(null);
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

  // Загрузка поверх сайта: gen — номер iframe шаблона (новый — загрузка заново);
  // ready — можно складывать кольца, settled — можно таять
  const [boot, setBoot] = useState({ gen: 0, device, ready: false, settled: false, on: true });
  if (boot.device !== device) setBoot({ gen: boot.gen + 1, device, ready: false, settled: false, on: true });
  const gen = boot.gen;
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    let frame: HTMLIFrameElement | null = null;
    const mark = (settled: boolean) => setBoot(b => (
      b.gen !== gen || (b.ready && (b.settled || !settled)) ? b : { ...b, ready: true, settled: b.settled || settled }
    ));
    const onLoad = () => mark(true);
    const onMsg = (e: MessageEvent) => {
      if (frame && e.source === frame.contentWindow && e.data?.type === 'wc:ready') mark(false);
    };
    const scan = () => {
      const f = content.querySelector('iframe');
      if (!f) {
        // Шаблон нарисован прямо на странице, без iframe, — ждать нечего.
        // Пустая обёртка — компонент шаблона ещё качается (next/dynamic).
        if (content.childElementCount > 0) mark(true);
        return;
      }
      if (f === frame) return;
      if (frame) {
        // Другой шаблон — новый iframe: загрузка заново
        setBoot(b => (b.gen === gen ? { ...b, gen: b.gen + 1, ready: false, settled: false, on: true } : b));
        return;
      }
      frame = f;
      f.addEventListener('load', onLoad);
      try {
        const doc = f.contentDocument;
        if (doc && doc.readyState === 'complete' && doc.URL !== 'about:blank') mark(true);
      } catch { mark(true); }
    };
    window.addEventListener('message', onMsg);
    const mo = new MutationObserver(scan);
    mo.observe(content, { childList: true, subtree: true });
    scan();
    return () => {
      mo.disconnect();
      window.removeEventListener('message', onMsg);
      frame?.removeEventListener('load', onLoad);
    };
  }, [gen]);

  const tap = onTap
    ? () => { if (window.matchMedia('(max-width: 768px)').matches) onTap(); }
    : undefined;

  // Шаблон — в обёртке display: contents (раскладку не меняет), загрузка — рядом с ней
  const content = <div ref={contentRef} className={s.content}>{children}</div>;
  // В уменьшенном окне знак крупнее в его пикселях — на экране он те же ~200 px
  const loader = boot.on ? (
    <RingsLoader key={gen} ready={boot.ready} settled={boot.settled} size={device === 'window' ? 200 : 200 / (scale ?? 1)}
      onDone={() => setBoot(b => (b.gen === gen ? { ...b, on: false } : b))} />
  ) : null;

  if (device === 'window') {
    return (
      <div ref={areaRef} className={s.area}>
        <div ref={innerRef} className={s.column} onClick={tap}>
          {content}
          {loader}
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
          <div ref={innerRef} className={s.scaled} style={inner}>{content}{loader}</div>
        </div>
      ) : (
        <div className={s.frameBox} style={box}>
          <div className={`${s.frame} ${device === 'tablet' ? s.frameTablet : ''}`} style={inner}>
            <div className={s.frameScreen}>
              <div ref={innerRef} className={s.frameContent}>{content}{loader}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
