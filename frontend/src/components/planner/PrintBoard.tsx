'use client';
import { useEffect, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { errorText, plural, type PlannerSnapshot } from '@/lib/planner';
import type { PlannerCtl } from './usePlanner';
import styles from './planner.module.css';

type Kind = 'cards' | 'tents' | 'poster' | 'alpha' | 'menu' | 'wishes' | 'list' | 'summary';
type Poster = 'a3' | 'a2' | 'a1';
interface PrintInfo { themes: { id: string; title: string; accent: string }[]; theme: string; menuText: string }

const MENU_LIMIT = 3000;
const POSTERS: [Poster, string][] = [['a3', 'A3 — 30 × 42 см'], ['a2', 'A2 — 42 × 59 см'], ['a1', 'A1 — 59 × 84 см']];
const draftKey = (inviteId: string) => `wc_print_menu_${inviteId}`;

/** Ошибка скачивания приходит Blob'ом (ждали файл) — достаём из него текст сервера. */
async function downloadError(e: unknown): Promise<string> {
  const data = (e as { response?: { data?: unknown } })?.response?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { error?: unknown };
      if (typeof parsed.error === 'string' && parsed.error) return parsed.error;
    } catch { /* не JSON */ }
    return 'Не получилось собрать файл. Попробуйте ещё раз';
  }
  return errorText(e);
}

/* ── Схематичный эскиз документа ──────────────────────────────────────────── */
function Thumb({ kind, color }: { kind: Kind; color: string }) {
  const bar = (x: number, y: number, w: number, key: string | number, o = 0.5) =>
    <rect key={key} x={x} y={y} width={w} height={1.6} rx={0.8} fill={color} opacity={o} />;
  let body: ReactNode = null;
  switch (kind) {
    case 'cards':
      body = Array.from({ length: 10 }, (_, i) => (
        <g key={i}>
          <rect x={4 + (i % 2) * 16.5} y={5 + Math.floor(i / 2) * 10.2} width={15} height={8.8} rx={0.8} fill="none" stroke={color} strokeWidth={0.6} strokeDasharray="1.4 1" />
          {bar(7.5 + (i % 2) * 16.5, 8.8 + Math.floor(i / 2) * 10.2, 8, `n${i}`, 0.75)}
        </g>
      ));
      break;
    case 'tents':
      body = (
        <>
          <line x1={3} y1={30} x2={37} y2={30} stroke={color} strokeWidth={0.6} strokeDasharray="1.6 1.2" />
          <text x={20} y={50} fontSize={15} textAnchor="middle" fill={color} fontFamily="Georgia, serif">5</text>
          <text x={20} y={50} fontSize={15} textAnchor="middle" fill={color} fontFamily="Georgia, serif" transform="rotate(180 20 30)">5</text>
        </>
      );
      break;
    case 'poster':
      body = (
        <>
          {bar(11, 6, 18, 'h', 0.8)}
          {Array.from({ length: 9 }, (_, i) => (
            <g key={i}>
              <rect x={4 + (i % 3) * 11} y={13 + Math.floor(i / 3) * 15} width={10} height={13.5} rx={0.6} fill="none" stroke={color} strokeWidth={0.5} />
              {[0, 1, 2, 3].map((r) => bar(6 + (i % 3) * 11, 16.5 + Math.floor(i / 3) * 15 + r * 2.6, 6, `${i}-${r}`, 0.4))}
            </g>
          ))}
        </>
      );
      break;
    case 'alpha':
      body = (
        <>
          {bar(11, 6, 18, 'h', 0.8)}
          {Array.from({ length: 30 }, (_, i) => bar(4 + Math.floor(i / 15) * 17, 13 + (i % 15) * 2.9, 11 + ((i * 7) % 4), i, 0.45))}
        </>
      );
      break;
    case 'menu':
      body = (
        <>
          <rect x={10} y={3} width={20} height={54} rx={1} fill="none" stroke={color} strokeWidth={0.6} />
          {bar(15, 9, 10, 'h', 0.85)}
          {[18, 21.5, 25, 32, 35.5, 39, 46, 49.5].map((y, i) => bar(i === 3 || i === 6 ? 16 : 13.5, y, i === 3 || i === 6 ? 8 : 13, y, i === 3 || i === 6 ? 0.8 : 0.4))}
        </>
      );
      break;
    case 'wishes':
      body = (
        <>
          <line x1={20} y1={3} x2={20} y2={57} stroke={color} strokeWidth={0.5} strokeDasharray="1.4 1" />
          <line x1={3} y1={30} x2={37} y2={30} stroke={color} strokeWidth={0.5} strokeDasharray="1.4 1" />
          {[0, 1, 2, 3].map((q) => [0, 1, 2, 3, 4].map((r) => bar(4 + (q % 2) * 18, 10 + Math.floor(q / 2) * 27 + r * 3.4, 14, `${q}-${r}`, 0.35)))}
        </>
      );
      break;
    case 'list':
      body = (
        <>
          {bar(5, 6, 16, 'h', 0.85)}
          {Array.from({ length: 14 }, (_, i) => (i % 5 === 0 ? bar(5, 12 + i * 3.1, 12, i, 0.8) : bar(7, 12 + i * 3.1, 13 + ((i * 5) % 9), i, 0.4)))}
        </>
      );
      break;
    case 'summary':
      body = (
        <>
          {bar(5, 6, 16, 'h', 0.85)}
          {Array.from({ length: 8 }, (_, r) => (
            <g key={r}>
              <line x1={4} y1={15 + r * 4.4} x2={36} y2={15 + r * 4.4} stroke={color} strokeWidth={0.3} opacity={0.6} />
              {bar(5, 12.6 + r * 4.4, 9, `t${r}`, 0.45)}
              {[0, 1, 2].map((c) => bar(19 + c * 6.5, 12.6 + r * 4.4, 2.5, `${r}-${c}`, 0.6))}
            </g>
          ))}
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 40 60" width={40} height={60} className={styles.thumb} aria-hidden>
      <rect x={0.5} y={0.5} width={39} height={59} rx={2} fill="#fff" stroke="rgba(206,197,186,0.9)" />
      {body}
    </svg>
  );
}

/* ── Карточка документа ───────────────────────────────────────────────────── */
function DocCard({ kind, color, title, text, meta, blocked, busy, onDownload, children }: {
  kind: Kind; color: string; title: string; text: string; meta?: string; blocked?: string;
  busy: boolean; onDownload: () => void; children?: ReactNode;
}) {
  return (
    <section className={styles.printCard}>
      <div className={styles.printHead}>
        <Thumb kind={kind} color={color} />
        <div className={styles.grow}>
          <h4 className={styles.printTitle}>{title}</h4>
          <p className={styles.hint} style={{ margin: '2px 0 0' }}>{text}</p>
          {meta && <p className={styles.printMeta}>{meta}</p>}
        </div>
      </div>
      {children}
      <div className={styles.printFoot}>
        {blocked
          ? <span className={styles.hint}>{blocked}</span>
          : (
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy} onClick={onDownload} aria-busy={busy}>
              {busy ? 'Собираем…' : 'Скачать PDF'}
            </button>
          )}
      </div>
    </section>
  );
}

/* ── Вкладка «Печать» ─────────────────────────────────────────────────────── */
export default function PrintBoard({ planner, snap }: { planner: PlannerCtl; snap: PlannerSnapshot }) {
  const { inviteId } = planner;
  const [info, setInfo] = useState<PrintInfo | null>(null);
  const [failed, setFailed] = useState<'' | 'error' | 'plan'>('');
  const [attempt, setAttempt] = useState(0);
  const [theme, setTheme] = useState('');
  const [busy, setBusy] = useState<Kind | null>(null);
  const [cardsMenu, setCardsMenu] = useState(false);
  const [posterSize, setPosterSize] = useState<Poster>('a3');
  const [alphaSize, setAlphaSize] = useState<Poster>('a3');
  const [menuSize, setMenuSize] = useState<'a5' | 'dl'>('a5');
  const [menuText, setMenuText] = useState('');
  const [listDiet, setListDiet] = useState(false);
  const [summaryDiet, setSummaryDiet] = useState(false);

  useEffect(() => {
    let live = true;
    api.get<PrintInfo>(`/api/planner/${inviteId}/print`)
      .then((res) => {
        if (!live) return;
        let draft: string | null = null;
        try { draft = localStorage.getItem(draftKey(inviteId)); } catch { /* приватный режим */ }
        setInfo(res.data);
        setTheme(res.data.theme);
        setMenuText(draft ?? res.data.menuText);
        setFailed('');
      })
      .catch((e) => {
        if (!live) return;
        const r = (e as { response?: { status?: number; data?: { code?: string } } }).response;
        setFailed(r?.status === 403 && r.data?.code === 'plan' ? 'plan' : 'error');
      });
    return () => { live = false; };
  }, [inviteId, attempt]);

  if (failed === 'plan') return <div className={styles.note}>Печатные материалы недоступны на вашем тарифе.</div>;
  if (failed) {
    return (
      <div className={styles.note}>
        Не удалось открыть печать. <button type="button" className={styles.link} onClick={() => { setFailed(''); setAttempt((n) => n + 1); }}>Повторить</button>
      </div>
    );
  }
  if (!info) return <div className={styles.note}>Готовим печать…</div>;

  const accent = info.themes.find((t) => t.id === theme)?.accent ?? '#685d4a';
  const tableIds = new Set(snap.tables.map((t) => t.id));
  const seated = snap.persons.filter((p) => !p.excluded && p.status !== 'no' && p.tableId && tableIds.has(p.tableId));
  const named = seated.filter((p) => p.name.trim());
  const unnamed = seated.length - named.length;
  const listed = snap.persons.filter((p) => !p.excluded && p.status !== 'no');
  const busyTables = new Set(seated.map((p) => p.tableId)).size;
  const sheets = Math.ceil(seated.length / 10);
  const noSeats = 'Пока никто не сидит за столами — рассадите гостей на вкладке «Рассадка».';

  const download = async (kind: Kind, body: Record<string, unknown>, file: string) => {
    setBusy(kind);
    try {
      const res = await api.post(`/api/planner/${inviteId}/print/${kind}`, { theme, ...body }, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = file;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      toast.error(await downloadError(e));
      void planner.refresh();   // рассадку могли поменять с другого устройства — пересчитать цифры на карточках
    } finally {
      setBusy(null);
    }
  };

  const editMenu = (value: string) => {
    setMenuText(value);
    try { localStorage.setItem(draftKey(inviteId), value); } catch { /* приватный режим */ }
  };
  const resetMenu = () => {
    setMenuText(info.menuText);
    try { localStorage.removeItem(draftKey(inviteId)); } catch { /* приватный режим */ }
  };

  const sizeSelect = (value: Poster, set: (v: Poster) => void, label: string) => (
    <label className={styles.printOption}>
      <span className={styles.hint}>Размер</span>
      <select className={styles.select} value={value} onChange={(e) => set(e.target.value as Poster)} aria-label={label}>
        {POSTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );

  return (
    <div>
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Оформление</h3>
        <div className={styles.chips} role="radiogroup" aria-label="Оформление">
          {info.themes.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={theme === t.id}
              className={`${styles.chip} ${theme === t.id ? styles.chipOn : ''}`} onClick={() => setTheme(t.id)}>
              <span className={styles.swatch} style={{ background: t.accent }} aria-hidden /> {t.title}
              {t.id === info.theme && <span style={{ opacity: 0.75 }}> · как у сайта</span>}
            </button>
          ))}
        </div>
        <p className={styles.hint} style={{ margin: '10px 0 0' }}>
          Всё собирается из текущей рассадки и меню: пересадили гостя — скачайте файл заново.
          Пищевых ограничений в материалах для гостей нет; в служебные документы они попадают, только если отметить это галочкой.
        </p>
      </section>

      <h3 className={styles.printGroup}>Для гостей</h3>
      <div className={styles.printGrid}>
        <DocCard kind="cards" color={accent} title="Карточки гостей" busy={busy === 'cards'}
          text="Имя и стол — на каждое место. 10 карточек 85 × 55 мм на листе A4, с линиями реза."
          meta={seated.length ? `${seated.length} ${plural(seated.length, 'карточка', 'карточки', 'карточек')} · ${sheets} ${plural(sheets, 'лист', 'листа', 'листов')} A4` : undefined}
          blocked={seated.length ? undefined : noSeats}
          onDownload={() => download('cards', { menu: cardsMenu }, 'kartochki-gostey.pdf')}>
          {snap.options.length > 0 && (
            <label className={styles.check}><input type="checkbox" checked={cardsMenu} onChange={(e) => setCardsMenu(e.target.checked)} /> указать выбранное блюдо — официанту проще</label>
          )}
          {unnamed > 0 && seated.length > 0 && (
            <p className={styles.hint} style={{ margin: 0 }}>
              У {unnamed} {plural(unnamed, 'гостя', 'гостей', 'гостей')} нет имени — на {unnamed === 1 ? 'его карточке' : 'их карточках'} будет строка, чтобы вписать от руки.
            </p>
          )}
        </DocCard>

        <DocCard kind="tents" color={accent} title="Номера столов" busy={busy === 'tents'}
          text="Лист A5 на стол, сгибается «домиком» по пунктиру — номер видно с обеих сторон."
          meta={snap.tables.length ? `${snap.tables.length} ${plural(snap.tables.length, 'лист', 'листа', 'листов')} A5` : undefined}
          blocked={snap.tables.length ? undefined : 'Сначала добавьте столы на вкладке «Рассадка».'}
          onDownload={() => download('tents', {}, 'nomera-stolov.pdf')} />

        <DocCard kind="poster" color={accent} title="План рассадки" busy={busy === 'poster'}
          text="Плакат у входа: столы и кто за ними сидит. Кегль подбирается сам, имена не обрезаются."
          meta={seated.length ? `${busyTables} ${plural(busyTables, 'стол', 'стола', 'столов')} · ${seated.length} ${plural(seated.length, 'гость', 'гостя', 'гостей')}` : undefined}
          blocked={seated.length ? undefined : noSeats}
          onDownload={() => download('poster', { size: posterSize }, `plan-rassadki-${posterSize}.pdf`)}>
          {sizeSelect(posterSize, setPosterSize, 'Размер плана рассадки')}
        </DocCard>

        <DocCard kind="alpha" color={accent} title="Кто где сидит" busy={busy === 'alpha'}
          text="Плакат по алфавиту: гость находит своё имя и номер стола, не разглядывая весь план."
          meta={named.length ? `${named.length} ${plural(named.length, 'имя', 'имени', 'имён')}${unnamed ? ` · ${unnamed} ${plural(unnamed, 'гость', 'гостя', 'гостей')} без имени в список не ${unnamed === 1 ? 'попадёт' : 'попадут'}` : ''}` : undefined}
          blocked={named.length ? undefined : seated.length ? 'За столами пока только гости без имени — впишите имена на вкладке «Рассадка».' : noSeats}
          onDownload={() => download('alpha', { size: alphaSize }, `kto-gde-sidit-${alphaSize}.pdf`)}>
          {sizeSelect(alphaSize, setAlphaSize, 'Размер списка по алфавиту')}
        </DocCard>

        <DocCard kind="menu" color={accent} title="Меню на стол" busy={busy === 'menu'}
          text="Строка с двоеточием в конце — заголовок раздела («Горячее:»), пустая строка — отступ."
          blocked={menuText.trim() ? undefined : 'Напишите, что будет в меню.'}
          onDownload={() => download('menu', { text: menuText, size: menuSize }, `menu-${menuSize}.pdf`)}>
          <label className={styles.printOption}>
            <span className={styles.hint}>Формат</span>
            <select className={styles.select} value={menuSize} onChange={(e) => setMenuSize(e.target.value as 'a5' | 'dl')} aria-label="Формат меню">
              <option value="a5">A5 — 15 × 21 см, на стол</option>
              <option value="dl">Узкое 10 × 21 см — на тарелку</option>
            </select>
          </label>
          <textarea className={`${styles.input} ${styles.textarea}`} value={menuText} maxLength={MENU_LIMIT}
            onChange={(e) => editMenu(e.target.value)} aria-label="Текст меню" spellCheck />
          <div className={styles.row} style={{ justifyContent: 'space-between' }}>
            <span className={styles.hint}>{menuText.length} / {MENU_LIMIT}</span>
            {menuText !== info.menuText && <button type="button" className={styles.link} style={{ fontSize: 12 }} onClick={resetMenu}>Заполнить из вариантов блюд</button>}
          </div>
        </DocCard>

        <DocCard kind="wishes" color={accent} title="Бланки пожеланий" busy={busy === 'wishes'}
          text="4 открытки A6 на листе A4 — гости пишут пожелания, вы собираете их в альбом."
          onDownload={() => download('wishes', {}, 'blanki-pozhelaniy.pdf')} />
      </div>

      <h3 className={styles.printGroup}>Служебные</h3>
      <div className={styles.printGrid}>
        <DocCard kind="list" color={accent} title="Рассадка для организатора" busy={busy === 'list'}
          text="Столы по порядку, гости за ними и выбранные блюда. Для ведущего, координатора и администратора зала."
          meta={listed.length ? `${listed.length} ${plural(listed.length, 'человек', 'человека', 'человек')}` : undefined}
          blocked={listed.length ? undefined : 'Список гостей пока пуст.'}
          onDownload={() => download('list', { diet: listDiet }, listDiet ? 'rassadka-s-ogranicheniyami.pdf' : 'rassadka.pdf')}>
          <label className={styles.check}><input type="checkbox" checked={listDiet} onChange={(e) => setListDiet(e.target.checked)} /> добавить пищевые ограничения</label>
        </DocCard>

        <DocCard kind="summary" color={accent} title="Сводка для ресторана" busy={busy === 'summary'}
          text="Сколько придёт взрослых и детей и сколько каких блюд — по каждому столу и всего."
          onDownload={() => download('summary', { diet: summaryDiet }, summaryDiet ? 'svodka-s-ogranicheniyami.pdf' : 'svodka-dlya-restorana.pdf')}>
          <label className={styles.check}><input type="checkbox" checked={summaryDiet} onChange={(e) => setSummaryDiet(e.target.checked)} /> добавить пищевые ограничения</label>
        </DocCard>
      </div>
      {(listDiet || summaryDiet) && <p className={styles.hint}>Файлы с ограничениями передавайте только тем, кто готовит и обслуживает: это личные сведения гостей.</p>}

      <details className={styles.hidden}>
        <summary>Как печатать</summary>
        <ul className={styles.printTips}>
          <li>Печатайте в масштабе 100% («Фактический размер»), без «Подогнать под страницу» — иначе карточки не совпадут с линиями реза.</li>
          <li>Карточки и номера столов — на плотной бумаге 200–300 г/м²; режьте по пунктиру, номер стола сгибайте по пунктиру посередине.</li>
          <li>Плакаты A2 и A1 печатают в копицентре: файлы векторные, текст останется чётким при любом размере.</li>
          <li>Цвета подобраны для домашней и цифровой печати. Офсетной типографии нужны CMYK и вылеты под обрез — для неё эти файлы не подойдут.</li>
        </ul>
      </details>
    </div>
  );
}
