'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import RingsLoader from '@/components/RingsLoader';

/* Загрузка редактора на всё окно (27.11.26: «загрузка будет не только у окна
   симулятора редактора, а всего окна вместе с редактором»). Раньше кольца
   крутились только поверх сайта слева, а шапка и настройки справа появлялись
   сразу, недогруженными. Теперь, пока открывается экран редактора — анкета
   «Расскажите о вашей свадьбе» или сам редактор, — его целиком закрывает та же
   загрузка «бесконечность → кольца» (components/RingsLoader.tsx, вид cover), и
   экран показывается весь сразу, когда в окне слева готов сайт.

   Когда закрывает:
   · открыли /editor — с первой отрисовки, ещё до React (скрипт в разметке);
   · сменился экран: «Продолжить» в анкете, «Имена и дата», крестик анкеты,
     вход в аккаунт (редактор строится заново) — enter();
   другое устройство в переключателе — только окно сайта, как раньше (своя
   загрузка в SitePreview).

   Кольца складываются, когда (1) данные приглашения на месте — hold(false):
   черновик проверен, вход выяснен, готовое приглашение (?id=) пришло с сервера,
   иначе шаблон в окне ещё сменится, — и (2) сайт в окне ответил (wc:ready);
   тает загрузка, когда iframe догрузился (load). Об окне сообщает SitePreview —
   report(). Пока эта загрузка на экране, SitePreview своей не рисует. Запас —
   в движке: через 10 с перестаёт ждать. */

interface EditorBootApi {
  /** Загрузка на всё окно сейчас закрывает экран */
  covering: boolean;
  /** Открылся новый экран редактора — закрыть его, пока сайт в окне не готов */
  enter: () => void;
  /** Данные приглашения ещё грузятся: рано складывать кольца */
  hold: (on: boolean) => void;
  /** Сайт в окне текущего экрана: ready — шаблон ответил, settled — догрузился */
  report: (ready: boolean, settled: boolean) => void;
}

const EditorBootContext = createContext<EditorBootApi | null>(null);

/** null — вне редактора (там своей загрузки на всё окно нет) */
export const useEditorBoot = () => useContext(EditorBootContext);

const IDLE = { ready: false, settled: false };

export default function EditorBoot({ children }: { children: ReactNode }) {
  // key — новый экран, новая загрузка с начала
  const [cover, setCover] = useState({ key: 0, on: true });
  // Пока редактор не сказал, что данные на месте, — ждём
  const [held, setHeld] = useState(true);
  const [site, setSite] = useState(IDLE);

  const enter = useCallback(() => {
    // Готовность прошлого экрана не в счёт: в том же кадре окно сайта уже другое
    setSite(s => (s.ready || s.settled ? IDLE : s));
    setCover(c => (c.on ? c : { key: c.key + 1, on: true }));
  }, []);
  const hold = useCallback((on: boolean) => setHeld(on), []);
  const report = useCallback((ready: boolean, settled: boolean) => {
    setSite(s => (s.ready === ready && s.settled === settled ? s : { ready, settled }));
  }, []);
  const done = useCallback(() => setCover(c => (c.on ? { ...c, on: false } : c)), []);

  const api = useMemo(() => ({ covering: cover.on, enter, hold, report }), [cover.on, enter, hold, report]);
  return (
    <EditorBootContext.Provider value={api}>
      {cover.on && (
        <RingsLoader key={cover.key} cover ready={!held && site.ready} settled={!held && site.settled} onDone={done} />
      )}
      {children}
    </EditorBootContext.Provider>
  );
}
