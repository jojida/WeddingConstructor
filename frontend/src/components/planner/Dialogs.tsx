'use client';
import { useMemo, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { SALUTATIONS, previewGreeting } from '@/lib/constants';
import {
  looksSingle, nextTableName, norm, peopleText, personTitle, plural, seatsText, STATUS_COLOR, tablesNeeded, tableTitle,
  type PlannerSnapshot, type PlannerTable, type SnapshotIndex,
} from '@/lib/planner';
import type { PlannerCtl } from './usePlanner';
import { Modal } from './ui';
import styles from './planner.module.css';

type Common = { ctl: PlannerCtl; snap: PlannerSnapshot; onClose: () => void };

/* ── Стол: создать или поправить ──────────────────────────────────────────── */
export function TableDialog({ ctl, snap, table, onClose, onDelete }: Common & { table?: PlannerTable; onDelete?: () => void }) {
  const latest = [...snap.tables].sort((a, b) => b.sort - a.sort)[0];
  const [name, setName] = useState(table?.name ?? nextTableName(snap.tables));
  const [capacity, setCapacity] = useState(String(table?.capacity ?? latest?.capacity ?? 10));
  const [shape, setShape] = useState<'round' | 'long'>(table?.shape ?? 'round');
  const cap = Number(capacity);
  const inRange = Number.isInteger(cap) && cap >= 1 && cap <= snap.limits.capacityMax;
  const tooSmall = !!table && inRange && cap < table.occupied;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !inRange || tooSmall) return;
    const r = await ctl.act(table ? 'put' : 'post', table ? `/tables/${table.id}` : '/tables', { name: name.trim(), capacity: cap, shape });
    if (r.ok) onClose();
  };

  return (
    <Modal title={table ? tableTitle(table.name) : 'Новый стол'} onClose={onClose}>
      <form onSubmit={submit}>
        <label className={styles.field}>
          <span>Номер или название</span>
          <input className={styles.input} value={name} maxLength={snap.limits.tableName} autoFocus
            onChange={(e) => setName(e.target.value)} placeholder="Например: 1 или «Молодожёны»" />
        </label>
        <label className={styles.field}>
          <span>Сколько мест</span>
          <input className={styles.input} type="number" inputMode="numeric" min={1} max={snap.limits.capacityMax}
            value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          {!inRange && <span className={styles.hint}>От 1 до {snap.limits.capacityMax}</span>}
          {tooSmall && <span className={styles.hint}>За столом сидят {table!.occupied} — сначала пересадите лишних</span>}
        </label>
        <div className={styles.field}>
          <span>Форма на схеме</span>
          <div className={styles.row}>
            <button type="button" className={`${styles.chip} ${shape === 'round' ? styles.chipOn : ''}`} aria-pressed={shape === 'round'} onClick={() => setShape('round')}>Круглый</button>
            <button type="button" className={`${styles.chip} ${shape === 'long' ? styles.chipOn : ''}`} aria-pressed={shape === 'long'} onClick={() => setShape('long')}>Длинный</button>
          </div>
        </div>
        <div className={styles.dialogFoot}>
          {table && onDelete && <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={onDelete}>Удалить стол</button>}
          <button type="button" className={styles.btn} onClick={onClose}>Отмена</button>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!name.trim() || !inRange || tooSmall || ctl.pending > 0}>Сохранить</button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Столы пачкой ─────────────────────────────────────────────────────────── */
export function BulkDialog({ ctl, snap, onClose }: Common) {
  const [count, setCount] = useState('1');
  const [capacity, setCapacity] = useState('10');
  const cap = Number(capacity), n = Number(count);
  const room = snap.limits.tables - snap.tables.length;
  const ok = Number.isInteger(n) && n >= 1 && n <= Math.min(50, room) && Number.isInteger(cap) && cap >= 1 && cap <= snap.limits.capacityMax;

  const h = snap.summary.headcount;
  const guests = h.yes.count + h.maybe.count + h.none.count;           // кого предстоит рассадить
  const seats = snap.tables.reduce((s, t) => s + t.capacity, 0);
  const lack = Math.max(0, guests - seats);
  const suggested = Number.isInteger(cap) && cap >= 1 ? Math.min(tablesNeeded(lack, cap), Math.max(1, room), 50) : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    const r = await ctl.act('post', '/tables/bulk', { count: n, capacity: cap });
    if (r.ok) { toast.success(`Добавлено ${n} ${plural(n, 'стол', 'стола', 'столов')}`); onClose(); }
  };

  return (
    <Modal title="Столы пачкой" onClose={onClose}>
      <form onSubmit={submit}>
        <div className={styles.row}>
          <label className={`${styles.field} ${styles.grow}`}>
            <span>Сколько столов</span>
            <input className={styles.input} type="number" inputMode="numeric" min={1} max={50} value={count} autoFocus onChange={(e) => setCount(e.target.value)} />
          </label>
          <label className={`${styles.field} ${styles.grow}`}>
            <span>Мест за каждым</span>
            <input className={styles.input} type="number" inputMode="numeric" min={1} max={snap.limits.capacityMax} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </label>
        </div>
        <p className={styles.hint}>Названия будут по номерам: 1, 2, 3… — потом любой стол можно переименовать.</p>
        {guests > 0 && (
          <div className={styles.alert}>
            Гостей к рассадке: <b>{guests}</b> (придут, не знают и без ответа). Мест за столами: <b>{seats}</b>.
            {lack > 0 && suggested > 0 ? (
              <> Не хватает {lack} {lack % 10 === 1 && lack % 100 !== 11 ? 'места' : 'мест'} — нужно ещё <b>{suggested} {plural(suggested, 'стол', 'стола', 'столов')}</b> по {cap}.{' '}
                <button type="button" className={styles.link} onClick={() => setCount(String(suggested))}>Подставить</button></>
            ) : <> Мест хватает.</>}
          </div>
        )}
        <div className={styles.dialogFoot}>
          <button type="button" className={styles.btn} onClick={onClose}>Отмена</button>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!ok || ctl.pending > 0}>Добавить</button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Новый гость (приглашение) ────────────────────────────────────────────── */
export function GuestDialog({ ctl, snap, onClose }: Common) {
  const [names, setNames] = useState('');
  const [salutation, setSalutation] = useState('дорогие');
  const [people, setPeople] = useState<{ name: string; isChild: boolean }[]>([{ name: '', isChild: false }]);
  const room = snap.limits.partyPeople;

  const setPerson = (i: number, patch: Partial<{ name: string; isChild: boolean }>) =>
    setPeople((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const title = names.trim();
    if (!title) return;
    // Один человек и имя не вписано: это тот, кого мы назвали в приглашении (если это одно имя)
    const list = people.map((p, i) => ({
      name: p.name.trim() || (people.length === 1 && i === 0 && salutation !== 'семья' && looksSingle(title) ? title.slice(0, snap.limits.name) : ''),
      isChild: p.isChild,
    }));
    const r = await ctl.act('post', '/parties', { names: title, salutation, people: list });
    if (r.ok) { toast.success('Гость добавлен'); onClose(); }
  };

  return (
    <Modal title="Добавить гостя" onClose={onClose}>
      <form onSubmit={submit}>
        <label className={styles.field}>
          <span>Кого приглашаем</span>
          <input className={styles.input} value={names} maxLength={200} autoFocus onChange={(e) => setNames(e.target.value)}
            placeholder={salutation === 'семья' ? 'Кореловых' : 'Денис и Мария'} />
        </label>
        <label className={styles.field}>
          <span>Обращение на сайте</span>
          <select className={styles.select} value={salutation} onChange={(e) => setSalutation(e.target.value)}>
            {SALUTATIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {names.trim() && <span className={styles.hint}>«{previewGreeting(salutation, names)}»</span>}
        </label>
        <div className={styles.field}>
          <span>Кто придёт</span>
          {people.map((p, i) => (
            <div key={i} className={styles.row} style={{ marginBottom: 6 }}>
              <input className={`${styles.input} ${styles.grow}`} value={p.name} maxLength={snap.limits.name}
                onChange={(e) => setPerson(i, { name: e.target.value })} placeholder={people.length === 1 ? 'Имя (можно оставить пустым)' : `Гость ${i + 1} — имя`}
                aria-label={`Имя гостя ${i + 1}`} />
              <label className={styles.check}><input type="checkbox" checked={p.isChild} onChange={(e) => setPerson(i, { isChild: e.target.checked })} /> ребёнок</label>
              {people.length > 1 && <button type="button" className={styles.iconBtn} aria-label="Убрать строку" onClick={() => setPeople((l) => l.filter((_, j) => j !== i))}>✕</button>}
            </div>
          ))}
          {people.length < room && (
            <button type="button" className={`${styles.btn} ${styles.btnSmall}`} style={{ alignSelf: 'flex-start' }}
              onClick={() => setPeople((l) => [...l, { name: '', isChild: false }])}>+ ещё человек</button>
          )}
          <span className={styles.hint}>Имя можно не знать — человек всё равно займёт место, а имя вы укажете позже.</span>
        </div>
        <div className={styles.dialogFoot}>
          <button type="button" className={styles.btn} onClick={onClose}>Отмена</button>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!names.trim() || ctl.pending > 0}>Добавить</button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Вставка списка имён ──────────────────────────────────────────────────── */
export function ImportDialog({ ctl, snap, onClose }: Common) {
  const [text, setText] = useState('');
  const [salutation, setSalutation] = useState('дорогие');
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;
  const tooMany = lines > snap.limits.importLines;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!lines || tooMany) return;
    const r = await ctl.act<{ created: number; skipped: string[]; invalid: string[] }>('post', '/import', { text, salutation });
    if (!r.ok || !r.result) return;
    const { created, skipped } = r.result;
    toast.success(created ? `Добавлено приглашений: ${created}` : 'Новых имён не нашлось');
    if (skipped.length) toast(`Уже были в списке: ${skipped.length}`, { icon: 'ℹ️' });
    onClose();
  };

  return (
    <Modal title="Вставить список гостей" onClose={onClose}>
      <form onSubmit={submit}>
        <label className={styles.field}>
          <span>Имена — по одному в строке</span>
          <textarea className={styles.input} rows={9} value={text} autoFocus onChange={(e) => setText(e.target.value)}
            placeholder={'Иван Петров\nМария Петрова +1\nСемья Ивановых +2\nДенис и Мария'} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          <span className={styles.hint}>
            «+2» в конце — ещё двое пришли с гостем, имён пока нет. «Семья …» — приглашение семьи. Повторное имя пропускается.
            {tooMany && <b> Не больше {snap.limits.importLines} строк за раз.</b>}
          </span>
        </label>
        <label className={styles.field}>
          <span>Обращение для всех</span>
          <select className={styles.select} value={salutation} onChange={(e) => setSalutation(e.target.value)}>
            {SALUTATIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <span className={styles.hint}>Нужно для персональных ссылок. Потом меняется во вкладке «Гости».</span>
        </label>
        <div className={styles.dialogFoot}>
          <button type="button" className={styles.btn} onClick={onClose}>Отмена</button>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!lines || tooMany || ctl.pending > 0}>
            Добавить{lines ? ` (${lines})` : ''}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Подтверждение ────────────────────────────────────────────────────────── */
export function ConfirmDialog({ title, children, confirmLabel, danger, busy, onConfirm, onClose }: {
  title: string; children: React.ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div>{children}</div>
      <div className={styles.dialogFoot}>
        <button type="button" className={styles.btn} onClick={onClose} autoFocus>Отмена</button>
        <button type="button" className={`${styles.btn} ${danger ? styles.btnDanger : styles.btnPrimary}`} disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

/* ── Выбор стола для человека или семьи ───────────────────────────────────── */
export function SeatPicker({ title, index, ids, onPick, onUnseat, onClose }: {
  title: string; index: SnapshotIndex; ids: string[]; onPick: (tableId: string) => void; onUnseat?: () => void; onClose: () => void;
}) {
  const people = ids.map((id) => index.personById.get(id)).filter(Boolean);
  const seatedNow = people.filter((p) => p!.tableId).length;
  return (
    <Modal title={title} onClose={onClose}>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        {people.length > 1 ? `Сядут все ${peopleText(people.length)} вместе. ` : ''}Выберите стол:
      </p>
      {index.tables.length === 0 && <div className={styles.alert}>Столов пока нет. Закройте окно и нажмите «+ Стол».</div>}
      <div className={styles.pickScroll}>
        <ul className={styles.pickList}>
          {index.tables.map((t) => {
            const already = people.filter((p) => p!.tableId === t.id).length;
            const need = people.length - already;
            const fits = t.free >= need;
            return (
              <li key={t.id}>
                <button type="button" className={`${styles.pickItem} ${already === people.length ? styles.pickCur : ''}`}
                  disabled={!fits || already === people.length} onClick={() => onPick(t.id)}>
                  <span>
                    <b>{tableTitle(t.name)}</b>
                    <span className={styles.pickSub} style={{ display: 'block' }}>
                      {already === people.length ? 'Уже здесь' : fits ? `свободно ${seatsText(t.free)}` : `не хватает мест: свободно ${t.free}, нужно ${need}`}
                    </span>
                  </span>
                  <span className={styles.pickSub}>{t.occupied}/{t.capacity}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className={styles.dialogFoot}>
        {onUnseat && seatedNow > 0 && <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={onUnseat}>Снять со стола</button>}
        <button type="button" className={styles.btn} onClick={onClose}>Закрыть</button>
      </div>
    </Modal>
  );
}

/* ── «Посадить сюда»: кто ещё не за столом ────────────────────────────────── */
export function FillTableDialog({ ctl, snap, index, table, onClose }: Common & { index: SnapshotIndex; table: PlannerTable }) {
  const [q, setQ] = useState('');
  // Данные стола берём из свежего снимка: после каждой посадки число мест меняется
  const live = index.tableById.get(table.id) ?? table;
  const rows = useMemo(() => {
    const needle = norm(q);
    const out: { id: string; title: string; party: string; color: string; mates: string[] }[] = [];
    for (const party of snap.parties) {
      if (party.status === 'no') continue;
      const all = (index.byParty.get(party.key) ?? []).filter((p) => !p.excluded && !p.tableId);
      for (const p of all) {
        if (needle && !norm(p.name).includes(needle) && !norm(party.label).includes(needle)) continue;
        out.push({ id: p.id, title: personTitle(p), party: party.label, color: STATUS_COLOR[p.status], mates: all.filter((x) => x.id !== p.id).map((x) => x.id) });
      }
    }
    return out;
  }, [snap.parties, index, q]);

  const seat = async (ids: string[]) => { await ctl.act('post', '/seat', { personIds: ids, tableId: table.id }); };

  return (
    <Modal title={`Посадить: ${tableTitle(live.name)}`} onClose={onClose} wide>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        Занято {live.occupied} из {live.capacity}, свободно {seatsText(live.free)}.
      </p>
      <input className={styles.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени" aria-label="Поиск по имени" autoFocus />
      <div className={styles.pickScroll} style={{ marginTop: 8 }}>
        {rows.length === 0 ? <p className={styles.note}>Все гости уже за столами.</p> : (
          <ul className={styles.pickList}>
            {rows.map((r) => (
              <li key={r.id} className={styles.pickItem} style={{ cursor: 'default' }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ overflowWrap: 'anywhere' }}><span className={styles.dot} style={{ background: r.color, display: 'inline-block', marginRight: 6 }} />{r.title}</span>
                  <span className={styles.pickSub} style={{ display: 'block', overflowWrap: 'anywhere' }}>{r.party}</span>
                </span>
                <span className={styles.row} style={{ flexWrap: 'nowrap' }}>
                  <button type="button" className={`${styles.btn} ${styles.btnSmall}`} disabled={live.free < 1 || ctl.pending > 0} onClick={() => seat([r.id])}>Посадить</button>
                  {r.mates.length > 0 && (
                    <button type="button" className={`${styles.btn} ${styles.btnSmall}`} disabled={live.free < r.mates.length + 1 || ctl.pending > 0}
                      onClick={() => seat([r.id, ...r.mates])}>Всех ({r.mates.length + 1})</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.dialogFoot}><button type="button" className={styles.btn} onClick={onClose}>Готово</button></div>
    </Modal>
  );
}

/* ── Авторассадка ─────────────────────────────────────────────────────────── */
interface AutoResult { placements: { personId: string; tableId: string }[]; unplaced: string[]; applied: boolean }

export function AutoDialog({ ctl, snap, index, onClose }: Common & { index: SnapshotIndex }) {
  const [includeMaybe, setIncludeMaybe] = useState(false);
  const [includeNone, setIncludeNone] = useState(false);
  const [preview, setPreview] = useState<AutoResult | null>(null);
  const [done, setDone] = useState<AutoResult | null>(null);
  // Особые столы («Молодожёны», «Дети») по умолчанию не заполняем сами — только обычные номерные
  const [tableIds, setTableIds] = useState<string[]>(() => {
    const numbered = index.tables.filter((t) => tableTitle(t.name).startsWith('Стол '));
    return (numbered.length ? numbered : index.tables).map((t) => t.id);
  });
  const toggleTable = (id: string) => {
    setTableIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
    setPreview(null);
  };

  const run = async (dryRun: boolean) => {
    const r = await ctl.act<AutoResult>('post', '/autoseat', { dryRun, includeMaybe, includeNone, tableIds });
    if (!r.ok || !r.result) return;
    if (dryRun) setPreview(r.result); else { setDone(r.result); setPreview(null); }
  };
  const undo = async () => {
    if (!done) return;
    const r = await ctl.act('post', '/seat', { personIds: done.placements.map((p) => p.personId), tableId: null });
    if (r.ok) { toast.success('Рассадка отменена'); setDone(null); }
  };

  const grouped = useMemo(() => {
    if (!preview) return [];
    const byTable = new Map<string, string[]>();
    for (const { personId, tableId } of preview.placements) {
      const p = index.personById.get(personId);
      if (!p) continue;
      const list = byTable.get(tableId) ?? [];
      list.push(`${personTitle(p)}${p.name ? '' : ` · ${index.partyByKey.get(p.partyKey)?.label ?? ''}`}`);
      byTable.set(tableId, list);
    }
    return index.tables.filter((t) => byTable.has(t.id)).map((t) => ({ table: t, names: byTable.get(t.id)! }));
  }, [preview, index]);

  const names = (ids: string[]) => ids.map((id) => index.personById.get(id)).filter(Boolean)
    .map((p) => personTitle(p!)).slice(0, 8).join(', ');

  return (
    <Modal title="Рассадить автоматически" onClose={onClose} wide>
      {done ? (
        <>
          <div className={styles.alert} style={{ background: '#eef8f1', borderColor: '#bfe0cb' }}>
            Посажено: <b>{done.placements.length}</b>. Семьи и метки (например, «Семья жениха») сидят вместе, где хватило места.
          </div>
          {done.unplaced.length > 0 && <div className={styles.alert}>Не хватило мест для {peopleText(done.unplaced.length)}: {names(done.unplaced)}{done.unplaced.length > 8 ? '…' : ''}. Добавьте стол.</div>}
          <div className={styles.dialogFoot}>
            <button type="button" className={styles.btn} onClick={undo} disabled={ctl.pending > 0}>Отменить рассадку</button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Готово</button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.hint} style={{ marginTop: 0 }}>
            Посадит тех, кто ещё без стола и придёт. Уже сидящих не трогает. Сначала покажем, что получится, — применять не обязательно.
          </p>
          <div className={styles.row} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <label className={styles.check}><input type="checkbox" checked={includeMaybe} onChange={(e) => { setIncludeMaybe(e.target.checked); setPreview(null); }} /> и тех, кто «пока не знает» ({snap.summary.headcount.maybe.count})</label>
            <label className={styles.check}><input type="checkbox" checked={includeNone} onChange={(e) => { setIncludeNone(e.target.checked); setPreview(null); }} /> и тех, кто ещё не ответил ({snap.summary.headcount.none.count})</label>
          </div>
          {snap.tables.length === 0 && <div className={styles.alert}>Сначала добавьте столы.</div>}
          {index.tables.length > 1 && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13 }}>Какие столы заполнять ({tableIds.length} из {index.tables.length})</summary>
              <div className={styles.row} style={{ marginTop: 6, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                {index.tables.map((t) => (
                  <label key={t.id} className={styles.check}>
                    <input type="checkbox" checked={tableIds.includes(t.id)} onChange={() => toggleTable(t.id)} />
                    {tableTitle(t.name)} <span className={styles.hint}>свободно {t.free} из {t.capacity}</span>
                  </label>
                ))}
              </div>
            </details>
          )}
          {preview && (
            <>
              <div className={styles.preview}>
                {grouped.map(({ table, names: list }) => (
                  <div key={table.id} className={styles.previewTable}>
                    <b>{tableTitle(table.name)} — будет {table.occupied + list.length} из {table.capacity}</b>
                    {list.join(', ')}
                  </div>
                ))}
                {preview.placements.length === 0 && <p className={styles.note}>Некого сажать или нет свободных мест.</p>}
              </div>
              {preview.unplaced.length > 0 && <div className={styles.alert}>Не хватит мест для {peopleText(preview.unplaced.length)}: {names(preview.unplaced)}{preview.unplaced.length > 8 ? '…' : ''}.</div>}
            </>
          )}
          <div className={styles.dialogFoot}>
            <button type="button" className={styles.btn} onClick={onClose}>Закрыть</button>
            <button type="button" className={styles.btn} disabled={ctl.pending > 0 || snap.tables.length === 0} onClick={() => run(true)}>Показать, что получится</button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={ctl.pending > 0 || !preview || preview.placements.length === 0} onClick={() => run(false)}>
              Применить{preview ? ` (${preview.placements.length})` : ''}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
