'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './FeatureDemo.module.css';

/* «Как это работает»: пять вкладок, в каждой — короткая анимированная сцена
   с курсором, как живая запись экрана. Сцены нарисованы разметкой (а не
   видео): чёткие на любом экране и почти ничего не весят.

   Сцена рисуется на холсте 640×440 и масштабируется под ширину блока.
   Шаги меняются прокруткой: слева список шагов, по центру сцена стоит на
   месте (sticky), справа прокручиваются пункты — какой пересекает середину
   экрана, тот и активен, его сцена проигрывается. Пока блок не на экране —
   всё стоит. При «уменьшении движения» сцена сразу показывает итоговый кадр. */

const W = 640, H = 440;
const IMG = '/landing/demo';

// ─── Таймлайн сцены ──────────────────────────────────────────────────────
/** Номер шага: шаг i+1 наступает через times[i] мс после старта сцены. */
function useSteps(times: readonly number[], play: boolean, still: boolean): number {
  const [step, setStep] = useState(still ? times.length : 0);
  useEffect(() => {
    if (still) { setStep(times.length); return; }
    if (!play) return;
    setStep(0);
    const ids = times.map((t, i) => setTimeout(() => setStep(i + 1), t));
    return () => ids.forEach(clearTimeout);
  }, [play, still, times]);
  return step;
}

/** Печатает текст по букве, пока active; после done — сразу целиком. */
function useTyped(text: string, active: boolean, done: boolean, speed = 75): string {
  const [n, setN] = useState(done ? text.length : 0);
  useEffect(() => {
    if (done) { setN(text.length); return; }
    if (!active) { setN(0); return; }
    let i = 0;
    const id = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(id); }, speed);
    return () => clearInterval(id);
  }, [active, done, text, speed]);
  return text.slice(0, n);
}

/** Центры элементов с data-t="имя" в координатах холста — курсор целится
    в настоящие кнопки, а не в подобранные вручную числа. */
function useTargets(root: React.RefObject<HTMLDivElement | null>): (name: string, fallback: number[]) => number[] {
  const [map, setMap] = useState<Record<string, number[]>>({});
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const k = r.width / W || 1;
      const next: Record<string, number[]> = {};
      el.querySelectorAll<HTMLElement>('[data-t]').forEach(n => {
        const b = n.getBoundingClientRect();
        next[n.dataset.t!] = [(b.left - r.left + b.width / 2) / k, (b.top - r.top + b.height / 2) / k];
      });
      setMap(next);
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
  }, [root]);
  return (name, fallback) => map[name] || fallback;
}

/** Курсор: едет к точке за 0,65 с; click меняется — рисуем круг нажатия. */
function Cursor({ x, y, click, hidden }: { x: number; y: number; click: number; hidden?: boolean }) {
  return (
    <div className={styles.cursor} style={{ transform: `translate(${x}px, ${y}px)`, opacity: hidden ? 0 : 1 }}>
      {click > 0 && <span key={click} className={styles.cursorRing} />}
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 2l15 11.5-6.6 1.1 3.9 7.2-3 1.6-3.9-7.3L4 20z" fill="#fff" stroke="#1d1b18" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

type SceneProps = { play: boolean; still: boolean };

/** Слой сцены на весь холст — от него меряются цели курсора. */
const Layer = ({ r, children }: { r: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }) =>
  <div ref={r} className={styles.layer}>{children}</div>;

// ─── 1. Редактор ─────────────────────────────────────────────────────────
const EDITOR_T = [600, 1300, 2600, 3100, 4300, 4900, 5900, 6500] as const;
function EditorScene({ play, still }: SceneProps) {
  const s = useSteps(EDITOR_T, play, still);
  const root = useRef<HTMLDivElement>(null);
  const t = useTargets(root);
  const names = useTyped('Анна & Илья', s >= 2, s >= 3, 80);
  const date = useTyped('12 · 06 · 2027', s >= 4, s >= 5, 55);
  const cover = s >= 8 ? 3 : s >= 6 ? 2 : 1;
  const cur = s >= 7 ? t('thumb3', [292, 338]) : s >= 5 ? t('thumb2', [200, 338]) : s >= 3 ? t('date', [210, 200]) : s >= 1 ? t('names', [210, 122]) : [560, 410];
  const click = s >= 8 ? 4 : s >= 6 ? 3 : s >= 4 ? 2 : s >= 2 ? 1 : 0;

  return (
    <Layer r={root}>
      <div className={styles.card} style={{ left: 30, top: 28, width: 300, height: 384 }}>
        <div className={styles.cardHead}>
          <span className={styles.dots}><i /><i /><i /></span>
          Редактор приглашения
        </div>
        <label className={styles.fieldLabel} style={{ top: 64 }}>Имена пары</label>
        <div data-t="names" className={`${styles.input} ${s >= 2 && s < 3 ? styles.inputFocus : ''}`} style={{ top: 86 }}>
          {names || <span className={styles.placeholder}>Например, Анна & Илья</span>}
          {s >= 2 && s < 3 && <span className={styles.caret} />}
        </div>
        <label className={styles.fieldLabel} style={{ top: 144 }}>Дата свадьбы</label>
        <div data-t="date" className={`${styles.input} ${s >= 4 && s < 5 ? styles.inputFocus : ''}`} style={{ top: 166 }}>
          {date || <span className={styles.placeholder}>дд · мм · гггг</span>}
          {s >= 4 && s < 5 && <span className={styles.caret} />}
        </div>
        <label className={styles.fieldLabel} style={{ top: 224 }}>Обложка</label>
        {[1, 2, 3].map((n, i) => (
          <div
            key={n}
            data-t={`thumb${n}`}
            className={`${styles.thumb} ${cover === n ? styles.thumbOn : ''}`}
            style={{ left: 20 + i * 92, top: 248, backgroundImage: `url(${IMG}/cover-${n}.webp)` }}
          />
        ))}
      </div>

      <Phone left={398} top={14} width={206}>
        {[1, 2, 3].map(n => (
          <div key={n} className={styles.cover} style={{ backgroundImage: `url(${IMG}/cover-${n}.webp)`, opacity: cover === n ? 1 : 0 }} />
        ))}
        <div className={styles.coverShade} />
        <div className={styles.coverText}>
          <div className={styles.coverKicker}>приглашение на свадьбу</div>
          <div className={styles.coverNames}>{names || 'Ваши имена'}</div>
          <div className={styles.coverDate}>{date || 'дата свадьбы'}</div>
        </div>
      </Phone>

      <Cursor x={cur[0]} y={cur[1]} click={click} />
    </Layer>
  );
}

// ─── 2. Анкета гостя ─────────────────────────────────────────────────────
const RSVP_T = [700, 1300, 2000, 2500, 3200, 3700, 4400, 5000] as const;
function RsvpScene({ play, still }: SceneProps) {
  const s = useSteps(RSVP_T, play, still);
  const root = useRef<HTMLDivElement>(null);
  const t = useTargets(root);
  const yes = s >= 2, count = s >= 4 ? 2 : 1, wine = s >= 6, sent = s >= 8;
  const cur = s >= 7 ? t('send', [175, 382]) : s >= 5 ? t('wine', [180, 300]) : s >= 3 ? t('plus', [231, 238]) : s >= 1 ? t('yes', [170, 152]) : [420, 420];
  const click = s >= 8 ? 4 : s >= 6 ? 3 : s >= 4 ? 2 : s >= 2 ? 1 : 0;

  return (
    <Layer r={root}>
      <Phone left={66} top={10} width={214} light>
        <div className={styles.form}>
          <div className={styles.formTitle}>Анкета гостя</div>
          <div className={styles.formInput}>Мария Кузнецова</div>
          <div className={styles.formQ}>Вы придёте?</div>
          <div data-t="yes" className={`${styles.formOpt} ${yes ? styles.formOptOn : ''}`}>Да, с радостью</div>
          <div className={styles.formOpt}>К сожалению, не смогу</div>
          <div className={styles.formQ}>Сколько вас будет?</div>
          <div className={styles.stepper}><span>−</span><b>{count}</b><span data-t="plus" className={s >= 3 && s < 5 ? styles.press : ''}>+</span></div>
          <div className={styles.formQ}>Что будете пить?</div>
          <div className={styles.chips}>
            <span>Игристое</span><span data-t="wine" className={wine ? styles.chipOn : ''}>Белое вино</span><span>Без алкоголя</span>
          </div>
          <div data-t="send" className={styles.formBtn}>Отправить</div>
        </div>
        <div className={`${styles.thanks} ${sent ? styles.thanksOn : ''}`}>
          <div className={styles.thanksIcon}>✓</div>
          <div className={styles.thanksTitle}>Спасибо, Мария!</div>
          <div className={styles.thanksText}>Ждём вас 12 июня</div>
        </div>
      </Phone>

      <div className={styles.card} style={{ left: 336, top: 120, width: 268, height: 200 }}>
        <div className={styles.cardHead}>Ответ гостя</div>
        <div className={styles.summary}>
          <Row label="Гость" value="Мария Кузнецова" on />
          <Row label="Придёт" value={yes ? (count > 1 ? `да, ${count} человека` : 'да') : '—'} on={yes} />
          <Row label="Напитки" value={wine ? 'белое вино' : '—'} on={wine} />
          <Row label="Статус" value={sent ? 'отправлено паре ✓' : 'заполняет…'} on={sent} />
        </div>
      </div>

      <Cursor x={cur[0]} y={cur[1]} click={click} />
    </Layer>
  );
}

function Row({ label, value, on }: { label: string; value: string; on: boolean }) {
  return (
    <div className={styles.row}>
      <span>{label}</span>
      <b className={on ? styles.rowOn : ''}>{value}</b>
    </div>
  );
}

// ─── 3. Ответы в Telegram ────────────────────────────────────────────────
const TG_T = [600, 1000, 2600, 3000, 4600, 5000] as const;
const TG_MSGS = [
  { guest: 'Мария Кузнецова', status: '✅ Придут — 2 человека', extra: '🥂 Напитки: белое вино' },
  { guest: 'Олег Смирнов', status: '❌ Не придёт', extra: '💌 Пожелания: Счастья вам!' },
  { guest: 'Анна и Пётр', status: '✅ Придут — 2 человека', extra: '🥂 Напитки: игристое' },
];
const TG_STATS = [[24, 3, 18], [26, 3, 16], [26, 4, 15], [28, 4, 13]];
function TelegramScene({ play, still }: SceneProps) {
  const s = useSteps(TG_T, play, still);
  const shown = s >= 5 ? 3 : s >= 3 ? 2 : s >= 1 ? 1 : 0;
  const stat = TG_STATS[s >= 6 ? 3 : s >= 4 ? 2 : s >= 2 ? 1 : 0];
  const total = 45;

  return (
    <>
      <div className={`${styles.card} ${styles.tg}`} style={{ left: 30, top: 18, width: 312, height: 404 }}>
        <div className={styles.tgHead}>
          <span className={styles.tgAva}>WC</span>
          <div><b>WeddingCraft</b><small>бот</small></div>
        </div>
        <div className={styles.tgBody}>
          {TG_MSGS.slice(0, shown).map(m => (
            <div key={m.guest} className={styles.tgMsg}>
              <div className={styles.tgMsgTitle}>Новый ответ на приглашение (Илья & Анна)</div>
              <div>👤 Гость: {m.guest}</div>
              <div>{m.status}</div>
              <div>{m.extra}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.card} style={{ left: 372, top: 78, width: 238, height: 270 }}>
        <div className={styles.cardHead}>Ответы гостей</div>
        <div className={styles.stats}>
          <Stat label="Придут" value={stat[0]} color="#6b8f5c" total={total} />
          <Stat label="Не придут" value={stat[1]} color="#b5645a" total={total} />
          <Stat label="Ждём ответа" value={stat[2]} color="#c9a96e" total={total} />
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, color, total }: { label: string; value: number; color: string; total: number }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statTop}><span>{label}</span><b key={value} className={styles.statNum}>{value}</b></div>
      <div className={styles.bar}><i style={{ width: `${(value / total) * 100}%`, background: color }} /></div>
    </div>
  );
}

// ─── 4. Рассадка ─────────────────────────────────────────────────────────
const SEAT_T = [600, 1200, 1300, 2300, 3200, 3800, 3900, 4900] as const;
const TABLE = { cx: 452, cy: 222, r: 128 };
const SEATS = ['Елена Ф.', 'Игорь Л.', 'Ксения Б.', '', 'Пётр Н.', 'Дарья В.', 'Сергей М.', ''];
const seatPos = (i: number) => {
  const a = (-90 + i * 45) * Math.PI / 180;
  return [TABLE.cx + TABLE.r * Math.cos(a), TABLE.cy + TABLE.r * Math.sin(a)];
};
function SeatingScene({ play, still }: SceneProps) {
  const s = useSteps(SEAT_T, play, still);
  const first = s >= 4, second = s >= 8;
  const seats = SEATS.map((n, i) => (i === 3 && first ? 'Мария К.' : i === 7 && second ? 'Олег С.' : n));
  const filled = seats.filter(Boolean).length;
  const list = [!first && 'Мария Кузнецова', !second && 'Олег Смирнов', 'Анна Петрова'].filter(Boolean) as string[];
  const [s3x, s3y] = seatPos(3), [s7x, s7y] = seatPos(7);
  const chip1: [number, number] = [118, 118], chip2: [number, number] = [118, 160];
  const cur: number[] =
    s >= 7 ? [s7x, s7y] : s >= 5 ? (list.length === 2 ? [chip1[0], chip1[1]] : chip2) :
    s >= 3 ? [s3x, s3y] : s >= 1 ? chip1 : [600, 420];
  const dragging = (s >= 2 && s < 4) || (s >= 6 && s < 8);
  const click = s >= 6 ? 2 : s >= 2 ? 1 : 0;

  return (
    <>
      <div className={styles.card} style={{ left: 22, top: 60, width: 200, height: 252 }}>
        <div className={styles.cardHead}>Без места · {list.length}</div>
        <div className={styles.waitList}>
          {list.map(n => <div key={n} className={styles.waitChip}>{n}</div>)}
        </div>
      </div>

      <div className={styles.table} style={{ left: TABLE.cx - 64, top: TABLE.cy - 64 }}>
        <b>Стол 1</b><span>{filled}/8</span>
      </div>
      {seats.map((n, i) => {
        const [x, y] = seatPos(i);
        return (
          <div key={i} className={`${styles.seat} ${n ? '' : styles.seatFree} ${(i === 3 && first) || (i === 7 && second) ? styles.seatNew : ''}`}
            style={{ left: x - 52, top: y - 15 }}>
            {n || 'свободно'}
          </div>
        );
      })}

      {dragging && (
        <div className={styles.dragChip} style={{ transform: `translate(${cur[0] - 44}px, ${cur[1] - 12}px)` }}>
          {s < 4 ? 'Мария К.' : 'Олег С.'}
        </div>
      )}
      <Cursor x={cur[0]} y={cur[1]} click={click} />
    </>
  );
}

// ─── 5. Именные ссылки ───────────────────────────────────────────────────
const LINKS_T = [700, 1400, 2200, 4200, 4800, 5400] as const;
const GUESTS = [
  { name: 'Бабушка Валя', status: 'ответила ✓', greet: 'Дорогая бабушка Валя!' },
  { name: 'Ирина и Сергей Петровы', status: 'ждём ответа', greet: 'Дорогие Ирина и Сергей!' },
  { name: 'Олег Смирнов', status: 'ответил ✓', greet: '' },
  { name: 'Коллеги Анны', status: 'ждём ответа', greet: '' },
];
function LinksScene({ play, still }: SceneProps) {
  const s = useSteps(LINKS_T, play, still);
  const root = useRef<HTMLDivElement>(null);
  const t = useTargets(root);
  const who = s >= 6 ? 1 : s >= 3 ? 0 : -1;
  const toast = (s >= 2 && s < 3) || (s >= 5 && s < 6);
  const cur = s >= 4 ? t('copy1', [336, 168]) : s >= 1 ? t('copy0', [336, 118]) : [600, 420];
  const click = s >= 5 ? 2 : s >= 2 ? 1 : 0;

  return (
    <Layer r={root}>
      <div className={styles.card} style={{ left: 22, top: 26, width: 350, height: 344 }}>
        <div className={styles.cardHead}>Гости · 48</div>
        <div className={styles.guests}>
          {GUESTS.map((g, i) => (
            <div key={g.name} className={styles.guest}>
              <div><b>{g.name}</b><small className={g.status.includes('✓') ? styles.ok : ''}>{g.status}</small></div>
              <span data-t={`copy${i}`} className={styles.copyBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                ссылка
              </span>
            </div>
          ))}
        </div>
        <div className={`${styles.toast} ${toast ? styles.toastOn : ''}`}>Ссылка скопирована</div>
      </div>

      <Phone left={410} top={14} width={200} hiddenUntil={who >= 0}>
        <div className={styles.cover} style={{ backgroundImage: `url(${IMG}/cover-1.webp)`, height: '46%' }} />
        <div className={styles.letter}>
          <div className={styles.letterGreet} key={who}>{who >= 0 ? GUESTS[who].greet : ''}</div>
          <p>Мы будем счастливы видеть вас на нашей свадьбе</p>
          <div className={styles.letterDate}>12 · 06 · 2027</div>
        </div>
      </Phone>

      <Cursor x={cur[0]} y={cur[1]} click={click} />
    </Layer>
  );
}

// ─── Телефон-рамка для сцен ──────────────────────────────────────────────
function Phone({ left, top, width, light, hiddenUntil, children }: {
  left: number; top: number; width: number; light?: boolean; hiddenUntil?: boolean; children: React.ReactNode;
}) {
  const hidden = hiddenUntil === false;
  return (
    <div className={`${styles.phone} ${hidden ? styles.phoneHidden : ''}`} style={{ left, top, width, height: width * 1.95 }}>
      <div className={`${styles.phoneScreen} ${light ? styles.phoneLight : ''}`}>{children}</div>
    </div>
  );
}

// ─── Шаги ─────────────────────────────────────────────────────────────
const SCENES = [
  { tab: 'Редактор', lead: 'Редактор без регистрации.', text: 'Меняйте имена, дату, фото и музыку — приглашение обновляется на глазах.', plan: '', ms: 8200, Scene: EditorScene },
  { tab: 'Анкета гостя', lead: 'Гости отвечают за минуту.', text: 'Придут ли, сколько их, что будут пить — без приложений и звонков.', plan: 'Премиум', ms: 7400, Scene: RsvpScene },
  { tab: 'Ответы в Telegram', lead: 'Ответы сразу у вас.', text: 'Каждый ответ приходит в Telegram и на почту, а в кабинете — сводка: кто придёт, кто нет.', plan: 'Премиум', ms: 7600, Scene: TelegramScene },
  { tab: 'Рассадка', lead: 'Рассадка без таблиц.', text: 'Перетащите гостей по столам — план зала и карточки на столы можно распечатать.', plan: 'Максимум', ms: 7400, Scene: SeatingScene },
  { tab: 'Именные ссылки', lead: 'Каждому — своё приглашение.', text: 'Отдельная ссылка с личным обращением для каждого гостя, и видно, кто уже ответил.', plan: 'Премиум', ms: 7600, Scene: LinksScene },
];

export default function FeatureDemo() {
  const [tab, setTab] = useState(0);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const [scale, setScale] = useState(1);
  const [viewW, setViewW] = useState(W);
  const viewRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const blockRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.05 });
    if (sectionRef.current) io.observe(sectionRef.current);
    const el = viewRef.current;
    const ro = new ResizeObserver(() => { if (el) { setScale(Math.min(1.3, el.clientWidth / W)); setViewW(el.clientWidth); } });
    if (el) ro.observe(el);
    return () => { io.disconnect(); ro.disconnect(); };
  }, []);

  // Шаг меняется прокруткой: активен пункт, который пересекает середину экрана.
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const i = blockRefs.current.indexOf(e.target as HTMLElement);
        if (i >= 0) setTab(i);
      });
    // на телефоне верх экрана занимает липкая сцена — линия ниже неё
    }, { rootMargin: window.matchMedia('(max-width: 900px)').matches ? '-66% 0px -34% 0px' : '-50% 0px -50% 0px' });
    blockRefs.current.forEach(b => b && io.observe(b));
    return () => io.disconnect();
  }, []);

  // Клик по шагу слева — прокрутить к его пункту (сцена сменится сама).
  const go = (i: number) => {
    const b = blockRefs.current[i];
    if (!b) return;
    const r = b.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - window.innerHeight / 2, behavior: still ? 'auto' : 'smooth' });
  };
  const Scene = SCENES[tab].Scene;

  return (
    <section id="how" ref={sectionRef} className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <span className={styles.label}>Как это работает</span>
          <h2 className={styles.title}>Всё для приглашения — <em>в одном сервисе</em></h2>
        </div>

        <div className={styles.scroller}>
          <nav className={styles.steps} aria-label="Возможности WeddingCraft">
            {SCENES.map((sc, i) => (
              <button key={sc.tab} type="button" aria-current={i === tab ? 'step' : undefined}
                className={`${styles.step} ${i === tab ? styles.stepOn : ''}`} onClick={() => go(i)}>
                <span className={styles.stepNum}>0{i + 1}</span>
                <span className={styles.stepName}>{sc.tab}</span>
              </button>
            ))}
          </nav>

          <div className={styles.stage} aria-hidden="true">
            <div className={styles.view} ref={viewRef} style={{ height: H * scale }}>
              <div className={styles.canvas} style={{ width: W, height: H, left: Math.max(0, (viewW - W * scale) / 2), transform: `scale(${scale})` }}>
                <Scene key={tab} play={inView} still={still} />
              </div>
            </div>
          </div>

          <div className={styles.blocks}>
            {SCENES.map((sc, i) => (
              <article key={sc.tab} ref={el => { blockRefs.current[i] = el; }}
                className={`${styles.block} ${i === tab ? styles.blockOn : ''}`}>
                <span className={styles.blockNum}>0{i + 1}</span>
                <h3 className={styles.blockTitle}>{sc.lead}</h3>
                <p className={styles.copyText}>{sc.text}</p>
                {sc.plan && <span className={styles.plan}>Тариф «{sc.plan}»</span>}
                {i === SCENES.length - 1 && <Link href="/templates" className={styles.cta}>Попробовать бесплатно</Link>}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
