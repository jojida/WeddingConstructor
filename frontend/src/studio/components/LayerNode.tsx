'use client';

/* Слой на холсте — настоящий DOM-узел с теми же декларациями, что уйдут в
   styles.css. Никакой отдельной «отрисовки для редактора» не существует:
   разойтись с экспортом здесь просто нечему. */

import { CSSProperties, useEffect, useRef } from 'react';
import { Layer, Project } from '../types';
import { layerDeclarations } from '../export/generate';
import { assetUrlFor } from '../assets/url';

/** «line-height: 1.3» → { lineHeight: '1.3' } для инлайнового стиля React. */
export function declarationsToStyle(declarations: string[]): CSSProperties {
  const style: Record<string, string> = {};
  for (const declaration of declarations) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    const key = property.startsWith('--')
      ? property
      : property.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
    style[key] = value;
  }
  return style as CSSProperties;
}

/**
 * Диапазон для каретки: по возможности в точке щелчка, иначе — в конец текста.
 * Разные браузеры зовут это по-разному, поэтому пробуем оба имени.
 */
function caretRange(el: HTMLElement, point?: { x: number; y: number } | null): Range {
  if (point) {
    const doc = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
    };

    const fromPoint = doc.caretRangeFromPoint?.(point.x, point.y);
    if (fromPoint && el.contains(fromPoint.startContainer)) return fromPoint;

    const position = doc.caretPositionFromPoint?.(point.x, point.y);
    if (position && el.contains(position.offsetNode)) {
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
  }

  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  return range;
}

interface Props {
  layer: Layer;
  project: Project;
  editing: boolean;
  /** экранная точка двойного щелчка — туда встанет каретка */
  caretPoint?: { x: number; y: number } | null;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  /**
    * Вызывается один раз по выходу из правки; null — отказ по Escape.
    * height — фактическая высота набранного текста в пикселях холста.
    */
  onTextDone: (value: string | null, height?: number) => void;
}

export default function LayerNode({
  layer,
  project,
  editing,
  caretPoint,
  onPointerDown,
  onDoubleClick,
  onTextDone,
}: Props) {
  const assetUrl = assetUrlFor(project);
  const style = declarationsToStyle(
    layerDeclarations(layer, project.canvas.width, assetUrl),
  );
  const editableRef = useRef<HTMLElement>(null);

  /* Набранное должно дойти до документа любым путём выхода из правки — не
     только по blur. Клик мимо сначала снимает выделение, узел исчезает, и
     blur на нём уже не случится: текст пропадал. Поэтому значение уносит
     ещё и уборка эффекта, а флаги не дают записать его дважды. */
  const doneRef = useRef(onTextDone);
  const cancelledRef = useRef(false);
  const committedRef = useRef(false);

  useEffect(() => {
    doneRef.current = onTextDone;
  });

  /*
   * Правка прямо на холсте. Пока идёт набор, документ не трогаем совсем:
   * узел принадлежит браузеру, React в него не заглядывает. Иначе каждая
   * буква перерисовывала бы текст, каретка улетала бы в начало — и слово
   * набиралось задом наперёд. В документ значение уходит один раз, по выходу
   * из правки, и в историю ложится одной записью.
   */
  useEffect(() => {
    if (!editing) return;
    const el = editableRef.current;
    if (!el) return;

    cancelledRef.current = false;
    committedRef.current = false;
    el.textContent = layer.kind === 'text' ? layer.content : '';
    el.focus();

    /* Ставим каретку туда, куда щёлкнули, и ничего не выделяем: раньше текст
       выделялся целиком и первая же буква стирала всё написанное. */
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caretRange(el, caretPoint));

    return () => {
      if (cancelledRef.current || committedRef.current) return;
      doneRef.current(el.innerText, el.offsetHeight);
    };
    // Зависимость только от editing — и это намеренно: текст ставится один раз
    // на входе в правку. Следи эффект за содержимым, он переписывал бы узел на
    // каждом нажатии и возвращал каретку в начало.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Без запрета выделения перетаскивание текстового слоя выделяло бы буквы
  // вместо переноса, а картинка уезжала бы нативным drag&drop браузера.
  const common = {
    style: { ...style, userSelect: 'none' as const, WebkitUserSelect: 'none' as const },
    onPointerDown,
    onDoubleClick,
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
    'data-layer': layer.id,
  };

  if (layer.kind === 'text') {
    const Tag = layer.tag as 'h1';
    if (editing) {
      return (
        <Tag
          /* Ключ разный в двух режимах, чтобы React пересоздал узел. Во время
             правки содержимое принадлежит браузеру, и переиспользованный узел
             остался бы с чужим текстом: документ менялся, а холст — нет. */
          key="edit"
          ref={editableRef as React.Ref<HTMLHeadingElement>}
          style={{ ...style, outline: '1px solid #e0457b', cursor: 'text' }}
          data-layer={layer.id}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            committedRef.current = true;
            const node = e.currentTarget as HTMLElement;
            onTextDone(node.innerText, node.offsetHeight);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelledRef.current = true;
              onTextDone(null);
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget as HTMLElement).blur();
            }
          }}
        />
      );
    }
    return (
      <Tag key="view" {...common}>
        {layer.content}
      </Tag>
    );
  }

  if (layer.kind === 'image') {
    // Перекрашенный вектор выводится маской — как и в экспорте.
    if (layer.tint) return <div {...common} role="img" aria-label={layer.alt} />;
    // Пустой src браузер понимает как «загрузи страницу заново», поэтому
    // слой без картинки — это рамка, а не <img> без адреса.
    const src = layer.assetId ? assetUrl(layer.assetId) : null;
    if (!src) return <div {...common} role="img" aria-label={layer.alt || 'Без картинки'} />;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img {...common} src={src} alt={layer.alt} draggable={false} />
    );
  }

  if (layer.kind === 'block') {
    const BLOCK_NAMES: Record<string, string> = {
      schedule: 'программа дня',
      calendar: 'календарь',
      countdown: 'отсчёт',
      dresscode: 'дресс-код',
      wishes: 'пожелания',
      rsvp: 'анкета гостя',
    };
    /* Блок, взятый из шаблона, рисует не студия, а его собственный script.js.
       Показываем только границы и имя: так видно, сколько места он занимает и
       куда его можно подвинуть, но не создаётся ложное впечатление, будто
       содержимое можно править здесь. */
    return (
      <div
        {...common}
        style={{
          ...style,
          display: 'grid',
          placeItems: 'center',
          outline: '1px dashed rgba(0,0,0,.22)',
          outlineOffset: -1,
        }}
      >
        <span
          style={{
            font: '12px ui-monospace, monospace',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'rgba(0,0,0,.35)',
            border: '1px dashed rgba(0,0,0,.25)',
            background: 'rgba(255,255,255,.72)',
            padding: '4px 8px',
          }}
        >
          {BLOCK_NAMES[layer.block] ?? layer.block}
        </span>
      </div>
    );
  }

  return <div {...common} />;
}
