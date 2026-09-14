'use client';

/* Корень студии: раскладка из четырёх зон и общие горячие клавиши. */

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useStudio, syncTokenCookie } from './store';
import { useProjectFonts } from './useProjectFonts';
import Topbar, { FIT_EVENT } from './components/Topbar';
import SectionsPanel from './components/SectionsPanel';
import CanvasViewport from './components/CanvasViewport';
import Inspector from './components/Inspector';
import StartScreen from './components/StartScreen';
import css from './studio.module.css';

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable === true;
};

export default function StudioApp() {
  const project = useStudio((s) => s.project);
  const dirty = useStudio((s) => s.dirty);

  useProjectFonts(project);

  /* Пароль, сохранённый в прошлый раз, кладём и в cookie: импорт грузит
     страницу в iframe, а тот заголовки не отправляет. */
  useEffect(() => {
    syncTokenCookie();
  }, []);

  /* Студия занимает весь экран — страница под ней не должна прокручиваться. */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /* Ctrl+V: скриншот или картинка из буфера ложится слоем без сохранения в файл. */
  useEffect(() => {
    if (!project) return;
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const files = [...(e.clipboardData?.items ?? [])]
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((f): f is File => !!f);
      if (!files.length) return;

      e.preventDefault();
      const store = useStudio.getState();
      const section =
        store.project?.sections.find((s) => s.id === store.activeSectionId) ??
        store.project?.sections[0];
      if (!section) return;
      store.dropOnSection(files, section.id).catch((err: Error) => toast.error(err.message));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [project]);

  /*
   * Любой щелчок мимо редактируемого текста сначала снимает с него фокус.
   * Без этого клик по холсту успевал снять выделение, узел исчезал вместе с
   * набранным, и текст терялся.
   */
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (!active?.isContentEditable) return;
      if (active.contains(e.target as Node)) return;
      active.blur();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, []);

  /* Не терять несохранённое по случайному закрытию вкладки. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (!project) return;

    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const store = useStudio.getState();

      /*
       * Клавиши сверяем по code, а не по key: на русской раскладке та же
       * физическая клавиша даёт «я», и сравнение с 'z' не срабатывало —
       * отмена молча не работала.
       */
      const code = e.code;

      if (mod && code === 'KeyZ') {
        if (isTyping(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && code === 'KeyY') {
        if (isTyping(e.target)) return;
        e.preventDefault();
        store.redo();
        return;
      }
      if (mod && code === 'KeyS') {
        e.preventDefault();
        if (!store.dirty || store.saving) return;
        store
          .saveProject()
          .then(() => toast.success('Проект сохранён'))
          .catch((err: Error) => toast.error(err.message));
        return;
      }
      if (mod && code === 'Digit0') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(FIT_EVENT));
        return;
      }
      if (mod && code === 'Digit1') {
        e.preventDefault();
        store.zoomTo(1);
        return;
      }

      if (isTyping(e.target)) return;

      if (mod && code === 'KeyD') {
        e.preventDefault();
        store.duplicateSelection();
        return;
      }
      if (mod && code === 'KeyG') {
        e.preventDefault();
        if (e.shiftKey) store.ungroupSelection();
        else store.groupSelection();
        return;
      }
      if (mod && (code === 'BracketRight' || code === 'BracketLeft')) {
        e.preventDefault();
        const up = code === 'BracketRight';
        store.selection.forEach((id) => store.reorderLayer(id, up ? 1 : -1));
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!store.selection.length) return;
        e.preventDefault();
        store.deleteSelection();
        return;
      }
      if (e.key === 'Escape') {
        store.clearSelection();
        store.setTool('select');
        return;
      }
      if (e.key.startsWith('Arrow') && store.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        store.nudgeSelection(dx, dy);
        return;
      }
      if (!mod && !e.altKey) {
        if (code === 'KeyV') store.setTool('select');
        if (code === 'KeyT') store.setTool('text');
        if (code === 'KeyR') store.setTool('rect');
        if (code === 'KeyO') store.setTool('ellipse');
        if (code === 'KeyB') store.setTool('block');
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project]);

  if (!project) return <StartScreen />;

  return (
    <div className={css.shell}>
      <Topbar />
      <SectionsPanel />
      <CanvasViewport />
      <Inspector />
    </div>
  );
}
