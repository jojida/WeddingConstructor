'use client';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Monitor, Smartphone, Tablet, X } from 'lucide-react';
import { readStorage, writeStorage } from '@/lib/browser-storage';
import s from './PreviewDevice.module.css';

/* Превью приглашения на телефоне, планшете и компьютере.

   Рамка — это размер окна, в котором шаблон верстается: у телефона экран
   332 px (макет 360×720 с рамкой), у планшета — 768×1024, как iPad в портрете,
   у компьютера — 1440×900, частое окно ноутбука. Под нужную ширину шаблон
   перерисовывается сам: iframe получает эту ширину, а уменьшает рамку под
   место только transform. */
export type PreviewDevice = 'phone' | 'tablet' | 'desktop';
/** Во весь экран: те же устройства, «Компьютер» там — на всю ширину окна, без рамки */
export type FullPreviewMode = PreviewDevice;

export const DEVICES: Record<PreviewDevice, { w: number; h: number; min: number; max: number; label: string }> = {
  phone: { w: 360, h: 720, min: 0.45, max: 1.15, label: 'Телефон' },
  // 768×1024 экран + рамка 22 px и обводка 2 px с каждой стороны
  tablet: { w: 816, h: 1072, min: 0.3, max: 1, label: 'Планшет' },
  // 1440×900 экран + рамка монитора 14 px и обводка 2 px с каждой стороны
  desktop: { w: 1472, h: 932, min: 0.2, max: 1, label: 'Компьютер' },
};

const STORAGE_KEY = 'wc_editor_device';

/** Выбранное устройство помнится в браузере (удобство, не данные приглашения).
    Читается после монтирования: в dev редактор рендерится и на сервере. */
export function useStoredDevice(): [PreviewDevice, (d: PreviewDevice) => void] {
  const [device, setDevice] = useState<PreviewDevice>('phone');
  useEffect(() => {
    const saved = readStorage('localStorage', STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- разовое чтение после монтирования, см. выше
    if (saved === 'tablet' || saved === 'desktop') setDevice(saved);
  }, []);
  const choose = (d: PreviewDevice) => {
    setDevice(d);
    writeStorage('localStorage', STORAGE_KEY, d);
  };
  return [device, choose];
}

/** Масштаб рамки под место: сколько помещается по ширине и высоте, в пределах устройства. */
export function fitScale(device: PreviewDevice, width: number, height: number): number {
  const d = DEVICES[device];
  const k = Math.min(height / d.h, width / d.w, d.max);
  return Math.max(d.min, Math.floor(k * 100) / 100);
}

/** Совпадает ли медиазапрос — без лишнего кадра и без расхождения с сервером (там false). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    cb => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const ICONS: Record<FullPreviewMode, typeof Smartphone> = { phone: Smartphone, tablet: Tablet, desktop: Monitor };
const LABELS: Record<FullPreviewMode, string> = { phone: 'Телефон', tablet: 'Планшет', desktop: 'Компьютер' };

/** Переключатель устройств — «таблетка» с вариантами. */
export function DeviceSwitch<T extends FullPreviewMode>({ value, options, onChange, className }: {
  value: T; options: readonly T[]; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div className={`${s.switch} ${className || ''}`} role="radiogroup" aria-label="Как смотреть приглашение">
      {options.map(o => {
        const Icon: typeof Smartphone = ICONS[o as FullPreviewMode];
        const on = o === value;
        return (
          <button key={o} type="button" role="radio" aria-checked={on} className={s.switchBtn}
            title={`Как на ${o === 'phone' ? 'телефоне' : o === 'tablet' ? 'планшете' : 'компьютере'}`}
            onClick={() => onChange(o)}>
            <Icon size={16} strokeWidth={1.8} aria-hidden />
            <span>{LABELS[o]}</span>
          </button>
        );
      })}
    </div>
  );
}

/* Полноэкранный предпросмотр. На компьютере — в рамке телефона или планшета
   на весь экран либо во всю ширину окна, как раньше. На телефоне выбирать
   нечего: приглашение и так открыто на телефоне — сразу во весь экран. */
export function FullPreview({ mode, onMode, onClose, children }: {
  mode: FullPreviewMode;
  onMode: (m: FullPreviewMode) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const small = useMediaQuery('(max-width: 768px)');
  // Esc закрывает предпросмотр. Нажатие внутри приглашения (в нём фокус после
  // клика по конверту) окно редактора не слышит — слушаем и окно шаблона:
  // оно с нашего же сайта. load у iframe не всплывает, но ловится на захвате.
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const root = overlayRef.current;
    const listen = (frame: HTMLIFrameElement) => {
      try { frame.contentWindow?.addEventListener('keydown', onKey); } catch { /* чужой адрес */ }
    };
    const onLoad = (e: Event) => { if (e.target instanceof HTMLIFrameElement) listen(e.target); };
    window.addEventListener('keydown', onKey);
    root?.addEventListener('load', onLoad, true);
    root?.querySelectorAll('iframe').forEach(listen);
    return () => {
      window.removeEventListener('keydown', onKey);
      root?.removeEventListener('load', onLoad, true);
      root?.querySelectorAll('iframe').forEach(f => { try { f.contentWindow?.removeEventListener('keydown', onKey); } catch { /* чужой адрес */ } });
    };
  }, [onClose]);

  const framed = !small && mode !== 'desktop';
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!framed || !el) return;
    const fit = () => setScale(fitScale(mode as PreviewDevice, el.clientWidth, el.clientHeight));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [framed, mode]);

  const dev = framed ? DEVICES[mode as PreviewDevice] : null;
  return (
    <div ref={overlayRef} className={`${s.overlay} ${framed ? s.overlayFramed : ''}`} role="dialog" aria-modal="true" aria-label="Предпросмотр приглашения">
      <div className={s.bar}>
        {!small && <DeviceSwitch value={mode} options={['phone', 'tablet', 'desktop'] as const} onChange={onMode} />}
        <button type="button" className={s.close} onClick={onClose}>
          <X size={16} strokeWidth={2} aria-hidden /> Закрыть
        </button>
      </div>
      {dev ? (
        <div className={s.stage} ref={stageRef}>
          <div style={{ width: dev.w * scale, height: dev.h * scale, flex: 'none' }}>
            <div className={`${s.frame} ${mode === 'tablet' ? s.frameTablet : ''}`}
              style={{ width: dev.w, height: dev.h, transform: `scale(${scale})` }}>
              <div className={s.screen}>{children}</div>
            </div>
          </div>
        </div>
      ) : children}
    </div>
  );
}
