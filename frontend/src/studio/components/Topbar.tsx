'use client';

import { useState } from 'react';
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  PackageCheck,
  X,
  Loader2,
  Eye,
  MousePointer2,
  Type,
  Square,
  Circle,
  LayoutList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useStudio, Tool } from '../store';
import { openPreview } from '../export/preview';
import css from '../studio.module.css';

/** Вписать холст умеет только сам вьюпорт — он знает свой размер. */
export const FIT_EVENT = 'studio:fit';

const TOOLS: { id: Tool; Icon: typeof Type; title: string }[] = [
  { id: 'select', Icon: MousePointer2, title: 'Выделение (V)' },
  { id: 'text', Icon: Type, title: 'Текст (T)' },
  { id: 'rect', Icon: Square, title: 'Прямоугольник (R)' },
  { id: 'ellipse', Icon: Circle, title: 'Овал (O)' },
  { id: 'block', Icon: LayoutList, title: 'Блок — программа, отсчёт, анкета (B)' },
];

export default function Topbar() {
  const project = useStudio((s) => s.project);
  const dirty = useStudio((s) => s.dirty);
  const saving = useStudio((s) => s.saving);
  const past = useStudio((s) => s.past);
  const future = useStudio((s) => s.future);
  const view = useStudio((s) => s.view);
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const zoomTo = useStudio((s) => s.zoomTo);
  const saveProject = useStudio((s) => s.saveProject);
  const exportProject = useStudio((s) => s.exportProject);
  const closeProject = useStudio((s) => s.closeProject);

  const [exporting, setExporting] = useState(false);

  if (!project) return null;

  const runExport = async (confirmHandmade = false) => {
    setExporting(true);
    try {
      const { url, shipped } = await exportProject(confirmHandmade);

      if (shipped?.pushed) {
        toast.success(
          `Шаблон собран и отправлен на сайт (${shipped.commit}). ` +
            'Сервер подхватит его в течение минуты.',
          { duration: 8000 },
        );
        return;
      }

      /* Предохранитель не спрашивает, а отказывает: пересборка поверх
         рукописного шаблона стоила бы ему всей начинки. */
      if (shipped && !shipped.ok && shipped.note?.includes('рукописный шаблон')) {
        toast.error(shipped.note, { duration: 12000 });
        return;
      }

      toast.success(
        `Шаблон собран: ${url}index.html` + (shipped?.note ? ` — ${shipped.note}` : ''),
        { duration: 8000 },
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const save = async () => {
    try {
      await saveProject();
      toast.success('Проект сохранён');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const close = () => {
    if (dirty && !confirm('Есть несохранённые изменения. Закрыть проект?')) return;
    closeProject();
  };

  return (
    <header className={css.top}>
      <div className={css.brand}>
        <span className={css.brandMark}>◲</span>
        <span>Верстак</span>
      </div>

      <span className={css.projectName}>{project.catalog.name || project.slug}</span>
      <span className={css.projectSlug}>/{project.slug}</span>
      {dirty && <span className={css.dirtyDot} title="Есть несохранённые изменения" />}

      <div className={css.tools}>
        {TOOLS.map(({ id, Icon, title }) => (
          <button
            key={id}
            type="button"
            className={`${css.iconBtn} ${tool === id ? css.iconBtnOn : ''}`}
            onClick={() => setTool(id)}
            title={title}
            aria-label={title}
            aria-pressed={tool === id}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>

      <span className={css.spacer} />

      <div className={css.tools}>
        <button
          type="button"
          className={css.iconBtn}
          onClick={undo}
          disabled={!past.length}
          title={past.length ? `Отменить: ${past[past.length - 1].label}` : 'Отменять нечего'}
          aria-label="Отменить"
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className={css.iconBtn}
          onClick={redo}
          disabled={!future.length}
          title={future.length ? `Повторить: ${future[0].label}` : 'Повторять нечего'}
          aria-label="Повторить"
        >
          <Redo2 size={15} />
        </button>
      </div>

      <div className={css.tools}>
        <button
          type="button"
          className={css.iconBtn}
          onClick={() => zoomTo(view.zoom / 1.25)}
          title="Отдалить"
          aria-label="Отдалить"
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          className={css.zoomLabel}
          onClick={() => zoomTo(1)}
          title="Масштаб 100% (Ctrl+1)"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {Math.round(view.zoom * 100)}%
        </button>
        <button
          type="button"
          className={css.iconBtn}
          onClick={() => zoomTo(view.zoom * 1.25)}
          title="Приблизить"
          aria-label="Приблизить"
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          className={css.iconBtn}
          onClick={() => window.dispatchEvent(new CustomEvent(FIT_EVENT))}
          title="Вписать холст (Ctrl+0)"
          aria-label="Вписать холст"
        >
          <Maximize2 size={15} />
        </button>
      </div>

      <button
        type="button"
        className={`${css.btn} ${dirty ? css.btnPrimary : ''}`}
        onClick={save}
        disabled={saving || !dirty}
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? 'Сохраняю' : dirty ? 'Сохранить' : 'Сохранено'}
      </button>

      <button
        type="button"
        className={css.btn}
        onClick={() => {
          openPreview(project).catch((e: Error) => toast.error(e.message));
        }}
        title="Открыть страницу в соседней вкладке — как её увидит гость"
      >
        <Eye size={14} />
        Превью
      </button>

      <button type="button" className={css.btn} onClick={() => runExport()} disabled={exporting}>
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
        Экспорт
      </button>

      <button type="button" className={css.iconBtn} onClick={close} title="Закрыть проект">
        <X size={15} />
      </button>
    </header>
  );
}
