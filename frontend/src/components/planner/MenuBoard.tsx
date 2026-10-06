'use client';
import { useMemo, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  errorText, indexSnapshot, norm, personTitle, plural, STATUS_COLOR, STATUS_LABEL, tableTitle,
  type PlannerOption, type PlannerPerson, type PlannerSnapshot, type SnapshotIndex,
} from '@/lib/planner';
import type { PlannerCtl } from './usePlanner';
import { Modal } from './ui';
import styles from './planner.module.css';

/* ── Список людей за цифрой ───────────────────────────────────────────────── */
function PeopleDialog({ title, ids, index, showDiet, onClose }: { title: string; ids: string[]; index: SnapshotIndex; showDiet?: boolean; onClose: () => void }) {
  const people = ids.map((id) => index.personById.get(id)).filter((p): p is PlannerPerson => !!p);
  return (
    <Modal title={title} onClose={onClose} wide>
      {people.length === 0 ? <p className={styles.note}>Никого.</p> : (
        <div className={styles.pickScroll}>
          <ul className={styles.pickList}>
            {people.map((p) => {
              const party = index.partyByKey.get(p.partyKey);
              const table = p.tableId ? index.tableById.get(p.tableId) : undefined;
              const option = p.menuOptionId ? index.optionById.get(p.menuOptionId) : undefined;
              return (
                <li key={p.id} className={styles.pickItem} style={{ cursor: 'default', alignItems: 'flex-start' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ overflowWrap: 'anywhere' }}>{p.name || <span className={styles.unnamed}>{personTitle(p)}</span>}</span>
                    <span className={styles.pickSub} style={{ display: 'block', overflowWrap: 'anywhere' }}>
                      {[party?.label !== p.name ? party?.label : '', p.isChild ? 'ребёнок' : '', option ? option.label : p.menuReview ? 'блюдо: уточнить' : 'блюдо не выбрано'].filter(Boolean).join(' · ')}
                    </span>
                    {showDiet && p.diet && <span className={styles.pickSub} style={{ display: 'block', color: '#8a5a00', overflowWrap: 'anywhere' }}>⚠ {p.diet}</span>}
                  </span>
                  <span className={styles.pickSub} style={{ whiteSpace: 'nowrap' }}>{table ? tableTitle(table.name) : 'без стола'}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className={styles.dialogFoot}><button type="button" className={styles.btn} onClick={onClose}>Закрыть</button></div>
    </Modal>
  );
}

/* ── Удаление варианта, который уже выбрали ───────────────────────────────── */
function DeleteOptionDialog({ ctl, snap, option, holders, onClose }: { ctl: PlannerCtl; snap: PlannerSnapshot; option: PlannerOption; holders: number; onClose: () => void }) {
  const others = snap.options.filter((o) => o.id !== option.id);
  const [target, setTarget] = useState<string>(others[0]?.id ?? 'review');
  const submit = async () => {
    const query = holders > 0 ? `?reassignTo=${encodeURIComponent(target)}` : '';
    const r = await ctl.act('delete', `/menu/${option.id}${query}`);
    if (r.ok) { toast.success(`Вариант «${option.label}» удалён`); onClose(); }
  };
  return (
    <Modal title={`Удалить «${option.label}»?`} onClose={onClose}>
      {holders === 0 ? <p style={{ margin: 0 }}>Этот вариант ещё никто не выбрал.</p> : (
        <>
          <p style={{ marginTop: 0 }}>
            Его выбрали {holders} {plural(holders, 'гость', 'гостя', 'гостей')}. Их ответ не пропадёт — решите, что с ним сделать:
          </p>
          <div className={styles.row} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            {others.map((o) => (
              <label key={o.id} className={styles.check}>
                <input type="radio" name="reassign" checked={target === o.id} onChange={() => setTarget(o.id)} /> Перенести на «{o.label}»
              </label>
            ))}
            <label className={styles.check}>
              <input type="radio" name="reassign" checked={target === 'review'} onChange={() => setTarget('review')} /> Отметить «нужно уточнить» — спросите их сами
            </label>
          </div>
        </>
      )}
      <div className={styles.dialogFoot}>
        <button type="button" className={styles.btn} onClick={onClose} autoFocus>Отмена</button>
        <button type="button" className={`${styles.btn} ${styles.btnDanger}`} disabled={ctl.pending > 0} onClick={submit}>Удалить вариант</button>
      </div>
    </Modal>
  );
}

/* ── Вкладка «Меню» ───────────────────────────────────────────────────────── */
type Who = 'yes' | 'yesMaybe' | 'noChoice' | 'review' | 'diet';

export default function MenuBoard({ planner, snap, slug }: { planner: PlannerCtl; snap: PlannerSnapshot; slug: string }) {
  const index = useMemo(() => indexSnapshot(snap), [snap]);
  const { act } = planner;
  const [shown, setShown] = useState<{ title: string; ids: string[]; diet?: boolean } | null>(null);
  const [deleting, setDeleting] = useState<PlannerOption | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [who, setWho] = useState<Who>('yes');
  const [q, setQ] = useState('');
  const [withDiet, setWithDiet] = useState(false);
  const [withDeclined, setWithDeclined] = useState(false);

  const s = snap.summary;
  const yes = s.headcount.yes.count;
  const chosen = s.menu.options.reduce((n, o) => n + o.count, 0);
  const options = [...snap.options].sort((a, b) => a.sort - b.sort);
  const holdersOf = (id: string) => snap.persons.filter((p) => p.menuOptionId === id).length;

  const toggle = (key: 'askMenu' | 'askDiet' | 'showMenu', value: boolean) => act('put', '/settings', { [key]: value });

  const addOption = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const label = (form.elements.namedItem('label') as HTMLInputElement).value.trim();
    const note = (form.elements.namedItem('note') as HTMLInputElement).value.trim();
    if (!label) return;
    const r = await act('post', '/menu', { label, note });
    if (r.ok) form.reset();
  };
  const saveOption = async (e: FormEvent<HTMLFormElement>, id: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const label = (form.elements.namedItem('label') as HTMLInputElement).value.trim();
    const note = (form.elements.namedItem('note') as HTMLInputElement).value.trim();
    const r = await act('put', `/menu/${id}`, { label, note });
    if (r.ok) setEditing(null);
  };
  const move = (i: number, dir: -1 | 1) => {
    const ids = options.map((o) => o.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void act('post', '/menu/reorder', { ids });
  };

  // Гости и блюда: кого показать
  const people = useMemo(() => {
    const needle = norm(q);
    return snap.persons.filter((p) => {
      if (p.excluded) return false;
      if (who === 'yesMaybe' ? p.status !== 'yes' && p.status !== 'maybe' : p.status !== 'yes') return false;
      if (who === 'noChoice' && (p.menuOptionId || p.menuReview)) return false;
      if (who === 'review' && !p.menuReview) return false;
      if (who === 'diet' && !p.diet) return false;
      if (!needle) return true;
      return norm(p.name).includes(needle) || norm(index.partyByKey.get(p.partyKey)?.label ?? '').includes(needle);
    }).sort((a, b) => (index.partyByKey.get(a.partyKey)?.createdAt ?? '').localeCompare(index.partyByKey.get(b.partyKey)?.createdAt ?? '') || a.slot - b.slot);
  }, [snap.persons, who, q, index]);

  // По столам: только те, кто придёт
  const noTable = snap.persons.filter((p) => !p.excluded && p.status === 'yes' && !p.tableId);
  const tableRows = [
    ...index.tables.map((t) => {
      const sum = s.tables.find((x) => x.id === t.id);
      return { key: t.id, title: tableTitle(t.name), menu: sum?.menu, yes: sum?.yes ?? 0 };
    }),
    {
      key: 'none', title: 'Без стола', yes: noTable.length,
      menu: {
        options: options.map((o) => { const ids = noTable.filter((p) => p.menuOptionId === o.id).map((p) => p.id); return { optionId: o.id, ids, count: ids.length }; }),
        noChoice: (() => { const ids = noTable.filter((p) => !p.menuOptionId && !p.menuReview).map((p) => p.id); return { ids, count: ids.length }; })(),
        review: (() => { const ids = noTable.filter((p) => !p.menuOptionId && p.menuReview).map((p) => p.id); return { ids, count: ids.length }; })(),
      },
    },
  ].filter((r) => r.yes > 0 || r.key !== 'none');
  const anyReview = s.menu.review.count > 0;

  const download = async () => {
    try {
      const params = new URLSearchParams();
      if (withDiet) params.set('diet', '1');
      if (withDeclined) params.set('declined', '1');
      const res = await api.get(`/api/planner/${planner.inviteId}/export.csv?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = withDiet ? 'gosti-menu-ogranicheniya.csv' : 'gosti-menu.csv';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(errorText(e)); }
  };

  const tiles: { label: string; num: number; note?: string; color?: string; ids?: string[]; diet?: boolean }[] = [
    { label: 'Придут', num: yes, note: s.headcount.yesChildren.count ? `из них детей ${s.headcount.yesChildren.count}` : undefined, color: 'var(--yes)', ids: s.headcount.yes.ids },
    { label: 'Выбрали блюдо', num: chosen, note: yes ? `из ${yes}` : undefined },
    { label: 'Без выбора', num: s.menu.noChoice.count, ids: s.menu.noChoice.ids },
    ...(anyReview ? [{ label: 'Нужно уточнить', num: s.menu.review.count, color: '#8a5a00', ids: s.menu.review.ids }] : []),
    { label: 'С ограничениями', num: s.diet.count, color: s.diet.count ? '#8a5a00' : undefined, ids: s.diet.ids, diet: true },
    { label: 'Пока не знают', num: s.headcount.maybe.count, note: 'в расчёт не входят', color: 'var(--maybe)', ids: s.headcount.maybe.ids },
    { label: 'Без ответа', num: s.headcount.none.count, color: 'var(--none)', ids: s.headcount.none.ids },
  ];

  return (
    <div>
      {/* Настройки анкеты */}
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Анкета и сайт</h3>
        <label className={styles.switchRow}>
          <input type="checkbox" checked={snap.settings.askMenu} disabled={planner.pending > 0}
            onChange={(e) => toggle('askMenu', e.target.checked)} />
          <span>
            <b>Спрашивать у каждого гостя, какое блюдо он выберет</b>
            <span className={styles.hint} style={{ display: 'block' }}>
              В анкете появятся строки по числу гостей: имя и выбор из ваших вариантов.
              {options.length === 0 && ' Сначала добавьте варианты ниже — без них вопрос не покажется.'}
            </span>
          </span>
        </label>
        <label className={styles.switchRow}>
          <input type="checkbox" checked={snap.settings.askDiet} disabled={planner.pending > 0}
            onChange={(e) => toggle('askDiet', e.target.checked)} />
          <span>
            <b>Спрашивать про аллергию и ограничения в еде</b>
            <span className={styles.hint} style={{ display: 'block' }}>
              Гостю не обязательно отвечать. Ответы видите только вы: на сайте, в уведомлениях и в обычной выгрузке их нет.
            </span>
          </span>
        </label>
        <label className={styles.switchRow}>
          <input type="checkbox" checked={snap.settings.showMenu} disabled={planner.pending > 0}
            onChange={(e) => toggle('showMenu', e.target.checked)} />
          <span>
            <b>Показывать гостю меню и его выбор на сайте</b>
            <span className={styles.hint} style={{ display: 'block' }}>
              Гость, открывший свою персональную ссылку, увидит ваши варианты блюд и что выбрала его компания.
              Пищевых ограничений там нет.
            </span>
          </span>
        </label>
        <p className={styles.hint} style={{ margin: '8px 0 0' }}>
          Общие вопросы «Что предпочитаете на горячее?» и «Есть ли аллергия?» в анкете при этом не дублируются.{' '}
          {slug && <a className={styles.link} href={`/${slug}`} target="_blank" rel="noreferrer">Открыть сайт и посмотреть анкету ↗</a>}
        </p>
      </section>

      {/* Варианты */}
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Варианты блюд <span className={styles.paneHint}>{options.length} из {snap.limits.options}</span></h3>
        {options.length === 0 && <p className={styles.hint} style={{ marginTop: 0 }}>Например: «Мясное», «Рыбное», «Вегетарианское», «Детское».</p>}
        <ul className={styles.optionList}>
          {options.map((o, i) => (
            <li key={o.id} className={styles.optionRow}>
              {editing === o.id ? (
                <form className={styles.addForm} onSubmit={(e) => saveOption(e, o.id)}>
                  <input name="label" className={styles.input} defaultValue={o.label} maxLength={snap.limits.optionLabel} autoFocus aria-label="Название" />
                  <input name="note" className={styles.input} defaultValue={o.note} maxLength={snap.limits.optionNote} placeholder="Описание (необязательно)" aria-label="Описание" />
                  <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>Сохранить</button>
                  <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setEditing(null)}>Отмена</button>
                </form>
              ) : (
                <>
                  <span className={styles.grow} style={{ overflowWrap: 'anywhere' }}>
                    <b>{o.label}</b>{o.note && <span className={styles.hint}> — {o.note}</span>}
                  </span>
                  <span className={styles.badge}>{holdersOf(o.id)}</span>
                  <button type="button" className={styles.iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Выше: ${o.label}`} title="Выше">↑</button>
                  <button type="button" className={styles.iconBtn} disabled={i === options.length - 1} onClick={() => move(i, 1)} aria-label={`Ниже: ${o.label}`} title="Ниже">↓</button>
                  <button type="button" className={styles.iconBtn} onClick={() => setEditing(o.id)} aria-label={`Изменить: ${o.label}`} title="Изменить">✎</button>
                  <button type="button" className={styles.iconBtn} onClick={() => setDeleting(o)} aria-label={`Удалить: ${o.label}`} title="Удалить">🗑</button>
                </>
              )}
            </li>
          ))}
        </ul>
        {options.length < snap.limits.options && (
          <form className={styles.addForm} style={{ marginTop: 10 }} onSubmit={addOption}>
            <input name="label" className={styles.input} maxLength={snap.limits.optionLabel} placeholder="Новый вариант, например «Рыбное»" aria-label="Название варианта" />
            <input name="note" className={styles.input} maxLength={snap.limits.optionNote} placeholder="Описание, например «Сибас на гриле»" aria-label="Описание варианта" />
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={planner.pending > 0}>Добавить</button>
          </form>
        )}
      </section>

      {/* Сводка */}
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Сводка для ресторана</h3>
        <div className={styles.stats}>
          {tiles.map((t) => (
            <button key={t.label} type="button" className={styles.stat} disabled={!t.ids}
              onClick={() => t.ids && setShown({ title: t.label, ids: t.ids, diet: t.diet })}>
              <div className={styles.statNum} style={t.color ? { color: t.color } : undefined}>{t.num}</div>
              <div className={styles.statLabel}>{t.label}</div>
              {t.note && <div className={styles.statNote}>{t.note}</div>}
            </button>
          ))}
        </div>
        {options.length > 0 && (
          <ul className={styles.optionList}>
            {s.menu.options.map((o) => (
              <li key={o.optionId}>
                <button type="button" className={styles.barRow} onClick={() => setShown({ title: o.label, ids: o.ids })}>
                  <span className={styles.barLabel}>{o.label}</span>
                  <span className={styles.bar} aria-hidden><span className={styles.barFill} style={{ width: `${yes ? Math.round((o.count / yes) * 100) : 0}%`, display: 'block' }} /></span>
                  <b className={styles.barNum}>{o.count}</b>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.hint} style={{ marginBottom: 0 }}>Считаем только тех, кто ответил «приду». Нажмите на цифру — откроется список гостей за ней.</p>
      </section>

      {/* По столам */}
      {options.length > 0 && index.tables.length > 0 && (
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>По столам</h3>
          <div className={styles.matrixWrap}>
            <table className={styles.matrix}>
              <thead>
                <tr>
                  <th scope="col">Стол</th>
                  {options.map((o) => <th key={o.id} scope="col">{o.label}</th>)}
                  <th scope="col">Без выбора</th>
                  {anyReview && <th scope="col">Уточнить</th>}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => {
                  const cell = (title: string, ids: string[] = []) => (
                    <td>{ids.length ? <button type="button" className={styles.link} onClick={() => setShown({ title, ids })}>{ids.length}</button> : <span className={styles.hint}>—</span>}</td>
                  );
                  return (
                    <tr key={r.key}>
                      <th scope="row">{r.title}</th>
                      {options.map((o) => {
                        const c = r.menu?.options.find((x) => x.optionId === o.id);
                        return <td key={o.id}>{c && c.count ? <button type="button" className={styles.link} onClick={() => setShown({ title: `${r.title}: ${o.label}`, ids: c.ids })}>{c.count}</button> : <span className={styles.hint}>—</span>}</td>;
                      })}
                      {cell(`${r.title}: без выбора`, r.menu?.noChoice.ids)}
                      {anyReview && cell(`${r.title}: нужно уточнить`, r.menu?.review.ids)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Гости и блюда */}
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Гости и блюда <span className={styles.paneHint}>выбор можно поменять вручную — например, после звонка</span></h3>
        <div className={styles.filters}>
          <input className={styles.input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени или группе" aria-label="Поиск гостя" />
          <div className={styles.chips} role="group" aria-label="Кого показать">
            {([['yes', 'Придут'], ['yesMaybe', '+ пока не знают'], ['noChoice', 'Без выбора'], ['review', 'Уточнить'], ['diet', 'С ограничениями']] as [Who, string][])
              .filter(([k]) => k !== 'review' || anyReview)
              .map(([k, label]) => (
                <button key={k} type="button" className={`${styles.chip} ${who === k ? styles.chipOn : ''}`} aria-pressed={who === k} onClick={() => setWho(k)}>{label}</button>
              ))}
          </div>
        </div>
        {people.length === 0 ? <p className={styles.note}>Никого. {who === 'yes' && yes === 0 ? 'Подтверждения появятся, когда гости ответят на анкету.' : ''}</p> : (
          <ul className={styles.people} style={{ marginTop: 0 }}>
            {people.map((p) => {
              const party = index.partyByKey.get(p.partyKey);
              const table = p.tableId ? index.tableById.get(p.tableId) : undefined;
              return (
                <li key={p.id} className={styles.menuPerson}>
                  <span className={styles.dot} style={{ background: STATUS_COLOR[p.status] }} title={STATUS_LABEL[p.status]} />
                  <span className={styles.menuWho}>
                    {p.name || <span className={styles.unnamed}>{personTitle(p)}</span>}
                    <span className={styles.seatedSub}>{[party?.label !== p.name ? party?.label : '', p.isChild ? 'ребёнок' : '', table ? tableTitle(table.name) : ''].filter(Boolean).join(' · ')}</span>
                  </span>
                  <select className={styles.select} style={{ width: 'auto', minWidth: 150, minHeight: 34, padding: '4px 8px', fontSize: 13 }}
                    value={p.menuOptionId ?? ''} aria-label={`Блюдо: ${personTitle(p)}`}
                    onChange={(e) => act('put', `/persons/${p.id}`, { menuOptionId: e.target.value || null })}>
                    <option value="">{p.menuReview ? '⚠ нужно уточнить' : '— не выбрано —'}</option>
                    {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                  {(snap.settings.askDiet || p.diet) && (
                    <input className={styles.input} style={{ flex: '1 1 160px', minHeight: 34, padding: '4px 10px', fontSize: 13 }}
                      defaultValue={p.diet} maxLength={snap.limits.diet} placeholder="Ограничения" aria-label={`Ограничения: ${personTitle(p)}`}
                      onBlur={(e) => { if (e.target.value.trim() !== p.diet) void act('put', `/persons/${p.id}`, { diet: e.target.value.trim() }); }} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Выгрузка */}
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Выгрузка для ресторана</h3>
        <p className={styles.hint} style={{ marginTop: 0 }}>CSV открывается в Excel и Google Таблицах: стол, гость, группа, ответ, взрослый или ребёнок, блюдо.</p>
        <div className={styles.row}>
          <label className={styles.check}><input type="checkbox" checked={withDiet} onChange={(e) => setWithDiet(e.target.checked)} /> добавить пищевые ограничения</label>
          <label className={styles.check}><input type="checkbox" checked={withDeclined} onChange={(e) => setWithDeclined(e.target.checked)} /> включить отказавшихся</label>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={download}>Скачать CSV</button>
        </div>
        {withDiet && <p className={styles.hint}>Файл с ограничениями передавайте только тем, кто готовит: это личные сведения гостей.</p>}
      </section>

      {shown && <PeopleDialog title={shown.title} ids={shown.ids} index={index} showDiet={shown.diet} onClose={() => setShown(null)} />}
      {deleting && <DeleteOptionDialog ctl={planner} snap={snap} option={deleting} holders={holdersOf(deleting.id)} onClose={() => setDeleting(null)} />}
    </div>
  );
}
