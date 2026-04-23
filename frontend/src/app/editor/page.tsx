'use client';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { TEMPLATES } from '@/lib/constants';
import TemplatePreview from '@/components/TemplatePreview';
import AuthModal from '@/components/AuthModal';
import styles from './page.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface InviteData {
  id: string;
  templateId: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  weddingTime: string;
  venue: string;
  venueAddress: string;
  mapLink: string;
  story: string;
  inviteText: string;
  dressCode: string;
  schedule: { time: string; title: string; icon: string }[];
  coverPhoto: string;
  galleryPhotos: string[];
  colorScheme: string;
  slug: string;
  status: string;
}

const EMPTY: InviteData = {
  id: '', templateId: 'classic',
  groomName: '', brideName: '',
  weddingDate: '', weddingTime: '',
  venue: '', venueAddress: '',
  mapLink: '', story: '', inviteText: '',
  dressCode: '', schedule: [],
  coverPhoto: '', galleryPhotos: [],
  colorScheme: 'warm', slug: '', status: 'draft',
};

const GUEST_DRAFT_KEY = 'wc_guest_draft';

// ─── Main editor content ─────────────────────────────────────────────────────
function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();

  const [data, setData] = useState<InviteData>({
    ...EMPTY,
    templateId: searchParams.get('template') || 'classic',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'couple' | 'event' | 'style' | 'media' | 'text'>('couple');
  const [previewMode, setPreviewMode] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const template = TEMPLATES.find(t => t.id === data.templateId) || TEMPLATES[0];

  // ── Load draft on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    const templateFromUrl = searchParams.get('template') || 'classic';

    if (idFromUrl && user) {
      // Load existing invite from server (logged-in user from dashboard)
      api.get(`/api/invites/${idFromUrl}`)
        .then(res => {
          setData({ ...res.data, galleryPhotos: res.data.galleryPhotos || [] });
          sessionStorage.setItem('wc_draft_id', idFromUrl);
        })
        .catch(() => toast.error('Не удалось загрузить приглашение'));
      return;
    }

    if (user) {
      // Logged-in: load server draft or create new one
      const savedId = sessionStorage.getItem('wc_draft_id');
      // Restore guest draft data if exists
      const guestRaw = localStorage.getItem(GUEST_DRAFT_KEY);
      const guestData: Partial<InviteData> = guestRaw ? JSON.parse(guestRaw) : {};

      if (savedId) {
        api.get(`/api/invites/${savedId}`)
          .then(res => setData({ ...res.data, galleryPhotos: res.data.galleryPhotos || [] }))
          .catch(() => {
            sessionStorage.removeItem('wc_draft_id');
            createServerDraft(templateFromUrl, guestData);
          });
      } else {
        createServerDraft(templateFromUrl, guestData);
      }
    } else {
      // Guest: load from localStorage
      const raw = localStorage.getItem(GUEST_DRAFT_KEY);
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<InviteData>;
          setData(prev => ({ ...prev, ...saved, templateId: templateFromUrl }));
        } catch {}
      } else {
        setData(prev => ({ ...prev, templateId: templateFromUrl }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Persist guest draft to localStorage on every change ──────────────────
  useEffect(() => {
    if (!user) {
      localStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify(data));
    }
  }, [data, user]);

  // ── Create server draft (after login, merge guest data) ──────────────────
  const createServerDraft = useCallback(async (templateId: string, guestData: Partial<InviteData> = {}) => {
    try {
      const res = await api.post('/api/invites', { templateId });
      const newId = res.data.id;
      sessionStorage.setItem('wc_draft_id', newId);

      // If there's guest data, push it immediately
      const merged = { ...res.data, ...guestData, id: newId, galleryPhotos: guestData.galleryPhotos || [] };
      if (Object.keys(guestData).length > 0) {
        await api.put(`/api/invites/${newId}`, merged);
        localStorage.removeItem(GUEST_DRAFT_KEY);
      }
      setData(merged);
    } catch {
      toast.error('Ошибка создания черновика');
    }
  }, []);

  // ── Field setter ─────────────────────────────────────────────────────────
  const set = (field: keyof InviteData, value: string | string[]) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  // ── Save to server (auth required) ───────────────────────────────────────
  const saveToServer = async (): Promise<boolean> => {
    if (!data.id) return false;
    setSaving(true);
    try {
      const res = await api.put(`/api/invites/${data.id}`, data);
      setData(prev => ({ ...prev, slug: res.data.slug }));
      return true;
    } catch {
      toast.error('Ошибка сохранения');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ── What happens when user clicks "Save / To payment" ───────────────────
  const handleSave = async () => {
    if (!user) {
      // Show auth modal for guest
      setShowAuthModal(true);
      return;
    }
    const ok = await saveToServer();
    if (ok) toast.success('Сохранено!');
  };

  const handleProceed = async () => {
    if (!data.brideName && !data.groomName) {
      toast.error('Заполните имя невесты или жениха');
      return;
    }
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    const ok = await saveToServer();
    if (ok) router.push(`/payment?id=${data.id}`);
  };

  // ── After login inside modal ─────────────────────────────────────────────
  const handleAuthSuccess = async () => {
    setShowAuthModal(false);
    // createServerDraft will be triggered by user state change in useEffect
    // Give it a moment then redirect to payment
    toast.success('Приглашение сохранено! Переходим к оплате...');
    setTimeout(async () => {
      const savedId = sessionStorage.getItem('wc_draft_id');
      if (savedId) {
        router.push(`/payment?id=${savedId}`);
      }
    }, 1500);
  };

  // ── Photo uploads ────────────────────────────────────────────────────────
  const uploadCover = async (file: File) => {
    if (!user) {
      toast.error('Загрузка фото доступна после входа в аккаунт');
      setShowAuthModal(true);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/api/upload/image', fd);
      set('coverPhoto', res.data.url);
      toast.success('Фото загружено!');
    } catch { toast.error('Ошибка загрузки'); }
    finally { setUploading(false); }
  };

  const uploadGallery = async (files: FileList) => {
    if (!user) {
      toast.error('Загрузка фото доступна после входа в аккаунт');
      setShowAuthModal(true);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('images', f));
      const res = await api.post('/api/upload/gallery', fd);
      set('galleryPhotos', [...data.galleryPhotos, ...res.data.urls]);
      toast.success(`Загружено ${res.data.urls.length} фото`);
    } catch { toast.error('Ошибка загрузки'); }
    finally { setUploading(false); }
  };

  const TABS = [
    { id: 'couple',   label: '💑 Пара' },
    { id: 'event',    label: '📅 Событие' },
    { id: 'schedule', label: '⏱ Расписание' },
    { id: 'style',    label: '👗 Стиль' },
    { id: 'media',    label: '📸 Фото' },
    { id: 'text',     label: '✍️ Текст' },
  ] as const;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className={`${styles.editor} ${previewMode ? styles.previewOnly : ''}`}>

        {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <Link href="/" className={styles.sidebarLogo}>✦ WeddingCraft</Link>
            {user ? (
              <div className={styles.userBadge}>
                <span className={styles.userDot} />
                {user.name}
              </div>
            ) : (
              <button
                className={styles.guestBadge}
                onClick={() => setShowAuthModal(true)}
                title="Войдите, чтобы сохранить"
              >
                Войти
              </button>
            )}
          </div>

          {/* Guest hint banner */}
          {!user && (
            <div className={styles.guestBanner}>
              <span className={styles.guestBannerIcon}>✏️</span>
              <div>
                <div className={styles.guestBannerTitle}>Режим предпросмотра</div>
                <div className={styles.guestBannerText}>
                  Заполните поля — данные сохранятся при входе
                </div>
              </div>
            </div>
          )}

          {/* Template selector */}
          <div className={styles.templateSelector}>
            <div className={styles.fieldLabel}>Шаблон</div>
            <div className={styles.templateOptions}>
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  className={`${styles.templateOption} ${data.templateId === tpl.id ? styles.templateOptionActive : ''}`}
                  onClick={() => set('templateId', tpl.id)}
                >
                  <div
                    className={styles.templateOptionColor}
                    style={{ background: `linear-gradient(135deg, ${tpl.colors[0]}, ${tpl.colors[1]})` }}
                  />
                  <span className={styles.templateOptionName}>{tpl.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className={styles.tabContent}>

            {/* ── COUPLE tab ──────────────────────────────────────────── */}
            {activeTab === 'couple' && (
              <div className={styles.fields}>
                <Field label="Имя невесты" id="bride-name" required>
                  <input
                    id="bride-name"
                    className="input-field"
                    placeholder="Анна"
                    value={data.brideName}
                    onChange={e => set('brideName', e.target.value)}
                  />
                </Field>
                <Field label="Имя жениха" id="groom-name">
                  <input
                    id="groom-name"
                    className="input-field"
                    placeholder="Михаил"
                    value={data.groomName}
                    onChange={e => set('groomName', e.target.value)}
                  />
                </Field>
                <Field label="Текст приглашения" id="invite-text">
                  <textarea
                    id="invite-text"
                    className="input-field"
                    rows={3}
                    placeholder="Дорогие друзья! Приглашаем вас разделить с нами этот особенный день..."
                    value={data.inviteText}
                    onChange={e => set('inviteText', e.target.value)}
                  />
                </Field>
              </div>
            )}

            {/* ── EVENT tab ───────────────────────────────────────────── */}
            {activeTab === 'event' && (
              <div className={styles.fields}>
                <CalendarPicker
                  value={data.weddingDate}
                  onChange={v => set('weddingDate', v)}
                />
                <Field label="Время начала" id="wedding-time">
                  <div className={styles.timeRow}>
                    {['10:00','12:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'].map(t => (
                      <button
                        key={t}
                        className={`${styles.timeChip} ${data.weddingTime === t ? styles.timeChipActive : ''}`}
                        onClick={() => set('weddingTime', t)}
                      >{t}</button>
                    ))}
                    <input
                      id="wedding-time"
                      className={`input-field ${styles.timeCustom}`}
                      type="time"
                      value={data.weddingTime}
                      onChange={e => set('weddingTime', e.target.value)}
                      placeholder="Другое"
                    />
                  </div>
                </Field>
                <Field label="Место проведения" id="venue">
                  <input
                    id="venue"
                    className="input-field"
                    placeholder='Усадьба "Белый сад"'
                    value={data.venue}
                    onChange={e => set('venue', e.target.value)}
                  />
                </Field>
                <Field label="Адрес" id="venue-address">
                  <input
                    id="venue-address"
                    className="input-field"
                    placeholder="Москва, ул. Розовая, 1"
                    value={data.venueAddress}
                    onChange={e => set('venueAddress', e.target.value)}
                  />
                </Field>
                <Field label="Ссылка на карту" id="map-link">
                  <input
                    id="map-link"
                    className="input-field"
                    placeholder="https://maps.google.com/..."
                    value={data.mapLink}
                    onChange={e => set('mapLink', e.target.value)}
                  />
                </Field>
              </div>
            )}

            {/* ── SCHEDULE tab ─────────────────────────────────────────── */}
            {activeTab === 'schedule' && (
              <div className={styles.fields}>
                <div className={styles.fieldLabel} style={{ marginBottom: 6 }}>Расписание дня</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                  Добавьте события дня — гости увидят их в виде красивой ленты
                </div>

                {/* Preset quick-add */}
                <div style={{ marginBottom: 14 }}>
                  <div className={styles.fieldLabel} style={{ marginBottom: 8 }}>Быстрые пункты</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { time: '14:00', title: 'Сбор гостей', icon: '🥂' },
                      { time: '15:00', title: 'Торжественная регистрация', icon: '💍' },
                      { time: '16:00', title: 'Фотосессия', icon: '📸' },
                      { time: '17:00', title: 'Фуршет', icon: '🍾' },
                      { time: '18:00', title: 'Банкет', icon: '🍽️' },
                      { time: '20:00', title: 'Торт', icon: '🎂' },
                      { time: '22:00', title: 'Танцы', icon: '💃' },
                      { time: '00:00', title: 'Завершение', icon: '🌙' },
                    ].map(p => (
                      <button key={p.title}
                        style={{
                          padding: '5px 12px',
                          border: '1.5px solid rgba(201,169,110,0.3)',
                          borderRadius: 50, background: 'transparent',
                          fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-inter)',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = 'var(--gold)'; (e.target as HTMLButtonElement).style.color = 'var(--dark)'; }}
                        onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = 'rgba(201,169,110,0.3)'; (e.target as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
                        onClick={() => {
                          const already = data.schedule.some(s => s.title === p.title);
                          if (!already) set('schedule', [...data.schedule, p]);
                        }}
                      >
                        {p.icon} {p.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Current schedule items */}
                {data.schedule.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {data.schedule.map((item, i) => (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '60px 36px 1fr auto',
                        gap: 6, alignItems: 'center',
                        padding: '8px 10px',
                        background: 'rgba(201,169,110,0.06)',
                        border: '1px solid rgba(201,169,110,0.18)',
                        borderRadius: 10,
                      }}>
                        <input
                          className="input-field"
                          style={{ padding: '5px 8px', fontSize: 12, textAlign: 'center' }}
                          value={item.time}
                          placeholder="15:00"
                          onChange={e => {
                            const s = [...data.schedule];
                            s[i] = { ...s[i], time: e.target.value };
                            set('schedule', s);
                          }}
                        />
                        <input
                          className="input-field"
                          style={{ padding: '5px 4px', fontSize: 16, textAlign: 'center' }}
                          value={item.icon}
                          onChange={e => {
                            const s = [...data.schedule];
                            s[i] = { ...s[i], icon: e.target.value };
                            set('schedule', s);
                          }}
                        />
                        <input
                          className="input-field"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                          value={item.title}
                          placeholder="Название"
                          onChange={e => {
                            const s = [...data.schedule];
                            s[i] = { ...s[i], title: e.target.value };
                            set('schedule', s);
                          }}
                        />
                        <button
                          onClick={() => set('schedule', data.schedule.filter((_, j) => j !== i))}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#e74c3c', fontSize: 16, padding: '0 4px',
                          }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add custom item */}
                <button
                  style={{
                    width: '100%', padding: '10px',
                    border: '1.5px dashed rgba(201,169,110,0.4)',
                    borderRadius: 10, background: 'transparent',
                    fontSize: 13, color: 'var(--gold-dark)',
                    cursor: 'pointer', fontFamily: 'var(--font-inter)',
                    fontWeight: 600,
                  }}
                  onClick={() => set('schedule', [...data.schedule, { time: '', title: '', icon: '✦' }])}
                >
                  + Добавить своё событие
                </button>
              </div>
            )}

            {/* ── STYLE tab (Dress code) ───────────────────────────────── */}
            {activeTab === 'style' && (
              <div className={styles.fields}>
                <Field label="Дресс-код" id="dress-code">
                  <input
                    id="dress-code"
                    className="input-field"
                    placeholder="White Tie / Смокинг / Casual..."
                    value={data.dressCode}
                    onChange={e => set('dressCode', e.target.value)}
                  />
                </Field>
                <div className={styles.dressPalette}>
                  <div className={styles.fieldLabel} style={{ marginBottom: 10 }}>Быстрый выбор</div>
                  {[
                    { label: 'White Tie', hint: 'Фрак и вечернее платье' },
                    { label: 'Black Tie', hint: 'Смокинг и коктейльное платье' },
                    { label: 'Cocktail', hint: 'Нарядный повседневный стиль' },
                    { label: 'Smart Casual', hint: 'Элегантная повседневность' },
                    { label: 'Белый цвет', hint: 'Только для гостей' },
                    { label: 'Пастельные тона', hint: 'Нежные, светлые оттенки' },
                  ].map(option => (
                    <button
                      key={option.label}
                      className={`${styles.dressOption} ${data.dressCode === option.label ? styles.dressOptionActive : ''}`}
                      onClick={() => set('dressCode', option.label)}
                    >
                      <span className={styles.dressLabel}>{option.label}</span>
                      <span className={styles.dressHint}>{option.hint}</span>
                    </button>
                  ))}
                </div>
                <Field label="История пары" id="story">
                  <textarea
                    id="story"
                    className="input-field"
                    rows={4}
                    placeholder="Расскажите вашу историю любви..."
                    value={data.story}
                    onChange={e => set('story', e.target.value)}
                  />
                </Field>
              </div>
            )}

            {/* ── MEDIA tab ───────────────────────────────────────────── */}
            {activeTab === 'media' && (
              <div className={styles.fields}>
                {!user && (
                  <div className={styles.authHint}>
                    <span>🔒</span>
                    <div>
                      <b>Загрузка фото</b> доступна после входа.
                      <button className={styles.authHintBtn} onClick={() => setShowAuthModal(true)}>
                        Войти бесплатно →
                      </button>
                    </div>
                  </div>
                )}
                <div className={styles.fieldGroup}>
                  <div className={styles.fieldLabel}>Главное фото</div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => e.target.files?.[0] && uploadCover(e.target.files[0])}
                  />
                  <div
                    className={`${styles.dropzone} ${!user ? styles.dropzoneLocked : ''}`}
                    onClick={() => user ? coverInputRef.current?.click() : setShowAuthModal(true)}
                    style={
                      data.coverPhoto
                        ? {
                            backgroundImage: `url(${process.env.NEXT_PUBLIC_API_URL}${data.coverPhoto})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : {}
                    }
                  >
                    {!data.coverPhoto && (
                      <div className={styles.dropzoneInner}>
                        <span className={styles.dropzoneIcon}>{user ? '📷' : '🔒'}</span>
                        <span>{user ? 'Нажмите для загрузки' : 'Войдите для загрузки'}</span>
                        <span className={styles.dropzoneHint}>JPG, PNG до 10 MB</span>
                      </div>
                    )}
                    {data.coverPhoto && <div className={styles.dropzoneOverlay}>Изменить фото</div>}
                  </div>
                </div>

                {user && (
                  <div className={styles.fieldGroup}>
                    <div className={styles.fieldLabel}>Галерея ({data.galleryPhotos.length}/10)</div>
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={e => e.target.files && uploadGallery(e.target.files)}
                    />
                    <button
                      className={styles.addPhotosBtn}
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? 'Загрузка...' : '+ Добавить фото в галерею'}
                    </button>
                    {data.galleryPhotos.length > 0 && (
                      <div className={styles.galleryGrid}>
                        {data.galleryPhotos.map((url, i) => (
                          <div
                            key={i}
                            className={styles.galleryThumb}
                            style={{ backgroundImage: `url(${process.env.NEXT_PUBLIC_API_URL}${url})` }}
                          >
                            <button
                              className={styles.removePhoto}
                              onClick={() => set('galleryPhotos', data.galleryPhotos.filter((_, j) => j !== i))}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── TEXT tab ────────────────────────────────────────────── */}
            {activeTab === 'text' && (
              <div className={styles.fields}>
                <Field label="Текст приглашения" id="text-invite">
                  <textarea
                    id="text-invite"
                    className="input-field"
                    rows={4}
                    placeholder="Дорогие друзья! Мы рады пригласить вас..."
                    value={data.inviteText}
                    onChange={e => set('inviteText', e.target.value)}
                  />
                </Field>
                <Field label="История пары" id="text-story">
                  <textarea
                    id="text-story"
                    className="input-field"
                    rows={5}
                    placeholder="Наша история началась..."
                    value={data.story}
                    onChange={e => set('story', e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* ── Bottom actions ──────────────────────────────────────── */}
          <div className={styles.sidebarActions}>
            {user ? (
              <>
                <button
                  className="btn-outline"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ flex: 1 }}
                >
                  {saving ? 'Сохранение...' : '💾 Сохранить'}
                </button>
                <button
                  id="proceed-to-payment"
                  className="btn-primary"
                  onClick={handleProceed}
                  style={{ flex: 1 }}
                >
                  К оплате →
                </button>
              </>
            ) : (
              <button
                id="save-invite-guest"
                className="btn-primary"
                onClick={handleProceed}
                style={{ width: '100%' }}
              >
                ✦ Сохранить приглашение
              </button>
            )}
          </div>
        </div>

        {/* ── PREVIEW PANEL ──────────────────────────────────────────────── */}
        <div className={styles.preview}>
          <div className={styles.previewHeader}>
            <span className={styles.previewLabel}>
              Предпросмотр — <b>{template.name}</b>
            </span>
            <button
              className={styles.previewToggle}
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? '← Редактор' : '🔍 Полный экран'}
            </button>
          </div>
          <div className={styles.previewFrame}>
            <TemplatePreview
              data={data}
              apiBase={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}
            />
          </div>
        </div>
      </div>

      {/* Auth modal */}
      {showAuthModal && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </>
  );
}

// ── CalendarPicker ───────────────────────────────────────────────────────────
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS_RU   = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function CalendarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = new Date();
  const initDate = value ? new Date(value) : today;
  const [viewYear, setViewYear]   = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  const selected = value ? new Date(value) : null;

  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;     // Mon-based
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    onChange(d.toISOString().split('T')[0]);
  };

  const isSelected = (day: number) =>
    selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === day;

  const isPast = (day: number) =>
    new Date(viewYear, viewMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
        marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Дата свадьбы <span style={{ color: 'var(--gold)' }}>*</span>
      </label>
      <div style={{
        border: '1.5px solid rgba(201,169,110,0.3)',
        borderRadius: 16,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #f5f0e8, #ede4d4)',
          borderBottom: '1px solid rgba(201,169,110,0.15)',
        }}>
          <button onClick={prevMonth} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: '#c9a96e', padding: '2px 8px',
          }}>‹</button>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: '#2c2c2c' }}>
            {MONTHS_RU[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: '#c9a96e', padding: '2px 8px',
          }}>›</button>
        </div>

        {/* Day names */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '8px 12px 4px',
        }}>
          {DAYS_RU.map(d => (
            <div key={d} style={{
              textAlign: 'center', fontSize: 10, fontWeight: 700,
              color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5,
              padding: '4px 0',
            }}>{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '0 12px 12px', gap: 2,
        }}>
          {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const sel = isSelected(day);
            const past = isPast(day);
            return (
              <button
                key={day}
                onClick={() => !past && selectDay(day)}
                style={{
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 2px',
                  fontSize: 13,
                  fontWeight: sel ? 700 : 400,
                  cursor: past ? 'default' : 'pointer',
                  background: sel ? 'linear-gradient(135deg, #e8d5a3, #c9a96e)' : 'transparent',
                  color: sel ? '#1a1208' : past ? '#ccc' : '#2c2c2c',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
                title={past ? 'Прошедшая дата' : ''}
                onMouseEnter={e => {
                  if (!sel && !past) (e.target as HTMLButtonElement).style.background = 'rgba(201,169,110,0.15)';
                }}
                onMouseLeave={e => {
                  if (!sel && !past) (e.target as HTMLButtonElement).style.background = 'transparent';
                }}
              >{day}</button>
            );
          })}
        </div>

        {/* Selected display */}
        {value && (
          <div style={{
            padding: '8px 16px 12px',
            textAlign: 'center',
            fontSize: 13,
            color: '#c9a96e',
            fontWeight: 600,
            borderTop: '1px solid rgba(201,169,110,0.12)',
          }}>
            📅 {new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper Field component ───────────────────────────────────────────────────
function Field({
  label, id, required, children,
}: {
  label: string; id: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}{required && <span style={{ color: 'var(--gold)', marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Page wrapper with Suspense ──────────────────────────────────────────────
export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#fdf6ec',
        }}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(201,169,110,0.3)',
            borderTopColor: '#c9a96e',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
