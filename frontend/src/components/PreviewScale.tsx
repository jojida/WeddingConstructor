'use client';
import { useEffect, useRef } from 'react';

/* Обёртка превью шаблона в карточке-витрине.

   Шаблоны свёрстаны под ширину телефона и почти целиком в пикселях: заголовок
   94px, рамка имён 128px и так далее. Поэтому превью нельзя просто растянуть
   по карточке — его нужно рисовать в «родной» ширине и целиком ужимать.

   Раньше ширина задавалась как 125% карточки с постоянным scale(0.8). На
   десктопе карточка широкая и выходило около 480px — почти родная ширина. На
   мобильном карточка 162px, шаблон получал 202px, и всё содержимое вылезало
   за край: заголовок обрезался, имена наезжали на подпись карточки.

   Теперь ширина фиксированная, а масштаб считается от фактической ширины
   карточки — превью выглядит одинаково на любом экране. */
const BASE_WIDTH = 480;

/* Запас по бокам текста при обрезке, в «родных» px миниатюры: росчерки
   рукописных шрифтов (Great Vibes и др.) выходят за габарит строки. */
const TEXT_MARGIN = 18;

/* Миниатюра на BLEED px (экранных) больше контейнера и сдвинута на половину:
   её собственный край уходит под обрезку overflow: hidden. Раньше масштаб
   считался по округлённой clientWidth, миниатюра недотягивала до края на долю
   пикселя, и по краю открытки и экрана проступала белая нить подложки. */
const BLEED = 1;

/* baseWidth — «родная» ширина рендера (читает CSS из --preview-base). Уже
   480px её делать нельзя: вёрстка миниатюр в px и долях ширины макета, при
   узком рендере текст и рамки вылезают за правый край.

   coverHeight — режим «cover» для экрана телефона в витрине (TemplateShowcase):
   экран вытянут (~9:19), а миниатюра рассчитана на пропорции открытки. Рендерим
   её baseWidth × coverHeight, масштабируем по высоте экрана, по бокам срезается
   лишнее (--preview-offset).

   fitText — в режиме cover срезать можно только фон, не текст. Окно обрезки
   центрируется по тексту миниатюры (у «Нежности», например, арка с именами
   смещена вправо), а если текст шире окна — миниатюра отдаляется ровно
   настолько, чтобы он поместился с запасом. Освободившееся место сверху и
   снизу заливается фоном самой миниатюры, композиция остаётся по центру.

   fitKey — меняется вместе с текстом (имена в поле «со своими именами»):
   тогда ширина текста перемеряется. */
export default function PreviewScale({ className, children, baseWidth = BASE_WIDTH, coverHeight, fitText = false, fitKey }: {
  className?: string;
  children: React.ReactNode;
  baseWidth?: number;
  coverHeight?: number;
  fitText?: boolean;
  fitKey?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const textBox = useRef<{ x0: number; x1: number } | null>(null);
  const remeasureRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    textBox.current = null;
    const set = (name: string, value: string) => el.style.setProperty(name, value);

    // Горизонтальные границы видимого текста миниатюры — в её «родных» px
    const measure = () => {
      const root = el.firstElementChild as HTMLElement | null;
      const scale = parseFloat(el.style.getPropertyValue('--preview-scale'));
      if (!root || !scale) return null;
      const rootLeft = root.getBoundingClientRect().left;
      let x0 = Infinity;
      let x1 = -Infinity;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || !node.textContent?.trim()) continue;
        const style = getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width < 0.5) continue;
          x0 = Math.min(x0, (rect.left - rootLeft) / scale);
          x1 = Math.max(x1, (rect.right - rootLeft) / scale);
        }
      }
      return x1 > x0 ? { x0, x1 } : null;
    };

    // Фон миниатюры — им заливаются поля, если она отдалена. Ищем со второго
    // уровня: первый — масштабируемая обёртка, у неё свой фон-«бумага» на время загрузки.
    let fill = '';
    const paintBackground = () => {
      let node = el.firstElementChild?.firstElementChild as HTMLElement | null;
      for (let depth = 0; node && depth < 4; depth++, node = node.firstElementChild as HTMLElement | null) {
        const color = getComputedStyle(node).backgroundColor;
        if (color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {
          fill = color;
          return;
        }
      }
    };

    // Размер контейнера с долями пикселя (ResizeObserver); до первого замера — clientWidth
    const size = { width: 0, height: 0 };

    const fit = () => {
      const width = size.width || el.clientWidth;
      const height = size.height || el.clientHeight;
      if (!width || !height) return;
      const w = width + BLEED;
      const h = height + BLEED;
      if (coverHeight) {
        let scale = Math.max(h / coverHeight, w / baseWidth);
        let center = baseWidth / 2;
        const box = fitText ? textBox.current : null;
        if (box) {
          const textScale = w / Math.min(baseWidth, box.x1 - box.x0 + 2 * TEXT_MARGIN);
          scale = Math.max(w / baseWidth, Math.min(scale, textScale));
          center = (box.x0 + box.x1) / 2;
        }
        const visible = w / scale;
        const left = Math.min(Math.max(center - visible / 2, 0), baseWidth - visible);
        // > 0 — миниатюра отдалена, сверху и снизу поля её фона
        const band = (h - coverHeight * scale) / 2;
        set('--preview-scale', String(scale));
        set('--preview-height', `${coverHeight}px`);
        set('--preview-offset', `${-left * scale - BLEED / 2}px`);
        set('--preview-offset-y', `${Math.max(0, band) - BLEED / 2}px`);
        // Заливка только когда есть поля: иначе её край тоже проступал бы нитью
        el.style.backgroundColor = band > 0 ? fill : '';
        return;
      }
      const scale = w / baseWidth;
      set('--preview-scale', String(scale));
      // Высоту превью подгоняем так, чтобы после сжатия оно закрыло карточку с запасом
      set('--preview-height', `${h / scale}px`);
      set('--preview-offset', `${-BLEED / 2}px`);
      set('--preview-offset-y', `${-BLEED / 2}px`);
    };

    const remeasure = () => {
      if (!coverHeight || !fitText) return;
      const box = measure();
      if (!box) return;
      paintBackground();
      const prev = textBox.current;
      // Мелкие сдвиги (тикающий таймер) не трогают окно — иначе оно дёргается
      if (prev && Math.abs(prev.x0 - box.x0) < 2 && Math.abs(prev.x1 - box.x1) < 2) return;
      textBox.current = box;
      fit();
    };
    remeasureRef.current = remeasure;

    fit();
    remeasure();

    let resize: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'undefined') window.addEventListener('resize', fit);
    else {
      resize = new ResizeObserver(entries => {
        const rect = entries[entries.length - 1]?.contentRect;
        if (rect) { size.width = rect.width; size.height = rect.height; }
        fit();
      });
      resize.observe(el);
    }

    // Миниатюра монтируется позже (LazyMount + динамический импорт шаблона),
    // а ширина текста зависит от шрифтов — перемеряем, когда появляется
    // содержимое и когда догружаются шрифты. Смену цифр таймера (characterData)
    // не слушаем, чтобы окно не пересчитывалось каждую секунду.
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(remeasure); };
    let mutations: MutationObserver | null = null;
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (coverHeight && fitText) {
      mutations = new MutationObserver(schedule);
      mutations.observe(el, { childList: true, subtree: true });
      fonts?.addEventListener?.('loadingdone', schedule);
      fonts?.ready?.then(schedule);
    }

    return () => {
      resize?.disconnect();
      window.removeEventListener('resize', fit);
      mutations?.disconnect();
      fonts?.removeEventListener?.('loadingdone', schedule);
      cancelAnimationFrame(frame);
    };
  }, [baseWidth, coverHeight, fitText]);

  // Сменились имена — текст другой ширины, окно обрезки надо пересчитать
  useEffect(() => {
    const frame = requestAnimationFrame(() => remeasureRef.current());
    return () => cancelAnimationFrame(frame);
  }, [fitKey]);

  return (
    <div ref={ref} className={className} style={{ '--preview-base': `${baseWidth}px` } as React.CSSProperties}>
      {children}
    </div>
  );
}
