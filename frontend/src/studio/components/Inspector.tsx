'use client';

/* Правая панель: свойства слоя, секции и шаблона.
   Всё рисуется из документа и пишется через commit — значит, отменяется. */

import { useState } from 'react';
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Trash2,
} from 'lucide-react';
import { useStudio, AlignMode } from '../store';
import { CANVAS_PRESETS, EditHook, Layer, sectionHeightPx } from '../types';
import { slugify } from '../slug';
import css from '../studio.module.css';

type Tab = 'layer' | 'section' | 'project' | 'files';

const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`;

/* ─── числовое поле ───────────────────────────────────────────────────────── */

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const shown = String(Math.round(value * 100) / 100);
  const [draft, setDraft] = useState(shown);
  // Значение изменили снаружи (перетащили слой, отменили действие) — подхватываем
  // его прямо во время отрисовки: эффект здесь дал бы лишний проход рендера.
  const [lastShown, setLastShown] = useState(shown);
  if (shown !== lastShown) {
    setLastShown(shown);
    setDraft(shown);
  }

  return (
    <div className={css.field}>
      <span className={css.label}>{label}</span>
      <input
        className={`${css.input} ${css.mono}`}
        type="number"
        step={step}
        min={min}
        max={max}
        value={draft}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          // Пустое поле и «-» — это середина набора, а не число: без этой
          // проверки слой прыгал бы в ноль, пока стираешь старое значение.
          if (raw.trim() === '' || raw === '-' || raw.endsWith('.')) return;
          const next = Number(raw);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </div>
  );
}

/* ─── инспектор ───────────────────────────────────────────────────────────── */

export default function Inspector() {
  const project = useStudio((s) => s.project);
  const selection = useStudio((s) => s.selection);
  const activeSectionId = useStudio((s) => s.activeSectionId);
  const patchLayer = useStudio((s) => s.patchLayer);
  const alignSelection = useStudio((s) => s.alignSelection);
  const distributeSelection = useStudio((s) => s.distributeSelection);
  const renameSection = useStudio((s) => s.renameSection);
  const setSectionHeight = useStudio((s) => s.setSectionHeight);
  const setSectionBackground = useStudio((s) => s.setSectionBackground);
  const setSectionClip = useStudio((s) => s.setSectionClip);
  const setCanvasWidth = useStudio((s) => s.setCanvasWidth);
  const patchCatalog = useStudio((s) => s.patchCatalog);
  const removeAsset = useStudio((s) => s.removeAsset);
  const addFontFile = useStudio((s) => s.addFontFile);
  const addGoogleFont = useStudio((s) => s.addGoogleFont);
  const removeFont = useStudio((s) => s.removeFont);
  const replaceLayerAsset = useStudio((s) => s.replaceLayerAsset);
  const explodeSvgLayer = useStudio((s) => s.explodeSvgLayer);

  const [googleFamily, setGoogleFamily] = useState('');
  const [fontFamily, setFontFamily] = useState('');

  const [tab, setTab] = useState<Tab>('layer');

  // Выделили слой — показываем его свойства, не заставляя щёлкать вкладку.
  // Сравниваем сам выбор, а не его размер: смена одного слоя на другой тоже
  // должна возвращать панель к свойствам.
  const selectionKey = selection.join(',');
  const [lastSelection, setLastSelection] = useState(selectionKey);
  if (selectionKey !== lastSelection) {
    setLastSelection(selectionKey);
    if (selection.length) setTab('layer');
  }

  if (!project) return null;

  const section = project.sections.find((s) => s.id === activeSectionId) ?? null;
  const picked: Layer[] = project.sections
    .flatMap((s) => s.layers)
    .filter((l) => selection.includes(l.id));
  const one = picked.length === 1 ? picked[0] : null;

  const sectionOf = (layerId: string) =>
    project.sections.find((s) => s.layers.some((l) => l.id === layerId)) ?? null;

  /** Ключ по умолчанию: из имени слоя, латиницей и без пробелов. */
  const suggestKey = (layer: Layer): string => {
    const base = slugify(layer.name) || 'field';
    return base.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
  };

  const patchHook = (layer: Layer, patch: Partial<EditHook>, mergeKey?: string) => {
    const current = (layer as { editable?: EditHook }).editable;
    if (!current) return;
    patchLayer(layer.id, { editable: { ...current, ...patch } }, mergeKey);
  };

  const patchParams = (
    layer: Layer & { params: Record<string, unknown> },
    patch: Record<string, unknown>,
    mergeKey?: string,
  ) => patchLayer(layer.id, { params: { ...layer.params, ...patch } }, mergeKey);

  const alignButton = (mode: AlignMode, Icon: typeof AlignStartVertical, title: string) => (
    <button
      type="button"
      className={css.iconBtn}
      onClick={() => alignSelection(mode)}
      title={title}
      aria-label={title}
    >
      <Icon size={15} />
    </button>
  );

  return (
    <aside className={css.right}>
      <div className={css.tabs}>
        <button
          type="button"
          className={`${css.tab} ${tab === 'layer' ? css.tabOn : ''}`}
          onClick={() => setTab('layer')}
        >
          Слой
        </button>
        <button
          type="button"
          className={`${css.tab} ${tab === 'section' ? css.tabOn : ''}`}
          onClick={() => setTab('section')}
        >
          Секция
        </button>
        <button
          type="button"
          className={`${css.tab} ${tab === 'project' ? css.tabOn : ''}`}
          onClick={() => setTab('project')}
        >
          Шаблон
        </button>
        <button
          type="button"
          className={`${css.tab} ${tab === 'files' ? css.tabOn : ''}`}
          onClick={() => setTab('files')}
        >
          Файлы
        </button>
      </div>

      {/* ─── слой ─────────────────────────────────────────────────────────── */}

      {tab === 'layer' && !picked.length && (
        <div className={css.group}>
          <p className={css.hint}>
            Ничего не выбрано. Щёлкните слой на холсте или в списке слева.
            <br />
            <br />T — текст, R — прямоугольник, O — овал, V — обычное выделение.
          </p>
        </div>
      )}

      {tab === 'layer' && !!picked.length && (
        <>
          <div className={css.group}>
            <div className={css.groupTitle}>
              {one ? one.name : `Выбрано слоёв: ${picked.length}`}
            </div>
            <div className={css.alignRow}>
              {alignButton('left', AlignStartVertical, 'По левому краю')}
              {alignButton('hcenter', AlignCenterVertical, 'По центру по горизонтали')}
              {alignButton('right', AlignEndVertical, 'По правому краю')}
              {alignButton('top', AlignStartHorizontal, 'По верхнему краю')}
              {alignButton('vcenter', AlignCenterHorizontal, 'По центру по вертикали')}
              {alignButton('bottom', AlignEndHorizontal, 'По нижнему краю')}
              <button
                type="button"
                className={css.iconBtn}
                onClick={() => distributeSelection('x')}
                title="Разложить по горизонтали (от трёх слоёв)"
                aria-label="Разложить по горизонтали"
              >
                <AlignHorizontalSpaceAround size={15} />
              </button>
              <button
                type="button"
                className={css.iconBtn}
                onClick={() => distributeSelection('y')}
                title="Разложить по вертикали (от трёх слоёв)"
                aria-label="Разложить по вертикали"
              >
                <AlignVerticalSpaceAround size={15} />
              </button>
            </div>
          </div>

          {one && (
            <>
              <div className={css.group}>
                <div className={css.groupTitle}>Положение и размер</div>
                <div className={css.row2}>
                  <NumberField
                    label="X"
                    value={one.x}
                    onChange={(v) => patchLayer(one.id, { x: v }, `x:${one.id}`)}
                  />
                  <NumberField
                    label="Y"
                    value={one.y}
                    onChange={(v) => patchLayer(one.id, { y: v }, `y:${one.id}`)}
                  />
                </div>
                <div className={css.row2}>
                  <NumberField
                    label="Ширина"
                    value={one.w}
                    min={1}
                    onChange={(v) => patchLayer(one.id, { w: Math.max(1, v) }, `w:${one.id}`)}
                  />
                  <NumberField
                    label="Высота"
                    value={one.h}
                    min={1}
                    onChange={(v) => patchLayer(one.id, { h: Math.max(1, v) }, `h:${one.id}`)}
                  />
                </div>
                <div className={css.row2}>
                  <NumberField
                    label="Поворот, °"
                    value={one.rotation}
                    step={0.5}
                    onChange={(v) => patchLayer(one.id, { rotation: v }, `rot:${one.id}`)}
                  />
                  <NumberField
                    label="Прозрачность"
                    value={one.opacity}
                    step={0.05}
                    min={0}
                    max={1}
                    onChange={(v) =>
                      patchLayer(
                        one.id,
                        { opacity: Math.min(1, Math.max(0, v)) },
                        `op:${one.id}`,
                      )
                    }
                  />
                </div>
                {one.kind === 'text' && (
                  <label className={css.checkRow}>
                    <input
                      type="checkbox"
                      checked={one.autoHeight !== false}
                      onChange={(e) => patchLayer(one.id, { autoHeight: e.target.checked })}
                    />
                    Высота по содержимому
                  </label>
                )}
              </div>


              {/* появление при прокрутке */}
              <div className={css.group}>
                <div className={css.groupTitle}>Появление при прокрутке</div>
                <label className={css.checkRow}>
                  <input
                    type="checkbox"
                    checked={!!one.reveal}
                    onChange={(e) =>
                      patchLayer(one.id, {
                        reveal: e.target.checked ? { kind: 'up', delay: 0 } : undefined,
                      })
                    }
                  />
                  Появляется при прокрутке
                </label>
                {one.reveal && (
                  <>
                    <div className={css.row2}>
                      <div className={css.field}>
                        <span className={css.label}>Как</span>
                        <select
                          className={css.select}
                          value={one.rotation ? 'soft' : one.reveal.kind}
                          disabled={!!one.rotation}
                          onChange={(e) =>
                            patchLayer(one.id, {
                              reveal: { kind: e.target.value, delay: one.reveal?.delay ?? 0 },
                            })
                          }
                        >
                          <option value="up">со смещением</option>
                          <option value="soft">только проявление</option>
                        </select>
                      </div>
                      <NumberField
                        label="Задержка, мс"
                        value={one.reveal.delay}
                        step={50}
                        min={0}
                        onChange={(v) =>
                          patchLayer(
                            one.id,
                            { reveal: { kind: one.reveal?.kind ?? 'up', delay: Math.max(0, v) } },
                            `rev:${one.id}`,
                          )
                        }
                      />
                    </div>
                    {!!one.rotation && (
                      <p className={css.hint}>
                        У слоя есть поворот, поэтому вариант выбран мягкий: обычный сбросил бы
                        поворот, и слой прыгнул бы на место из другой точки.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* правит пара */}
              {(one.kind === 'text' || one.kind === 'image') && (
                <div className={css.group}>
                  <div className={css.groupTitle}>Правит пара</div>
                  <label className={css.checkRow}>
                    <input
                      type="checkbox"
                      checked={!!one.editable}
                      onChange={(e) =>
                        patchLayer(one.id, {
                          editable: e.target.checked
                            ? ({
                                key: suggestKey(one),
                                type: one.kind === 'image' ? 'image' : 'textarea',
                                label: one.name,
                                panelSection: sectionOf(one.id)?.name ?? 'Содержимое',
                                scope: 'custom',
                              } as EditHook)
                            : undefined,
                        })
                      }
                    />
                    Пара меняет это в кабинете
                  </label>

                  {one.editable && (
                    <>
                      <div className={css.row2}>
                        <div className={css.field}>
                          <label className={css.label} htmlFor="hook-key">
                            Ключ
                          </label>
                          <input
                            id="hook-key"
                            className={`${css.input} ${css.mono}`}
                            value={one.editable.key}
                            onChange={(e) =>
                              patchHook(one, { key: e.target.value.trim() }, `hk:${one.id}`)
                            }
                          />
                        </div>
                        <div className={css.field}>
                          <span className={css.label}>Тип поля</span>
                          <select
                            className={css.select}
                            value={one.editable.type}
                            onChange={(e) => patchHook(one, { type: e.target.value as EditHook['type'] })}
                          >
                            <option value="text">строка</option>
                            <option value="textarea">абзац</option>
                            <option value="image">картинка</option>
                          </select>
                        </div>
                      </div>

                      <div className={css.field}>
                        <label className={css.label} htmlFor="hook-label">
                          Подпись поля в кабинете
                        </label>
                        <input
                          id="hook-label"
                          className={css.input}
                          value={one.editable.label}
                          onChange={(e) => patchHook(one, { label: e.target.value }, `hl:${one.id}`)}
                        />
                      </div>

                      <div className={css.field}>
                        <label className={css.label} htmlFor="hook-section">
                          Раздел панели
                        </label>
                        <input
                          id="hook-section"
                          className={css.input}
                          value={one.editable.panelSection}
                          onChange={(e) =>
                            patchHook(one, { panelSection: e.target.value }, `hs:${one.id}`)
                          }
                        />
                      </div>

                      <div className={css.row2}>
                        <div className={css.field}>
                          <span className={css.label}>Где хранится</span>
                          <select
                            className={css.select}
                            value={one.editable.scope}
                            onChange={(e) =>
                              patchHook(one, { scope: e.target.value as 'data' | 'custom' })
                            }
                          >
                            <option value="custom">поле шаблона</option>
                            <option value="data">общее поле пары</option>
                          </select>
                        </div>
                        {one.editable.type !== 'image' && (
                          <NumberField
                            label="Лимит символов"
                            value={one.editable.maxLength ?? 0}
                            min={0}
                            step={10}
                            onChange={(v) =>
                              patchHook(one, { maxLength: v > 0 ? v : undefined }, `hm:${one.id}`)
                            }
                          />
                        )}
                      </div>

                      {one.editable.type !== 'image' && !one.editable.maxLength && (
                        <p className={css.hint}>
                          Без лимита пара может ввести текст длиннее рамки — он выйдет за
                          пределы дизайна. Лучше поставить число.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* блок */}
              {one.kind === 'block' && (
                <div className={css.group}>
                  <div className={css.groupTitle}>Блок</div>
                  <div className={css.field}>
                    <span className={css.label}>Что это</span>
                    <select
                      className={css.select}
                      value={one.block}
                      onChange={(e) => patchLayer(one.id, { block: e.target.value })}
                    >
                      <option value="schedule">программа дня</option>
                      <option value="calendar">календарь</option>
                      <option value="countdown">отсчёт до свадьбы</option>
                      <option value="dresscode">дресс-код</option>
                      <option value="wishes">пожелания</option>
                      <option value="rsvp">анкета гостя</option>
                    </select>
                  </div>

                  <div className={css.field}>
                    <span className={css.label}>Цвет текста</span>
                    <div className={css.colorRow}>
                      <input
                        className={css.colorWell}
                        type="color"
                        value={(one.params.ink as string) || '#3a3a3a'}
                        onChange={(e) => patchParams(one, { ink: e.target.value }, `bi:${one.id}`)}
                        aria-label="Цвет текста блока"
                      />
                      <input
                        className={`${css.input} ${css.mono}`}
                        value={(one.params.ink as string) || ''}
                        placeholder="#3a3a3a"
                        onChange={(e) => patchParams(one, { ink: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={css.field}>
                    <span className={css.label}>Акцент — время, кнопки, активный день</span>
                    <div className={css.colorRow}>
                      <input
                        className={css.colorWell}
                        type="color"
                        value={(one.params.accent as string) || '#8c7a5e'}
                        onChange={(e) => patchParams(one, { accent: e.target.value }, `ba:${one.id}`)}
                        aria-label="Акцентный цвет блока"
                      />
                      <input
                        className={`${css.input} ${css.mono}`}
                        value={(one.params.accent as string) || ''}
                        placeholder="#8c7a5e"
                        onChange={(e) => patchParams(one, { accent: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={css.field}>
                    <span className={css.label}>Шрифт</span>
                    <select
                      className={css.select}
                      value={(one.params.font as string) || ''}
                      onChange={(e) => patchParams(one, { font: e.target.value || undefined })}
                    >
                      <option value="">как у страницы</option>
                      {project.fonts.map((f) => (
                        <option key={f.key} value={`var(--font-${f.key})`}>
                          {f.stack.split(',')[0].replace(/"/g, '')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={css.row2}>
                    <NumberField
                      label="Кегль, px"
                      value={(one.params.size as number) ?? 0}
                      min={0}
                      onChange={(v) => patchParams(one, { size: v || undefined }, `bs:${one.id}`)}
                    />
                    <NumberField
                      label="Промежуток, px"
                      value={(one.params.gap as number) ?? 0}
                      min={0}
                      onChange={(v) => patchParams(one, { gap: v || undefined }, `bg:${one.id}`)}
                    />
                  </div>

                  {one.block === 'rsvp' && (
                    <div className={css.field}>
                      <span className={css.label}>Надпись на кнопке</span>
                      <input
                        className={css.input}
                        value={(one.params.submitLabel as string) || ''}
                        placeholder="Отправить"
                        onChange={(e) =>
                          patchParams(one, { submitLabel: e.target.value }, `bl:${one.id}`)
                        }
                      />
                    </div>
                  )}

                  <p className={css.hint}>
                    Содержимое блока правит пара в кабинете — студия задаёт только место,
                    размер и палитру.
                  </p>
                </div>
              )}

              {one.kind === 'text' && (
                <div className={css.group}>
                  <div className={css.groupTitle}>Текст</div>
                  <div className={css.row2}>
                    <div className={css.field}>
                      <span className={css.label}>Тег</span>
                      <select
                        className={css.select}
                        value={one.tag}
                        onChange={(e) => patchLayer(one.id, { tag: e.target.value })}
                      >
                        <option value="h1">h1 — главный заголовок</option>
                        <option value="h2">h2 — заголовок</option>
                        <option value="h3">h3 — подзаголовок</option>
                        <option value="p">p — абзац</option>
                        <option value="span">span — строка</option>
                      </select>
                    </div>
                    <div className={css.field}>
                      <span className={css.label}>Выключка</span>
                      <select
                        className={css.select}
                        value={one.align}
                        onChange={(e) => patchLayer(one.id, { align: e.target.value })}
                      >
                        <option value="left">влево</option>
                        <option value="center">по центру</option>
                        <option value="right">вправо</option>
                      </select>
                    </div>
                  </div>

                  <div className={css.field}>
                    <span className={css.label}>Шрифт</span>
                    <select
                      className={css.select}
                      value={one.font}
                      onChange={(e) => patchLayer(one.id, { font: e.target.value })}
                    >
                      {project.fonts.map((f) => (
                        <option key={f.key} value={`var(--font-${f.key})`}>
                          {f.stack.split(',')[0].replace(/"/g, '')}
                        </option>
                      ))}
                      <option value="var(--font-body, serif)">по умолчанию</option>
                      {/* Шрифт из импорта может не совпасть ни с одним пунктом —
                          тогда список выглядел бы пустым и сбивал с толку. */}
                      {!project.fonts.some((f) => `var(--font-${f.key})` === one.font) &&
                        one.font !== 'var(--font-body, serif)' && (
                          <option value={one.font}>
                            {one.font.split(',')[0].replace(/["']/g, '')} — из импорта
                          </option>
                        )}
                    </select>
                  </div>

                  <div className={css.row2}>
                    <NumberField
                      label="Кегль, px"
                      value={one.size}
                      min={1}
                      onChange={(v) => patchLayer(one.id, { size: Math.max(1, v) }, `fs:${one.id}`)}
                    />
                    <NumberField
                      label="Интерлиньяж"
                      value={one.lineHeight}
                      step={0.05}
                      min={0.5}
                      onChange={(v) => patchLayer(one.id, { lineHeight: v }, `lh:${one.id}`)}
                    />
                  </div>

                  <NumberField
                    label="Трекинг, px"
                    value={one.tracking}
                    step={0.1}
                    onChange={(v) => patchLayer(one.id, { tracking: v }, `tr:${one.id}`)}
                  />

                  <div className={css.field}>
                    <span className={css.label}>Цвет</span>
                    <div className={css.colorRow}>
                      <input
                        className={css.colorWell}
                        type="color"
                        value={one.color}
                        onChange={(e) =>
                          patchLayer(one.id, { color: e.target.value }, `col:${one.id}`)
                        }
                        aria-label="Цвет текста"
                      />
                      <input
                        className={`${css.input} ${css.mono}`}
                        value={one.color}
                        onChange={(e) => patchLayer(one.id, { color: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={css.field}>
                    <span className={css.label}>Тень</span>
                    <input
                      className={`${css.input} ${css.mono}`}
                      value={one.shadow ?? ''}
                      placeholder="0 1px 3px rgba(0,0,0,.4)"
                      onChange={(e) =>
                        patchLayer(one.id, { shadow: e.target.value || undefined }, `sh:${one.id}`)
                      }
                    />
                  </div>
                </div>
              )}

              {one.kind === 'image' && (
                <div className={css.group}>
                  <div className={css.groupTitle}>Картинка</div>
                  <div className={css.field}>
                    <span className={css.label}>Вписывание</span>
                    <select
                      className={css.select}
                      value={one.fit}
                      onChange={(e) => patchLayer(one.id, { fit: e.target.value })}
                    >
                      <option value="cover">заполнить рамку</option>
                      <option value="contain">вместить целиком</option>
                      <option value="fill">растянуть</option>
                    </select>
                  </div>
                  {one.fit === 'cover' && (
                    <div className={css.row2}>
                      <NumberField
                        label="Кадр по X, %"
                        value={Math.round((one.crop?.x ?? 0.5) * 100)}
                        min={0}
                        max={100}
                        step={5}
                        onChange={(v) =>
                          patchLayer(
                            one.id,
                            {
                              crop: {
                                x: Math.min(1, Math.max(0, v / 100)),
                                y: one.crop?.y ?? 0.5,
                              },
                            },
                            `cropx:${one.id}`,
                          )
                        }
                      />
                      <NumberField
                        label="Кадр по Y, %"
                        value={Math.round((one.crop?.y ?? 0.5) * 100)}
                        min={0}
                        max={100}
                        step={5}
                        onChange={(v) =>
                          patchLayer(
                            one.id,
                            {
                              crop: {
                                x: one.crop?.x ?? 0.5,
                                y: Math.min(1, Math.max(0, v / 100)),
                              },
                            },
                            `cropy:${one.id}`,
                          )
                        }
                      />
                    </div>
                  )}
                  <NumberField
                    label="Скругление, px"
                    value={one.radius}
                    min={0}
                    onChange={(v) => patchLayer(one.id, { radius: Math.max(0, v) }, `r:${one.id}`)}
                  />

                  {project.assets.find((a) => a.id === one.assetId)?.kind === 'svg' && (
                    <div className={css.field}>
                      <span className={css.label}>Перекрасить вектор</span>
                      <div className={css.colorRow}>
                        <input
                          className={css.colorWell}
                          type="color"
                          value={one.tint ?? '#000000'}
                          onChange={(e) =>
                            patchLayer(one.id, { tint: e.target.value }, `tint:${one.id}`)
                          }
                          aria-label="Цвет вектора"
                        />
                        <button
                          type="button"
                          className={css.btn}
                          onClick={() => patchLayer(one.id, { tint: undefined })}
                          disabled={!one.tint}
                        >
                          Свои цвета
                        </button>
                      </div>
                    </div>
                  )}

                  {project.assets.find((a) => a.id === one.assetId)?.kind === 'svg' && (
                    <>
                      <button
                        type="button"
                        className={css.btn}
                        onClick={() => void explodeSvgLayer(one.id)}
                      >
                        Разобрать SVG на слои
                      </button>
                      <p className={css.hint}>
                        Экспорт из Canva приходит одним файлом. Группы внутри него станут
                        отдельными слоями — координаты берутся числами из файла.
                      </p>
                    </>
                  )}

                  <label className={`${css.btn} ${css.fileBtn}`}>
                    Заменить файл
                    <input
                      type="file"
                      accept="image/*,.svg"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void replaceLayerAsset(one.id, file);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  <div className={css.field}>
                    <span className={css.label}>Подпись для читалок</span>
                    <input
                      className={css.input}
                      value={one.alt}
                      onChange={(e) => patchLayer(one.id, { alt: e.target.value }, `alt:${one.id}`)}
                    />
                  </div>
                </div>
              )}

              {one.kind === 'shape' && (
                <div className={css.group}>
                  <div className={css.groupTitle}>Фигура</div>
                  <div className={css.field}>
                    <span className={css.label}>Заливка</span>
                    <div className={css.colorRow}>
                      <input
                        className={css.colorWell}
                        type="color"
                        value={one.fill}
                        onChange={(e) =>
                          patchLayer(one.id, { fill: e.target.value }, `fill:${one.id}`)
                        }
                        aria-label="Цвет заливки"
                      />
                      <input
                        className={`${css.input} ${css.mono}`}
                        value={one.fill}
                        onChange={(e) => patchLayer(one.id, { fill: e.target.value })}
                      />
                    </div>
                  </div>
                  {one.shape === 'rect' && (
                    <NumberField
                      label="Скругление, px"
                      value={one.radius}
                      min={0}
                      onChange={(v) => patchLayer(one.id, { radius: Math.max(0, v) }, `r:${one.id}`)}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ─── секция ───────────────────────────────────────────────────────── */}

      {tab === 'section' &&
        (section ? (
          <>
            <div className={css.group}>
              <div className={css.groupTitle}>Секция</div>
              <div className={css.field}>
                <label className={css.label} htmlFor="sec-name">
                  Название
                </label>
                <input
                  id="sec-name"
                  className={css.input}
                  value={section.name}
                  onChange={(e) => renameSection(section.id, e.target.value)}
                />
              </div>
            </div>

            <div className={css.group}>
              <div className={css.groupTitle}>Высота</div>
              <div className={css.field}>
                <select
                  className={css.select}
                  value={section.height.mode}
                  onChange={(e) =>
                    setSectionHeight(
                      section.id,
                      e.target.value === 'auto' ? { mode: 'auto' } : { mode: 'ratio', value: 1.6 },
                    )
                  }
                >
                  <option value="ratio">Пропорция к ширине</option>
                  <option value="auto">По содержимому</option>
                </select>
              </div>

              {section.height.mode === 'ratio' && (
                <div className={css.row2}>
                  <NumberField
                    label="Коэффициент"
                    value={section.height.value}
                    step={0.05}
                    min={0.2}
                    max={6}
                    onChange={(v) =>
                      setSectionHeight(section.id, {
                        mode: 'ratio',
                        value: Math.min(6, Math.max(0.2, v)),
                      })
                    }
                  />
                  <div className={css.field}>
                    <span className={css.label}>Итого, px</span>
                    <input
                      className={`${css.input} ${css.mono}`}
                      value={Math.round(sectionHeightPx(section, project.canvas.width))}
                      disabled
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={css.group}>
              <div className={css.groupTitle}>Края</div>
              <label className={css.checkRow}>
                <input
                  type="checkbox"
                  checked={section.clip !== false}
                  onChange={(e) => setSectionClip(section.id, e.target.checked)}
                />
                Обрезать по краям секции
              </label>
              <p className={css.hint}>
                Снимите, если рамка или узор нарочно шире холста и должны выходить
                за него — как в «Пожеланиях» у «Калл».
              </p>
            </div>

            <div className={css.group}>
              <div className={css.groupTitle}>Фон</div>
              <div className={css.colorRow}>
                <input
                  className={css.colorWell}
                  type="color"
                  value={section.background.color || '#ffffff'}
                  onChange={(e) => setSectionBackground(section.id, e.target.value)}
                  aria-label="Цвет фона секции"
                />
                <input
                  className={`${css.input} ${css.mono}`}
                  value={section.background.color || '#ffffff'}
                  onChange={(e) => setSectionBackground(section.id, e.target.value)}
                />
              </div>
            </div>
          </>
        ) : (
          <div className={css.group}>
            <p className={css.hint}>Выберите секцию в списке слева или на холсте.</p>
          </div>
        ))}

      {/* ─── файлы шаблона ────────────────────────────────────────────────── */}

      {tab === 'files' && (
        <>
          <div className={css.group}>
            <div className={css.groupTitle}>Картинки — {project.assets.length}</div>
            {!project.assets.length && (
              <p className={css.hint}>
                Пусто. Перетащите фото прямо в окно редактора — там, где отпустите,
                появится слой.
              </p>
            )}
            {project.assets.map((asset) => {
              const used = project.sections.reduce(
                (count, section) =>
                  count +
                  section.layers.filter((l) => l.kind === 'image' && l.assetId === asset.id)
                    .length +
                  (section.background.image === asset.id ? 1 : 0),
                0,
              );
              return (
                <div key={asset.id} className={css.assetRow}>
                  {asset.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={css.assetThumb} src={asset.thumb} alt="" />
                  ) : (
                    <span className={css.assetThumb} />
                  )}
                  <span className={css.assetInfo}>
                    <span className={css.secName}>{asset.file}</span>
                    <span className={css.secMeta}>
                      {asset.w}×{asset.h} · {formatBytes(asset.bytes)} ·{' '}
                      {used ? `в макете: ${used}` : 'не используется'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={css.rowBtn}
                    title="Удалить файл из шаблона"
                    onClick={() => void removeAsset(asset.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className={css.group}>
            <div className={css.groupTitle}>Шрифты — {project.fonts.length}</div>
            {project.fonts.map((font) => (
              <div key={font.key} className={css.assetRow}>
                <span
                  className={css.assetThumb}
                  style={{
                    fontFamily: font.stack,
                    fontSize: 20,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  Аа
                </span>
                <span className={css.assetInfo}>
                  <span className={css.secName}>
                    {font.stack.split(',')[0].replace(/"/g, '')}
                  </span>
                  <span className={css.secMeta}>
                    {font.source === 'google' ? 'Google' : `файл: ${font.files?.join(', ')}`}
                  </span>
                </span>
                <button
                  type="button"
                  className={css.rowBtn}
                  title="Убрать шрифт"
                  onClick={() => removeFont(font.key)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            <div className={css.field}>
              <span className={css.label}>Добавить шрифт Google</span>
              <div className={css.fontAdd}>
                <input
                  className={css.input}
                  value={googleFamily}
                  placeholder="Marck Script"
                  onChange={(e) => setGoogleFamily(e.target.value)}
                />
                <button
                  type="button"
                  className={css.btn}
                  disabled={!googleFamily.trim()}
                  onClick={() => {
                    addGoogleFont(googleFamily.trim());
                    setGoogleFamily('');
                  }}
                >
                  Добавить
                </button>
              </div>
            </div>

            <div className={css.field}>
              <span className={css.label}>Загрузить свой файл шрифта</span>
              <input
                className={css.input}
                value={fontFamily}
                placeholder="Название семейства, напр. Anastasia Script"
                onChange={(e) => setFontFamily(e.target.value)}
              />
              <label className={`${css.btn} ${css.fileBtn}`}>
                Выбрать .woff2 / .ttf
                <input
                  type="file"
                  accept=".woff2,.woff,.ttf,.otf"
                  hidden
                  disabled={!fontFamily.trim()}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void addFontFile(file, fontFamily.trim());
                    setFontFamily('');
                    e.target.value = '';
                  }}
                />
              </label>
              <p className={css.hint}>
                В списке шрифтов слоя видно только то, что подключено здесь, — иначе
                текст на холсте и в готовом шаблоне рисовался бы разными шрифтами.
              </p>
            </div>
          </div>
        </>
      )}

      {/* ─── шаблон ───────────────────────────────────────────────────────── */}

      {tab === 'project' && (
        <>
          <div className={css.group}>
            <div className={css.groupTitle}>Холст</div>
            <div className={css.field}>
              <span className={css.label}>Эталонная ширина</span>
              <div className={css.widthChoice}>
                {CANVAS_PRESETS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={`${css.chip} ${project.canvas.width === w ? css.chipOn : ''}`}
                    onClick={() => setCanvasWidth(w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <p className={css.hint}>
              Координаты хранятся в пикселях от этой ширины. На экспорте они станут
              контейнерными единицами, поэтому макет масштабируется на любой экран.
            </p>
          </div>

          <div className={css.group}>
            <div className={css.groupTitle}>Карточка в галерее</div>
            <div className={css.field}>
              <label className={css.label} htmlFor="cat-name">
                Название
              </label>
              <input
                id="cat-name"
                className={css.input}
                value={project.catalog.name}
                onChange={(e) => patchCatalog({ name: e.target.value })}
              />
            </div>
            <div className={css.field}>
              <label className={css.label} htmlFor="cat-desc">
                Описание
              </label>
              <textarea
                id="cat-desc"
                className={css.textarea}
                value={project.catalog.description}
                onChange={(e) => patchCatalog({ description: e.target.value })}
                placeholder="Чем этот шаблон отличается от остальных"
              />
            </div>
            <div className={css.field}>
              <label className={css.label} htmlFor="cat-tags">
                Теги, через запятую
              </label>
              <input
                id="cat-tags"
                className={css.input}
                value={project.catalog.tags.join(', ')}
                onChange={(e) =>
                  patchCatalog({
                    tags: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <div className={css.row2}>
              <div className={css.field}>
                <label className={css.label} htmlFor="cat-bride">
                  Имя невесты
                </label>
                <input
                  id="cat-bride"
                  className={css.input}
                  value={project.catalog.sampleBride}
                  onChange={(e) => patchCatalog({ sampleBride: e.target.value })}
                />
              </div>
              <div className={css.field}>
                <label className={css.label} htmlFor="cat-groom">
                  Имя жениха
                </label>
                <input
                  id="cat-groom"
                  className={css.input}
                  value={project.catalog.sampleGroom}
                  onChange={(e) => patchCatalog({ sampleGroom: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className={css.group}>
            <div className={css.groupTitle}>Файлы</div>
            <p className={`${css.hint} ${css.mono}`}>public/invite/{project.slug}/</p>
          </div>
        </>
      )}
    </aside>
  );
}
