'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import Navbar from '@/components/Navbar';
import { isAdvancedPlan, hasCustomDomain, SALUTATIONS, previewGreeting, inviteDrinkLabels, formatDrinkChoice } from '@/lib/constants';

interface Invite {
  id: string; slug: string; status: string; plan: string;
  groomName: string; brideName: string; templateId: string;
  notifyChannel: string; notifyEmail: string; notifyTelegramChatId: string;
  customDomain: string;
  customData?: Record<string, any>;
}
interface Guest {
  id: string; token: string; salutation: string; names: string;
  greeting: string; responded: boolean; attending: boolean | null; drinkChoice: string; wishes: string;
}
interface RsvpData {
  responses: { id: string; guestName: string; attending: boolean; drinkChoice: string; wishes: string; createdAt: string }[];
  stats: { total: number; attending: number; notAttending: number; drinks: Record<string, number> };
  drinkLabels: Record<string, string>;
}

type Tab = 'responses' | 'guests' | 'notify' | 'domain';

const PRIMARY = '#685d4a';
const BORDER = '1px solid rgba(206,197,186,0.5)';

export default function ManageInvitePage() {
  const params = useParams();
  const id = (params?.id as string) || '';
  const router = useRouter();
  const { user, loading } = useAuthStore();

  const [invite, setInvite] = useState<Invite | null>(null);
  const [tab, setTab] = useState<Tab>('responses');
  const [origin, setOrigin] = useState('');

  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => { if (!loading && !user) router.push('/auth'); }, [loading, user, router]);

  const loadInvite = useCallback(() => {
    if (!id) return;
    api.get(`/api/invites/${id}`)
      .then(res => setInvite(res.data))
      .catch(() => toast.error('Приглашение не найдено'));
  }, [id]);

  useEffect(() => { if (user) loadInvite(); }, [user, loadInvite]);

  if (loading || !invite) return (
    <div style={{ minHeight: '100vh', background: '#faf8f5' }}>
      <Navbar />
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div style={{ width: 34, height: 34, border: '3px solid rgba(206,197,186,0.4)', borderTopColor: PRIMARY, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    </div>
  );

  const advanced = isAdvancedPlan(invite.plan);
  const couple = [invite.groomName, invite.brideName].filter(Boolean).join(' & ') || 'Без названия';

  const TABS: { key: Tab; label: string; show: boolean }[] = [
    { key: 'responses', label: '📋 Ответы', show: true },
    { key: 'guests',    label: '👥 Гости', show: true },
    { key: 'notify',    label: '🔔 Уведомления', show: true },
    { key: 'domain',    label: '🌐 Домен', show: true },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f5' }}>
      <Navbar />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 20px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-playfair, Georgia), serif', fontSize: 30, color: '#0e1d26', margin: 0 }}>{couple}</h1>
            <div style={{ fontSize: 13, color: '#7d766c', marginTop: 4 }}>
              Тариф: <b>{invite.plan}</b>
            </div>
          </div>
        </div>

        <SiteAddressCard invite={invite} origin={origin} onSaved={loadInvite} />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, borderBottom: BORDER, margin: '20px 0 24px', flexWrap: 'wrap' }}>
          {TABS.filter(t => t.show).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 14, fontFamily: 'var(--font-inter, sans-serif)',
                color: tab === t.key ? PRIMARY : '#9a948a', fontWeight: tab === t.key ? 700 : 500,
                borderBottom: tab === t.key ? `2px solid ${PRIMARY}` : '2px solid transparent', marginBottom: -1,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'responses' && <ResponsesTab inviteId={invite.id} />}
        {tab === 'guests'    && <GuestsTab invite={invite} advanced={advanced} origin={origin} />}
        {tab === 'notify'    && <NotifyTab invite={invite} userEmail={user?.email || ''} onSaved={loadInvite} />}
        {tab === 'domain'    && <DomainTab invite={invite} advanced={hasCustomDomain(invite.plan)} onSaved={loadInvite} />}
      </div>
    </div>
  );
}

// ─── Вкладка «Ответы» ──────────────────────────────────────────────────────
function ResponsesTab({ inviteId }: { inviteId: string }) {
  const [data, setData] = useState<RsvpData | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.get(`/api/rsvp/${inviteId}`)
      .then(res => setData(res.data))
      .catch(() => setErr('Не удалось загрузить ответы'));
  }, [inviteId]);

  if (err) return <Empty>{err}</Empty>;
  if (!data) return <Empty>Загрузка…</Empty>;
  if (data.stats.total === 0) return <Empty>Пока нет ответов. Они появятся, когда гости заполнят анкету.</Empty>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Stat n={data.stats.total} label="Всего ответов" />
        <Stat n={data.stats.attending} label="Придут" color="#2e8b57" />
        <Stat n={data.stats.notAttending} label="Не придут" color="#b85c5c" />
      </div>
      {Object.keys(data.stats.drinks).length > 0 && (
        <div style={{ marginBottom: 20, fontSize: 14, color: '#5b554c' }}>
          <b>Напитки:</b>{' '}
          {Object.entries(data.stats.drinks).map(([k, v]) => `${data.drinkLabels[k] || k}: ${v}`).join(' · ')}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.responses.map(r => (
          <div key={r.id} style={{ background: '#fff', border: BORDER, borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontWeight: 600, color: '#0e1d26' }}>{r.guestName}</span>
              <span style={{ fontSize: 13, color: r.attending ? '#2e8b57' : '#b85c5c' }}>{r.attending ? '✓ Придёт' : '✗ Не придёт'}</span>
            </div>
            {r.drinkChoice && <div style={{ fontSize: 13, color: '#7d766c', marginTop: 4 }}>🥂 {formatDrinkChoice(r.drinkChoice, data.drinkLabels)}</div>}
            {r.wishes && <div style={{ fontSize: 13, color: '#7d766c', marginTop: 4, fontStyle: 'italic' }}>«{r.wishes}»</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Вкладка «Гости» (продвинутый тариф) ──────────────────────────────────
function GuestsTab({ invite, advanced, origin }: { invite: Invite; advanced: boolean; origin: string }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [salutation, setSalutation] = useState<string>('дорогие');
  const [names, setNames] = useState('');
  const [busy, setBusy] = useState(false);

  const drinkLabels = inviteDrinkLabels(invite.customData);

  const load = useCallback(() => {
    api.get(`/api/guests/${invite.id}`).then(res => setGuests(res.data.guests)).catch(() => {});
  }, [invite.id]);
  useEffect(() => { if (advanced) load(); }, [advanced, load]);

  if (!advanced) return (
    <div style={{ background: 'linear-gradient(135deg,#fff,#f7f1e8)', border: BORDER, borderRadius: 14, padding: 28, textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
      <h3 style={{ margin: '0 0 8px', color: '#0e1d26', fontFamily: 'var(--font-playfair, Georgia), serif', fontSize: 22 }}>Кабинет гостей — на тарифе Премиум</h3>
      <p style={{ color: '#7d766c', fontSize: 14, maxWidth: 460, margin: '0 auto 16px' }}>
        Добавляйте гостей вручную, получайте для каждого персональную ссылку с именным обращением
        («Дорогие Денис и Мария», «Семья Кореловых») и собирайте ответы по каждому гостю.
      </p>
      <Link href={`/payment?id=${invite.id}`} className="btn-primary" style={{ textDecoration: 'none', padding: '11px 26px', fontSize: 14 }}>
        Улучшить тариф →
      </Link>
    </div>
  );

  const addGuest = async () => {
    if (!names.trim()) { toast.error('Введите имя гостя'); return; }
    setBusy(true);
    try {
      await api.post(`/api/guests/${invite.id}`, { salutation, names: names.trim() });
      setNames('');
      load();
      toast.success('Гость добавлен');
    } catch (e: any) { toast.error(e.response?.data?.error || 'Ошибка'); }
    finally { setBusy(false); }
  };

  const removeGuest = async (gid: string) => {
    if (!confirm('Удалить гостя?')) return;
    try { await api.delete(`/api/guests/${gid}`); setGuests(prev => prev.filter(g => g.id !== gid)); }
    catch { toast.error('Ошибка удаления'); }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${origin}/${invite.slug}?g=${token}`);
    toast.success('Персональная ссылка скопирована');
  };

  return (
    <div>
      {/* Add form */}
      <div style={{ background: '#fff', border: BORDER, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#7d766c', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Добавить гостя</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={salutation} onChange={e => setSalutation(e.target.value)} className="input-field" style={{ width: 150, padding: '10px' }}>
            {SALUTATIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input className="input-field" style={{ flex: 1, minWidth: 180 }} placeholder={salutation === 'семья' ? 'Кореловых' : 'Денис и Мария'}
            value={names} onChange={e => setNames(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGuest()} />
          <button className="btn-primary" onClick={addGuest} disabled={busy} style={{ padding: '10px 20px', fontSize: 14 }}>Добавить</button>
        </div>
        {names.trim() && (
          <div style={{ fontSize: 13, color: '#9a7b3f', marginTop: 10 }}>
            Обращение на сайте: <b>«{previewGreeting(salutation, names)}»</b>
          </div>
        )}
      </div>

      {guests.length === 0 ? <Empty>Гостей пока нет. Добавьте первого выше.</Empty> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {guests.map(g => (
            <div key={g.id} style={{ background: '#fff', border: BORDER, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 600, color: '#0e1d26' }}>{g.greeting}</div>
                <div style={{ fontSize: 12, marginTop: 3, color: g.responded ? (g.attending ? '#2e8b57' : '#b85c5c') : '#a39b8e' }}>
                  {g.responded ? (g.attending ? `✓ Придёт${g.drinkChoice ? ' · ' + formatDrinkChoice(g.drinkChoice, drinkLabels) : ''}` : '✗ Не придёт') : '○ Не ответил(а)'}
                </div>
              </div>
              <button onClick={() => copyLink(g.token)} className="btn-outline" style={{ padding: '7px 12px', fontSize: 12 }}>🔗 Ссылка</button>
              <button onClick={() => removeGuest(g.id)} title="Удалить" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b85c5c', fontSize: 18 }}>🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Вкладка «Уведомления» ─────────────────────────────────────────────────
function NotifyTab({ invite, userEmail, onSaved }: { invite: Invite; userEmail: string; onSaved: () => void }) {
  const [channel, setChannel] = useState(invite.notifyChannel || 'none');
  const [email, setEmail] = useState(invite.notifyEmail || userEmail || '');
  const [tg, setTg] = useState<{ deepLink: string; botUsername: string; connected: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const connectTelegram = async () => {
    try {
      const res = await api.post(`/api/invites/${invite.id}/telegram-connect`);
      setTg(res.data);
    } catch { toast.error('Ошибка'); }
  };
  useEffect(() => {
    if (channel === 'telegram') connectTelegram();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/invites/${invite.id}/settings`, { notifyChannel: channel, notifyEmail: email });
      toast.success('Сохранено');
      onSaved();
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <p style={{ fontSize: 14, color: '#5b554c', marginBottom: 18 }}>
        Куда присылать ответы гостей. Выберите один канал.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { v: 'telegram', t: '✈️ Telegram', d: 'Ответы приходят в чат с ботом' },
          { v: 'email',    t: '📧 Email',    d: 'Ответы приходят на почту' },
          { v: 'none',     t: '🔕 Не уведомлять', d: 'Только в кабинете' },
        ].map(o => (
          <label key={o.v} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 14, border: channel === o.v ? `2px solid ${PRIMARY}` : BORDER, borderRadius: 10, cursor: 'pointer', background: '#fff' }}>
            <input type="radio" name="ch" checked={channel === o.v} onChange={() => setChannel(o.v)} style={{ marginTop: 3 }} />
            <span>
              <span style={{ fontWeight: 600, color: '#0e1d26' }}>{o.t}</span>
              <span style={{ display: 'block', fontSize: 13, color: '#7d766c' }}>{o.d}</span>
            </span>
          </label>
        ))}
      </div>

      {channel === 'telegram' && (
        <div style={{ marginTop: 14, padding: 14, background: '#f3f8ff', border: '1px solid #cfe0f5', borderRadius: 10, fontSize: 14, color: '#3a567d' }}>
          {invite.notifyTelegramChatId
            ? '✅ Telegram подключён — ответы гостей будут приходить в этот чат.'
            : tg?.deepLink
              ? (
                <>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Как подключить — три шага:</div>
                  <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                    <li>
                      Откройте нашего бота{tg.botUsername ? <> <b>@{tg.botUsername}</b></> : null}:{' '}
                      <a href={tg.deepLink} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: '#2a4a78' }}>перейти в Telegram →</a>
                    </li>
                    <li>Нажмите в Telegram кнопку «Старт» — бот ответит, что уведомления подключены.</li>
                    <li>Вернитесь сюда и нажмите «Сохранить».</li>
                  </ol>
                  <div style={{ marginTop: 10, padding: '8px 10px', background: '#fff', border: '1px solid #cfe0f5', borderRadius: 8, fontSize: 12, color: '#3a567d', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ wordBreak: 'break-all', flex: 1 }}>{tg.deepLink}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(tg.deepLink); toast.success('Ссылка скопирована'); }}
                      style={{ border: '1px solid #cfe0f5', background: 'transparent', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#2a4a78', whiteSpace: 'nowrap' }}
                    >
                      Копировать
                    </button>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 8, color: '#6b87b0' }}>
                    Открываете с компьютера? Скопируйте ссылку и откройте её на телефоне,
                    где установлен Telegram. Ссылка личная: она привязывает уведомления
                    именно к вашему сайту — гостям её отправлять не нужно, они просто
                    заполняют анкету.
                  </div>
                </>
              )
              : (
                <>
                  Подключение Telegram сейчас недоступно. Выберите уведомления на email —
                  или напишите нам на{' '}
                  <a href="mailto:support@weddingcraft.ru" style={{ fontWeight: 600, color: '#2a4a78' }}>support@weddingcraft.ru</a>,
                  поможем настроить.
                </>
              )}
        </div>
      )}

      {channel === 'email' && (
        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#7d766c', textTransform: 'uppercase', marginBottom: 6 }}>Email для уведомлений</label>
          <input className="input-field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={userEmail} />
        </div>
      )}

      <button className="btn-primary" onClick={save} disabled={saving} style={{ marginTop: 20, padding: '11px 28px', fontSize: 14 }}>
        {saving ? 'Сохранение…' : 'Сохранить'}
      </button>
    </div>
  );
}

// ─── Вкладка «Домен» ───────────────────────────────────────────────────────
const SERVER_IP = process.env.NEXT_PUBLIC_SERVER_IP || '89.191.226.237';

interface DomainStatus {
  domain: string; expectedIp: string; ips: string[]; wwwIps: string[];
  dnsOk: boolean; wwwOk: boolean; paid: boolean;
}

function DomainTab({ invite, advanced, onSaved }: { invite: Invite; advanced: boolean; onSaved: () => void }) {
  const [domain, setDomain] = useState(invite.customDomain || '');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<DomainStatus | null>(null);

  if (!advanced) return (
    <div style={{ background: 'linear-gradient(135deg,#fff,#f7f1e8)', border: BORDER, borderRadius: 14, padding: 28, textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>🌐</div>
      <h3 style={{ margin: '0 0 8px', color: '#0e1d26', fontFamily: 'var(--font-playfair, Georgia), serif', fontSize: 22 }}>Свой домен — на тарифе Премиум</h3>
      <p style={{ color: '#7d766c', fontSize: 14, maxWidth: 460, margin: '0 auto 16px' }}>
        Привяжите собственный домен (например, denis-i-maria.ru) к вашему сайту-приглашению.
      </p>
      <Link href={`/payment?id=${invite.id}`} className="btn-primary" style={{ textDecoration: 'none', padding: '11px 26px', fontSize: 14 }}>Улучшить тариф →</Link>
    </div>
  );

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/invites/${invite.id}/settings`, { customDomain: domain });
      toast.success(domain.trim() ? 'Домен сохранён' : 'Домен отвязан');
      setStatus(null);
      onSaved();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const check = async () => {
    setChecking(true);
    setStatus(null);
    try {
      const res = await api.get(`/api/domains/status/${invite.id}`);
      setStatus(res.data);
    } catch (e: any) { toast.error(e.response?.data?.error || 'Не удалось проверить домен'); }
    finally { setChecking(false); }
  };

  const DnsRow = ({ label, ok, ips }: { label: string; ok: boolean; ips: string[] }) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, marginTop: 6 }}>
      <span style={{ color: ok ? '#2e8b57' : '#b85c5c', fontWeight: 700, flexShrink: 0 }}>{ok ? '✓' : '✗'}</span>
      <span style={{ fontFamily: 'monospace' }}>{label}</span>
      <span style={{ color: '#7d766c' }}>
        {ips.length ? `→ ${ips.join(', ')}` : '— запись не найдена'}
      </span>
    </div>
  );

  return (
    <div style={{ maxWidth: 600 }}>
      <p style={{ fontSize: 14, color: '#5b554c', marginBottom: 16 }}>
        По умолчанию сайт доступен на нашем домене. Можно привязать свой — например, denis-i-maria.ru.
      </p>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#7d766c', textTransform: 'uppercase', marginBottom: 6 }}>Ваш домен</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="input-field" style={{ flex: 1, minWidth: 220 }} placeholder="denis-i-maria.ru" value={domain} onChange={e => setDomain(e.target.value)} />
        <button className="btn-primary" onClick={save} disabled={saving} style={{ padding: '10px 22px', fontSize: 14 }}>Сохранить</button>
      </div>

      <div style={{ marginTop: 20, padding: 16, background: '#fff', border: BORDER, borderRadius: 12 }}>
        <div style={{ fontWeight: 700, color: '#0e1d26', marginBottom: 10 }}>Как подключить</div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: '#5b554c', lineHeight: 1.7 }}>
          <li>Купите домен у любого регистратора (reg.ru, Timeweb и т.п.).</li>
          <li>В DNS-настройках домена <b>у регистратора</b> добавьте две A-записи —
            они направят ваш домен на наш сервер:
            <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 13, background: '#f5f2ec', borderRadius: 8, padding: '8px 12px', lineHeight: 1.8 }}>
              A&nbsp;&nbsp;@&nbsp;&nbsp;&nbsp;→&nbsp;&nbsp;{SERVER_IP}<br />
              A&nbsp;&nbsp;www&nbsp;→&nbsp;&nbsp;{SERVER_IP}
            </div>
          </li>
          <li>Сохраните домен в поле выше и нажмите «Проверить подключение». DNS обычно
            обновляется за 15 минут – 4 часа.</li>
          <li>Когда проверка покажет, что записи верные, <b>напишите нам</b> на{' '}
            <a href="mailto:support@weddingcraft.ru" style={{ textDecoration: 'underline' }}>support@weddingcraft.ru</a> —
            мы выпустим SSL-сертификат для вашего домена и включим его. Обычно в течение суток.
            До этого шага домен будет открываться с предупреждением о сертификате.</li>
        </ol>
      </div>

      {invite.customDomain && (
        <div style={{ marginTop: 16, padding: 16, background: '#fff', border: BORDER, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, color: '#0e1d26' }}>
              Привязан: <b>{invite.customDomain}</b>
            </div>
            <button className="btn-outline" onClick={check} disabled={checking} style={{ padding: '8px 18px', fontSize: 13 }}>
              {checking ? 'Проверяем…' : 'Проверить подключение'}
            </button>
          </div>

          {status && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: BORDER }}>
              <DnsRow label={status.domain} ok={status.dnsOk} ips={status.ips} />
              <DnsRow label={`www.${status.domain}`} ok={status.wwwOk} ips={status.wwwIps} />
              {status.dnsOk ? (
                <div style={{ marginTop: 12, fontSize: 14, color: '#2e8b57' }}>
                  ✓ DNS настроен. Сайт доступен по адресу{' '}
                  <a href={`https://${status.domain}`} target="_blank" rel="noreferrer" style={{ color: '#2e8b57', fontWeight: 700 }}>
                    https://{status.domain}
                  </a>
                  {' '}(при первом открытии выпуск SSL может занять до минуты).
                </div>
              ) : (
                <div style={{ marginTop: 12, fontSize: 13, color: '#b85c5c' }}>
                  A-запись ещё не указывает на {status.expectedIp}. Проверьте настройки DNS
                  у регистратора и повторите — обновление занимает от 15 минут до 4 часов.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Адрес сайта (slug) ────────────────────────────────────────────────────
function SiteAddressCard({ invite, origin, onSaved }: { invite: Invite; origin: string; onSaved: () => void }) {
  const [slug, setSlug] = useState(invite.slug);
  const [saving, setSaving] = useState(false);
  const url = `${origin}/${invite.slug}`;
  const originHost = origin.replace(/^https?:\/\//, '');

  const save = async () => {
    const v = slug.trim().toLowerCase();
    if (!v || v === invite.slug) { toast('Адрес не изменился'); return; }
    setSaving(true);
    try {
      await api.patch(`/api/invites/${invite.id}/slug`, { slug: v });
      toast.success('Адрес сайта обновлён');
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Не удалось изменить адрес');
    } finally { setSaving(false); }
  };

  const copy = () => { navigator.clipboard.writeText(url); toast.success('Ссылка скопирована'); };

  return (
    <div style={{ background: '#fff', border: BORDER, borderRadius: 12, padding: 16, margin: '14px 0 4px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#7d766c', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Адрес сайта</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <a href={url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 200, fontSize: 15, color: PRIMARY, fontWeight: 600, textDecoration: 'none', wordBreak: 'break-all' }}>{url} ↗</a>
        <button onClick={copy} className="btn-outline" style={{ padding: '8px 14px', fontSize: 13 }}>Копировать</button>
        <a href={url} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none', padding: '8px 16px', fontSize: 13 }}>Открыть</a>
      </div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#7d766c', marginBottom: 6 }}>Изменить адрес</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 220, border: BORDER, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <span style={{ fontSize: 13, color: '#9a948a', padding: '0 2px 0 10px', whiteSpace: 'nowrap' }}>{originHost}/</span>
          <input value={slug} onChange={e => setSlug(e.target.value)} className="input-field" style={{ border: 'none', flex: 1, minWidth: 80, padding: '10px 8px' }} placeholder="mysite" />
        </div>
        <button className="btn-primary" onClick={save} disabled={saving} style={{ padding: '10px 20px', fontSize: 14 }}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
      </div>
      <div style={{ fontSize: 12, color: '#9a948a', marginTop: 8 }}>3–40 символов: латиница, цифры, дефис. Например: <b>anna-i-aleksandr</b></div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────
function Stat({ n, label, color }: { n: number; label: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: BORDER, borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
      <div style={{ fontSize: 30, fontWeight: 700, color: color || '#0e1d26', fontFamily: 'var(--font-playfair, Georgia), serif' }}>{n}</div>
      <div style={{ fontSize: 12, color: '#7d766c', marginTop: 2 }}>{label}</div>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 40, textAlign: 'center', color: '#9a948a', fontSize: 14 }}>{children}</div>;
}
