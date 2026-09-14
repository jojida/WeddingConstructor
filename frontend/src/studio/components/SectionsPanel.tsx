'use client';

/* Левая панель: секции и их слои. Порядок в списке — порядок в разметке,
   поэтому верхний слой на холсте показан последним, как в вёрстке. */

import { useState } from 'react';
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Type,
  Image as ImageIcon,
  Square,
  Layers as LayersIcon,
  Copy,
  AlertCircle,
  CheckCircle2,
  Link2,
  Link2Off,
} from 'lucide-react';
import { useStudio } from '../store';
import { Layer, sectionHeightPx } from '../types';
import { validate } from '../validate';
import css from '../studio.module.css';

const LAYER_ICON = {
  text: Type,
  image: ImageIcon,
  shape: Square,
  block: LayersIcon,
  group: LayersIcon,
} as const;

export default function SectionsPanel() {
  const project = useStudio((s) => s.project);
  const activeSectionId = useStudio((s) => s.activeSectionId);
  const selection = useStudio((s) => s.selection);
  const setActiveSection = useStudio((s) => s.setActiveSection);
  const addSection = useStudio((s) => s.addSection);
  const moveSection = useStudio((s) => s.moveSection);
  const removeSection = useStudio((s) => s.removeSection);
  const select = useStudio((s) => s.select);
  const toggleSelect = useStudio((s) => s.toggleSelect);
  const setLayerFlag = useStudio((s) => s.setLayerFlag);
  const renameLayer = useStudio((s) => s.renameLayer);
  const reorderLayer = useStudio((s) => s.reorderLayer);
  const layerToEdge = useStudio((s) => s.layerToEdge);
  const groupSelection = useStudio((s) => s.groupSelection);
  const ungroupSelection = useStudio((s) => s.ungroupSelection);
  const duplicateSelection = useStudio((s) => s.duplicateSelection);
  const deleteSelection = useStudio((s) => s.deleteSelection);

  const dropOnSection = useStudio((s) => s.dropOnSection);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  if (!project) return null;

  const issues = validate(project);
  const activeIndex = project.sections.findIndex((s) => s.id === activeSectionId);
  const activeSection = project.sections[activeIndex] ?? null;

  const layerRow = (layer: Layer, index: number) => {
    const Icon = LAYER_ICON[layer.kind];
    const picked = selection.includes(layer.id);
    return (
      <div
        key={layer.id}
        className={`${css.layerRow} ${picked ? css.layerRowActive : ''}`}
        onClick={(e) => (e.shiftKey ? toggleSelect(layer.id) : select([layer.id]))}
        onDoubleClick={() => setRenaming(layer.id)}
      >
        {layer.groupId ? (
          <Link2 size={13} className={css.layerIcon} />
        ) : (
          <Icon size={13} className={css.layerIcon} />
        )}
        {renaming === layer.id ? (
          <input
            className={`${css.input} ${css.layerRename}`}
            defaultValue={layer.name}
            autoFocus
            onBlur={(e) => {
              renameLayer(layer.id, e.target.value.trim() || layer.name);
              setRenaming(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setRenaming(null);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={css.secName} style={layer.hidden ? { opacity: 0.45 } : undefined}>
            {layer.name}
          </span>
        )}
        <span className={css.secMeta}>{index + 1}</span>
        <button
          type="button"
          className={css.rowBtn}
          title={layer.locked ? 'Разблокировать' : 'Заблокировать'}
          onClick={(e) => {
            e.stopPropagation();
            setLayerFlag(layer.id, 'locked', !layer.locked);
          }}
        >
          {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
        <button
          type="button"
          className={css.rowBtn}
          title={layer.hidden ? 'Показать' : 'Скрыть'}
          onClick={(e) => {
            e.stopPropagation();
            setLayerFlag(layer.id, 'hidden', !layer.hidden);
          }}
        >
          {layer.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      </div>
    );
  };

  return (
    <aside className={css.left}>
      <div className={css.panelHead}>
        <span>Секции и слои</span>
        <span className={css.spacer} />
        <button
          type="button"
          className={css.iconBtn}
          onClick={addSection}
          title="Добавить секцию"
          aria-label="Добавить секцию"
        >
          <Plus size={15} />
        </button>
      </div>

      <div className={css.panelBody}>
        {project.sections.map((section, i) => {
          const isActive = section.id === activeSectionId;
          return (
            <div key={section.id}>
              <button
                type="button"
                className={`${css.secRow} ${isActive ? css.secRowActive : ''} ${
                  dropTarget === section.id ? css.secRowDrop : ''
                }`}
                onClick={() => setActiveSection(section.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  setDropTarget(section.id);
                }}
                onDragLeave={() => setDropTarget((t) => (t === section.id ? null : t))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTarget(null);
                  const files = [...e.dataTransfer.files].filter(
                    (f) => f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.svg'),
                  );
                  if (files.length) void dropOnSection(files, section.id);
                }}
              >
                <span className={css.secIndex}>{String(i + 1).padStart(2, '0')}</span>
                <span className={css.secName}>{section.name}</span>
                <span className={css.secMeta}>
                  {section.height.mode === 'auto'
                    ? 'авто'
                    : Math.round(sectionHeightPx(section, project.canvas.width))}
                </span>
              </button>

              {isActive && (
                <div className={css.layerList}>
                  {section.layers.length === 0 && (
                    <p className={css.emptyHint} style={{ padding: '6px 10px 8px' }}>
                      Слоёв нет. T — текст, R — прямоугольник, O — овал.
                    </p>
                  )}
                  {section.layers
                    .map((layer, index) => ({ layer, index }))
                    .reverse()
                    .map(({ layer, index }) => layerRow(layer, index))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!!selection.length && (
        <div className={css.group}>
          <div className={css.groupTitle}>Выбранные слои</div>
          <div className={css.widthChoice}>
            <button
              type="button"
              className={css.btn}
              onClick={() => selection.forEach((id) => reorderLayer(id, 1))}
              title="Выше по слоям (Ctrl+])"
            >
              <ChevronUp size={14} /> Выше
            </button>
            <button
              type="button"
              className={css.btn}
              onClick={() => selection.forEach((id) => reorderLayer(id, -1))}
              title="Ниже по слоям (Ctrl+[)"
            >
              <ChevronDown size={14} /> Ниже
            </button>
            <button
              type="button"
              className={css.btn}
              onClick={() => selection.forEach((id) => layerToEdge(id, 'front'))}
            >
              На самый верх
            </button>
            <button
              type="button"
              className={css.btn}
              onClick={() => selection.forEach((id) => layerToEdge(id, 'back'))}
            >
              В самый низ
            </button>
            <button
              type="button"
              className={css.btn}
              onClick={groupSelection}
              disabled={selection.length < 2}
              title="Связать слои (Ctrl+G)"
            >
              <Link2 size={14} /> Связать
            </button>
            <button
              type="button"
              className={css.btn}
              onClick={ungroupSelection}
              title="Разорвать связку (Ctrl+Shift+G)"
            >
              <Link2Off size={14} /> Развязать
            </button>
            <button type="button" className={css.btn} onClick={duplicateSelection}>
              <Copy size={14} /> Дубликат
            </button>
            <button type="button" className={css.btn} onClick={deleteSelection}>
              <Trash2 size={14} /> Удалить
            </button>
          </div>
        </div>
      )}

      <div className={css.group}>
        <div className={css.groupTitle}>
          Проверка{issues.length ? ` — ${issues.length}` : ''}
        </div>
        {!issues.length && (
          <p className={css.hint}>
            <CheckCircle2 size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
            Замечаний нет
          </p>
        )}
        {issues.slice(0, 12).map((issue, i) => (
          <button
            key={`${issue.text}-${i}`}
            type="button"
            className={`${css.issueRow} ${issue.level === 'error' ? css.issueError : ''}`}
            onClick={() => {
              if (issue.layerId) select([issue.layerId]);
              if (issue.sectionId) setActiveSection(issue.sectionId);
            }}
          >
            <AlertCircle size={12} />
            <span>{issue.text}</span>
          </button>
        ))}
        {issues.length > 12 && (
          <p className={css.hint}>…и ещё {issues.length - 12}</p>
        )}
      </div>

      {activeSection && (
        <div className={css.group}>
          <div className={css.groupTitle}>Секция</div>
          <div className={css.widthChoice}>
            <button
              type="button"
              className={css.btn}
              disabled={activeIndex <= 0}
              onClick={() => moveSection(activeSection.id, -1)}
            >
              <ChevronUp size={14} /> Выше
            </button>
            <button
              type="button"
              className={css.btn}
              disabled={activeIndex >= project.sections.length - 1}
              onClick={() => moveSection(activeSection.id, 1)}
            >
              <ChevronDown size={14} /> Ниже
            </button>
            <button
              type="button"
              className={css.btn}
              disabled={project.sections.length <= 1}
              onClick={() => removeSection(activeSection.id)}
            >
              <Trash2 size={14} /> Удалить
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
