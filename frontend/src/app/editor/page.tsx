'use client';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Save, ArrowLeft, Eye, Share2, History, Layers, MessageSquare, Copy, Type, Sparkles, LayoutGrid, ZoomOut, ZoomIn, Maximize } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { TEMPLATES, TEMPLATE_FIELDS, TEMPLATE_DEFAULTS, ICON_SETS, BUILTIN_GALLERY, TemplateField, ScheduleItem, DrinkOption } from '@/lib/constants';
import TemplatePreview from '@/components/TemplatePreview';
import AuthModal from '@/components/AuthModal';
import styles from './page.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────
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
  dressCodeColors: string[];
  dressCodePhoto: string;
  schedule: { time: string; title: string; icon: string }[];
  coverPhoto: string;
  galleryPhotos: string[];
  colorScheme: string;
  slug: string;
  status: string;
  enabledSections: Record<string, boolean>;
  customData: Record<string, any>;
}

const EMPTY: InviteData = {
  id: '', templateId: 'vadimdarya',
  groomName: '', brideName: '',
  weddingDate: '', weddingTime: '15:00',
  venue: '', venueAddress: '', mapLink: '',
  story: '',
  inviteText: 'С радостью приглашаем вас разделить с нами один из самых счастливых дней нашей жизни!',
  dressCode: 'Пастельные тона',
  dressCodeColors: [], dressCodePhoto: '',
  schedule: [],
  coverPhoto: '', galleryPhotos: [],
  colorScheme: 'warm', slug: '', status: 'draft',
  enabledSections: { couple: true, event: true, schedule: true, style: true, gallery: true },
  customData: {},
};

const GUEST_DRAFT_KEY = 'wc_guest_draft';

const PASTEL_COLORS = [
  { name: 'Пудровая роза',   hex: '#e8c4b8' },
  { name: 'Топлёное молоко', hex: '#f5ede0' },
  { name: 'Шалфей',          hex: '#b2c4b2' },
  { name: 'Лаванда',         hex: '#c9b8d8' },
  { name: 'Айвори',          hex: '#f0e8d0' },
  { name: 'Лимонный',        hex: '#f0e8a0' },
  { name: 'Голубой',         hex: '#a8c4d4' },
  { name: 'Персик. св.',     hex: '#f4d4b8' },
  { name: 'Мятный',          hex: '#a8d4c4' },
  { name: 'Розовый',         hex: '#d4a8b8' },
  { name: 'С-голубой',       hex: '#a0b4c4' },
  { name: 'Карамель',        hex: '#d4b490' },
  { name: 'Шоколадный',      hex: '#8c6448' },
  { name: 'Оливковый',       hex: '#909870' },
  { name: 'Персиковый',      hex: '#f0b898' },
];

const PRESET_SCHEDULE = [
  { time: '14:00', title: 'Сбор гостей', icon: '🥂' },
  { time: '15:00', title: 'Welcome',      icon: '👋' },
  { time: '16:00', title: 'Церемония',    icon: '💍' },
  { time: '17:00', title: 'Банкет',       icon: '🍽️' },
  { time: '19:00', title: 'Торт',         icon: '🎂' },
  { time: '21:00', title: 'Танцы',        icon: '💃' },
  { time: '23:00', title: 'Финал',        icon: '✨' },
];

// ─── Setup Step ───────────────────────────────────────────────────────────────
function SetupStep({ templateId, onComplete, initialData }: {
  templateId: string;
  onComplete: (d: Partial<InviteData>) => void;
  initialData?: Partial<InviteData>;
}) {
  const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
  const [groomName,   setGroomName]   = useState(initialData?.groomName || '');
  const [brideName,   setBrideName]   = useState(initialData?.brideName || '');
  const [weddingDate, setWeddingDate] = useState(initialData?.weddingDate || '');
  const [weddingTime, setWeddingTime] = useState(initialData?.weddingTime || '15:00');
  const [venue,       setVenue]       = useState(initialData?.venue || '');
  const [venueAddress,setVenueAddress]= useState(initialData?.venueAddress || '');
  const [mapLink,     setMapLink]     = useState(initialData?.mapLink || '');

  const handleSubmit = () => {
    if (!groomName.trim() && !brideName.trim()) {
      toast.error('Введите хотя бы одно имя');
      return;
    }
    onComplete({ 
      groomName: groomName.trim(), 
      brideName: brideName.trim(), 
      weddingDate, 
      weddingTime,
      venue,
      venueAddress,
      mapLink
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '0 48px', height: 64, borderBottom: '1px solid rgba(206,197,186,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', flexShrink: 0 }}>
        <Link href="/" style={{ fontFamily: 'var(--font-playfair)', fontSize: 20, color: '#0e1d26', textDecoration: 'none', fontWeight: 500 }}>Eloquence</Link>
        <Link href="/templates" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#7d766c', textDecoration: 'none' }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Назад к шаблонам
        </Link>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7d766c', fontFamily: 'var(--font-inter)', marginBottom: 12 }}>
            Шаблон: {template.name}
          </p>
          <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 34, fontWeight: 400, color: '#0e1d26', lineHeight: 1.2, marginBottom: 8 }}>
            Расскажите о вашей свадьбе
          </h1>
          <p style={{ fontSize: 14, color: '#7d766c', lineHeight: 1.6, marginBottom: 32, fontFamily: 'var(--font-inter)' }}>
            Заполните основные данные — их можно будет изменить в любой момент через настройки.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Names */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <SetupField label="Имя жениха">
                <input className="input-field" placeholder="Вадим" value={groomName}
                  onChange={e => setGroomName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} autoFocus />
              </SetupField>
              <SetupField label="Имя невесты" required>
                <input className="input-field" placeholder="Дарья" value={brideName}
                  onChange={e => setBrideName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              </SetupField>
            </div>

            {/* Date and Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <SetupField label="Дата свадьбы" required>
                <input type="date" className="input-field" value={weddingDate} onChange={e => setWeddingDate(e.target.value)} />
              </SetupField>
              <SetupField label="Время начала">
                <input type="time" className="input-field" value={weddingTime} onChange={e => setWeddingTime(e.target.value)} />
              </SetupField>
            </div>

            {/* Venue */}
            <SetupField label="Название места">
              <input className="input-field" placeholder="«Артурс Спа Отель»" value={venue} onChange={e => setVenue(e.target.value)} />
            </SetupField>
            <SetupField label="Адрес">
              <input className="input-field" placeholder="Московская обл., Мытищи..." value={venueAddress} onChange={e => setVenueAddress(e.target.value)} />
            </SetupField>
            <SetupField label="Ссылка на карту">
              <input className="input-field" placeholder="https://yandex.ru/maps/..." value={mapLink} onChange={e => setMapLink(e.target.value)} />
            </SetupField>
          </div>

          <button onClick={handleSubmit} className="btn-primary"
            style={{ marginTop: 32, width: '100%', padding: 16, fontSize: 14, letterSpacing: '0.04em' }}>
            Продолжить в редакторе →
          </button>
        </div>
      </div>
    </div>
  );
}

function SetupField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7d766c', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-inter)' }}>
        {label}{required && <span style={{ color: '#685d4a', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────
function EditorContent() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const { user }      = useAuthStore();

  const templateIdFromUrl = searchParams.get('template') || 'vadimdarya';
  const idFromUrl         = searchParams.get('id');

  const [step,          setStep]          = useState<'setup' | 'editor'>(idFromUrl ? 'editor' : 'setup');
  const [activeSection, setActiveSection] = useState<string>('couple');
  const [data,          setData]          = useState<InviteData>({ ...EMPTY, templateId: templateIdFromUrl });
  const [saving,        setSaving]        = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPreview,   setShowPreview]   = useState(false);
  
  const [newColorHex, setNewColorHex] = useState('#000000');

  const coverInputRef      = useRef<HTMLInputElement>(null);
  const galleryInputRef    = useRef<HTMLInputElement>(null);
  const dressPhotoRef      = useRef<HTMLInputElement>(null);
  const pendingSetupRef    = useRef<Partial<InviteData> | null>(null);

  const template = TEMPLATES.find(t => t.id === data.templateId) || TEMPLATES[0];
  const apiBase  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  // Схема полей для шаблона (если есть — рендерим движок полей, иначе старый сайдбар)
  const sections = TEMPLATE_FIELDS[data.templateId];

  // ── Load draft ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'editor') return;
    const setup = pendingSetupRef.current;
    pendingSetupRef.current = null;

    if (idFromUrl && user) {
      api.get(`/api/invites/${idFromUrl}`)
        .then(res => {
          setData(prev => ({ ...prev, ...res.data, ...(setup || {}), dressCodeColors: res.data.dressCodeColors || [], customData: res.data.customData || {} }));
          sessionStorage.setItem('wc_draft_id', idFromUrl);
        })
        .catch(() => toast.error('Не удалось загрузить приглашение'));
      return;
    }
    if (user) {
      const savedId  = sessionStorage.getItem('wc_draft_id');
      const guestRaw = localStorage.getItem(GUEST_DRAFT_KEY);
      let guestData: Partial<InviteData> = {};
      if (guestRaw) { try { guestData = JSON.parse(guestRaw); } catch {} }
      const mergedGuest = { ...guestData, ...(setup || {}) };
      if (savedId) {
        api.get(`/api/invites/${savedId}`)
          .then(res => setData(prev => ({ ...prev, ...res.data, ...(setup || {}), dressCodeColors: res.data.dressCodeColors || [], customData: res.data.customData || {} })))
          .catch(() => { sessionStorage.removeItem('wc_draft_id'); createDraft(templateIdFromUrl, mergedGuest); });
      } else {
        createDraft(templateIdFromUrl, mergedGuest);
      }
    } else {
      const raw = localStorage.getItem(GUEST_DRAFT_KEY);
      let saved: Partial<InviteData> = {};
      if (raw) { try { saved = JSON.parse(raw) as Partial<InviteData>; } catch {} }
      setData(prev => ({ ...prev, ...saved, ...(setup || {}), templateId: templateIdFromUrl, dressCodeColors: (setup?.dressCodeColors || saved.dressCodeColors || []) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, user]);

  useEffect(() => {
    if (!user && step === 'editor') localStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify(data));
  }, [data, user, step]);

  // ── Заполнение полей значениями по умолчанию (= содержимое дизайна) ──────────
  // Делает редактор сразу заполненным реальным текстом/фото без изменения вида.
  // Помечается, для какого шаблона выполнено (__seededTemplate). При смене шаблона
  // специфичные поля сбрасываются на дефолты нового шаблона (данные другого шаблона
  // не должны попадать в чужой дизайн).
  useEffect(() => {
    if (step !== 'editor') return;
    const defs = TEMPLATE_DEFAULTS[data.templateId];
    if (!defs) return;
    setData(prev => {
      const cd = (prev.customData || {}) as any;
      if (cd.__seededTemplate === prev.templateId) return prev;
      // wasOther — данные пришли от ДРУГОГО шаблона → сбрасываем на дефолты текущего
      const wasOther = !!cd.__seededTemplate && cd.__seededTemplate !== prev.templateId;
      const keepStr = (cur: string, def?: string) =>
        wasOther ? (def ?? cur) : (cur && cur.trim() ? cur : (def ?? cur));
      const keepArr = <T,>(cur: T[], def?: T[]) =>
        wasOther ? (def ?? cur) : (cur && cur.length ? cur : (def ?? cur));
      const seededCustom = {
        ...(defs.custom || {}),
        ...(defs.drinks ? { drinks: defs.drinks } : {}),
        ...(wasOther ? {} : cd),       // в рамках того же/нового пустого — сохранённое имеет приоритет
        __seededTemplate: prev.templateId,
      };
      return {
        ...prev,
        inviteText: (!wasOther && prev.inviteText && prev.inviteText !== EMPTY.inviteText)
          ? prev.inviteText : (defs.inviteText ?? prev.inviteText),
        venue: wasOther ? (defs.venue ?? prev.venue) : (prev.venue || (defs.venue ?? prev.venue)),
        story: keepStr(prev.story, defs.story),
        schedule: keepArr(prev.schedule, defs.schedule),
        dressCodeColors: keepArr(prev.dressCodeColors, defs.dressCodeColors),
        dressCodePhoto: wasOther
          ? (defs.dressCodePhoto ?? prev.dressCodePhoto)
          : (prev.dressCodePhoto || defs.dressCodePhoto || prev.dressCodePhoto),
        customData: seededCustom,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, data.templateId, data.id]);

  const createDraft = useCallback(async (templateId: string, guestData: Partial<InviteData> = {}) => {
    try {
      const res    = await api.post('/api/invites', { templateId });
      const newId  = res.data.id;
      sessionStorage.setItem('wc_draft_id', newId);
      const merged = { ...res.data, ...guestData, id: newId, dressCodeColors: guestData.dressCodeColors || [] };
      if (Object.keys(guestData).length > 0) {
        await api.put(`/api/invites/${newId}`, merged);
        localStorage.removeItem(GUEST_DRAFT_KEY);
      }
      setData(merged);
    } catch {
      setData(prev => ({ ...prev, ...guestData, templateId, dressCodeColors: guestData.dressCodeColors || [] }));
    }
  }, []);

  const set = <K extends keyof InviteData>(field: K, value: InviteData[K]) =>
    setData(prev => ({ ...prev, [field]: value }));

  // Запись поля, специфичного для шаблона (хранится в customData[id])
  const setCustom = (id: string, value: any) =>
    setData(prev => ({ ...prev, customData: { ...(prev.customData || {}), [id]: value } }));

  // Универсальная запись поля верхнего уровня по строковому ключу (для движка схемы)
  const setAny = (key: string, value: any) =>
    setData(prev => ({ ...prev, [key]: value }));

  // Загрузка картинки, возвращает URL (для ImagePicker)
  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('image', file);
      const res = await api.post('/api/upload/image', fd);
      return res.data.url as string;
    } catch { toast.error('Ошибка загрузки'); return null; }
    finally { setUploading(false); }
  };

  const saveToServer = async (): Promise<boolean> => {
    if (!data.id) return false;
    setSaving(true);
    try {
      const res = await api.put(`/api/invites/${data.id}`, data);
      setData(prev => ({ ...prev, slug: res.data.slug }));
      return true;
    } catch { toast.error('Ошибка сохранения'); return false; }
    finally { setSaving(false); }
  };

  const handleSave = async () => {
    if (!user) { setShowAuthModal(true); return; }
    if (await saveToServer()) toast.success('Сохранено!');
  };

  const handleShare = async () => {
    if (!data.brideName && !data.groomName) { toast.error('Введите имена'); return; }
    if (!user) { setShowAuthModal(true); return; }
    if (await saveToServer()) router.push(`/payment?id=${data.id}`);
  };

  const upload = async (file: File, field: 'coverPhoto' | 'dressCodePhoto') => {
    // allow anonymous upload for coverPhoto, but dressCodePhoto might still require user, let's just make both public for ease
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('image', file);
      const res = await api.post('/api/upload/image', fd);
      set(field, res.data.url); toast.success('Загружено!');
    } catch { toast.error('Ошибка загрузки'); }
    finally { setUploading(false); }
  };

  const uploadGallery = async (files: FileList) => {
    if (!user) { setShowAuthModal(true); return; }
    setUploading(true);
    try {
      const fd = new FormData(); Array.from(files).forEach(f => fd.append('images', f));
      const res = await api.post('/api/upload/gallery', fd);
      set('galleryPhotos', [...data.galleryPhotos, ...res.data.urls]);
      toast.success(`Загружено ${res.data.urls.length} фото`);
    } catch { toast.error('Ошибка загрузки'); }
    finally { setUploading(false); }
  };

  const handleAddColor = () => {
    const cur = data.dressCodeColors || [];
    if (!cur.includes(newColorHex)) {
      set('dressCodeColors', [...cur, newColorHex]);
    }
  };

  const handleSetupComplete = (setupData: Partial<InviteData>) => {
    pendingSetupRef.current = setupData;
    setData(prev => ({ ...prev, ...setupData }));
    setStep('editor');
  };

  if (step === 'setup') {
    return <SetupStep templateId={templateIdFromUrl} onComplete={handleSetupComplete} initialData={data} />;
  }

  const coupleLabel = (data.groomName || data.brideName)
    ? `${data.groomName}${data.groomName && data.brideName ? ' & ' : ''}${data.brideName}`
    : 'Новое приглашение';

  return (
    <>
      {/* ── FULL PREVIEW OVERLAY ──────────────────────────────────────────── */}
      {showPreview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0d0b09', overflow: 'auto' }}>
          <button onClick={() => setShowPreview(false)}
            style={{ position: 'fixed', top: 16, right: 16, zIndex: 10000, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-inter)', backdropFilter: 'blur(8px)' }}>
            ✕ Закрыть
          </button>
          <TemplatePreview data={data} apiBase={apiBase} fullPage />
        </div>
      )}

      <div className={styles.page}>

        {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <Link href="/" className={styles.topBarTitle}>Eloquence</Link>
            <div className={styles.topBarBreadcrumb}>
              <span className={styles.topBarSep}>›</span>
              <span>Шаблоны</span>
              <span className={styles.topBarSep}>›</span>
              <Link href="/templates">Коллекция {template.name}</Link>
              <span className={styles.topBarSep}>›</span>
              <span className={styles.topBarBreadcrumbCurrent}>{coupleLabel}</span>
            </div>
          </div>
          <div className={styles.topBarRight}>
            <button className={styles.topBarBtnOutline} onClick={() => setStep('setup')} style={{ marginRight: 16 }}>
              Имена и дата
            </button>
            <button className={styles.topBarIconBtn} onClick={handleSave} disabled={saving} title="Сохранить">
              <Save size={18} />
            </button>
            <button className={styles.topBarBtnOutline} onClick={() => setShowPreview(true)}>
              Предпросмотр
            </button>
            <button className={styles.topBarBtnPrimary} onClick={handleShare}>
              Поделиться
            </button>
          </div>
        </header>

        <div className={styles.editorBody}>

          {/* ── CANVAS (LEFT) ─────────────────────────────────────────────── */}
          <main className={styles.canvas}>
            <div className={styles.canvasControls}>
              <div className={styles.zoomGroup}>
                <button className={styles.zoomBtn}><ZoomOut size={16} /></button>
                <button className={styles.zoomBtn}><ZoomIn size={16} /></button>
                <div className={styles.zoomDivider} />
                <button className={styles.zoomBtn}><Maximize size={16} /></button>
              </div>
            </div>
            <div className={styles.phoneContainer}>
              <div className={styles.phoneMockup}>
                <div className={styles.phoneScreen}>
                  <div className={styles.phoneContent}>
                    <TemplatePreview data={data} apiBase={apiBase} editing />
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────── */}
          <aside className={styles.rightSidebar}>
            <div className={styles.sidebarBranding}>
              <div className={styles.sidebarTitle}>Редактор</div>
              <div className={styles.sidebarSubtitle}>{template.name}</div>
            </div>

            <div className={styles.sidebarContent}>

              {sections ? sections.map(section => (
                <div className={styles.fields} key={section.title}>
                  <div className={styles.panelTitle}>{section.icon ? section.icon + ' ' : ''}{section.title}</div>
                  {section.fields.map(f => (
                    <SchemaFieldRenderer
                      key={f.id}
                      field={f}
                      value={f.scope === 'data' ? (data as any)[f.id] : (data.customData || {})[f.id]}
                      onChange={(v: any) => (f.scope === 'data' ? setAny(f.id, v) : setCustom(f.id, v))}
                      apiBase={apiBase}
                      uploadImage={uploadImage}
                    />
                  ))}
                </div>
              )) : (<>

              <div className={styles.fields}>
                <div className={styles.panelTitle}>Локация</div>

                <Field label="Название места">
                  <input className="input-field" placeholder="«Артурс Спа Отель»" value={data.venue} onChange={e => set('venue', e.target.value)} />
                </Field>
                <Field label="Адрес">
                  <input className="input-field" placeholder="Московская обл., Мытищи..." value={data.venueAddress} onChange={e => set('venueAddress', e.target.value)} />
                </Field>
                <Field label="Ссылка на карту">
                  <input className="input-field" placeholder="https://yandex.ru/maps/..." value={data.mapLink} onChange={e => set('mapLink', e.target.value)} />
                </Field>

                <div className={styles.panelTitle}>Текст и Фото</div>
                
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7d766c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, fontFamily: 'var(--font-inter)' }}>Главное фото (фон)</div>
                  <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && upload(e.target.files[0], 'coverPhoto')} />
                  <div className={styles.dropzone}
                    onClick={() => coverInputRef.current?.click()}
                    style={data.coverPhoto ? { backgroundImage: `url(${apiBase}${data.coverPhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                    {!data.coverPhoto && (
                      <div className={styles.dropzoneInner}>
                        <span className={styles.dropzoneIcon}>📷</span>
                        <span>Загрузить фото</span>
                        <span className={styles.dropzoneHint}>JPG, PNG до 10 MB</span>
                      </div>
                    )}
                    {data.coverPhoto && <div className={styles.dropzoneOverlay}>Изменить</div>}
                  </div>
                  {data.coverPhoto && (
                    <button style={{ marginTop: 6, width: '100%', padding: 6, border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, background: 'transparent', fontSize: 11, color: '#e74c3c', cursor: 'pointer' }}
                      onClick={() => set('coverPhoto', '')}>Удалить</button>
                  )}
                </div>

                <Field label="Текст приглашения">
                  <textarea className="input-field" rows={4} value={data.inviteText} onChange={e => set('inviteText', e.target.value)} />
                </Field>
                <Field label="Пожелания и детали">
                  <textarea className="input-field" rows={5} placeholder="Например: Просим не дарить цветы..." value={data.story} onChange={e => set('story', e.target.value)} />
                </Field>
              </div>

              <div className={styles.fields}>
                <div className={styles.panelTitle}>⏱ Программа дня</div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7d766c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, fontFamily: 'var(--font-inter)' }}>Быстрое добавление</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {PRESET_SCHEDULE.map(p => {
                      const active = data.schedule.some(s => s.title === p.title);
                      return (
                        <button key={p.title}
                          style={{ padding: '4px 10px', border: '1px solid rgba(206,197,186,0.6)', borderRadius: 50, background: active ? '#685d4a' : 'transparent', color: active ? '#fff' : '#4b463d', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-inter)', transition: 'all 0.15s' }}
                          onClick={() => {
                            if (active) set('schedule', data.schedule.filter(s => s.title !== p.title));
                            else set('schedule', [...data.schedule, p].sort((a, b) => a.time.localeCompare(b.time)));
                          }}>
                          {p.icon} {p.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.schedule.map((item, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '68px 32px 1fr 26px', gap: 5, alignItems: 'center', padding: '7px 9px', background: '#f5faff', border: '1px solid rgba(206,197,186,0.35)', borderRadius: 10 }}>
                      <input className="input-field" style={{ padding: '4px 2px', fontSize: 12, textAlign: 'center' }} placeholder="15:00" type="time" value={item.time} onChange={e => { const s = [...data.schedule]; s[i] = { ...s[i], time: e.target.value }; set('schedule', s); }} />
                      <input className="input-field" style={{ padding: '4px 2px', fontSize: 15, textAlign: 'center' }} value={item.icon} onChange={e => { const s = [...data.schedule]; s[i] = { ...s[i], icon: e.target.value }; set('schedule', s); }} />
                      <input className="input-field" style={{ padding: '4px 6px', fontSize: 12 }} placeholder="Событие" value={item.title} onChange={e => { const s = [...data.schedule]; s[i] = { ...s[i], title: e.target.value }; set('schedule', s); }} />
                      <button onClick={() => set('schedule', data.schedule.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
                <button style={{ width: '100%', padding: 9, border: '1.5px dashed rgba(206,197,186,0.7)', borderRadius: 10, background: 'transparent', fontSize: 12, color: '#685d4a', cursor: 'pointer', fontFamily: 'var(--font-inter)', fontWeight: 600, marginTop: 8 }}
                  onClick={() => set('schedule', [...data.schedule, { time: '', title: '', icon: '✦' }])}>
                  + Добавить вручную
                </button>
              </div>

              <div className={styles.fields}>
                <div className={styles.panelTitle}>ДРЕСС-КОД</div>
                <Field label="Подпись дресс-кода">
                  <input className="input-field" placeholder="Пастельные тона" value={data.dressCode} onChange={e => set('dressCode', e.target.value)} />
                </Field>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#7d766c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, fontFamily: 'var(--font-inter)' }}>Цвета палитры</div>
                <div style={{ marginBottom: 14 }}>
                  <div className={styles.colorSwatches} style={{ flexWrap: 'wrap', marginBottom: 12 }}>
                    {(data.dressCodeColors || []).map(hex => (
                      <div key={hex} title={hex}
                        className={`${styles.swatch} ${styles.swatchActive}`}
                        style={{ background: hex, position: 'relative' }}
                        onClick={() => {
                          set('dressCodeColors', data.dressCodeColors.filter(x => x !== hex));
                        }}
                      >
                         <div style={{ position: 'absolute', top: -5, right: -5, background: '#e74c3c', color: 'white', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: 'pointer' }}>×</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={newColorHex} onChange={e => setNewColorHex(e.target.value)} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                    <input type="text" className="input-field" value={newColorHex} onChange={e => setNewColorHex(e.target.value)} style={{ flex: 1, fontFamily: 'monospace' }} />
                    <button onClick={handleAddColor} style={{ padding: '10px 16px', background: '#685d4a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Добавить</button>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7d766c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, fontFamily: 'var(--font-inter)' }}>Фото образа</div>
                  <input ref={dressPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && upload(e.target.files[0], 'dressCodePhoto')} />
                  <div className={styles.dropzone}
                    onClick={() => dressPhotoRef.current?.click()}
                    style={data.dressCodePhoto ? { backgroundImage: `url(${apiBase}${data.dressCodePhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                    {!data.dressCodePhoto && (
                      <div className={styles.dropzoneInner}>
                        <span className={styles.dropzoneIcon}>👗</span>
                        <span>Пример образа</span>
                        <span className={styles.dropzoneHint}>JPG, PNG до 10 MB</span>
                      </div>
                    )}
                    {data.dressCodePhoto && <div className={styles.dropzoneOverlay}>Изменить</div>}
                  </div>
                  {data.dressCodePhoto && (
                    <button style={{ marginTop: 6, width: '100%', padding: 6, border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, background: 'transparent', fontSize: 11, color: '#e74c3c', cursor: 'pointer' }}
                      onClick={() => set('dressCodePhoto', '')}>Удалить фото</button>
                  )}
                </div>
              </div>
              </>)}
            </div>

            {/* ── SIDEBAR FOOTER ──────────────────────────────────────────── */}
            <div className={styles.sidebarFooter}>
              <button className={styles.finishBtn} onClick={handleSave}>
                ЗАВЕРШИТЬ ДИЗАЙН ✓
              </button>
            </div>
          </aside>

          {/* ── RIGHT ICONS PANEL ───────────────────────────────────────── */}
          <aside className={styles.rightIconsPanel}>
            <button className={styles.rightIconBtn} title="История"><History size={20} /></button>
            <button className={styles.rightIconBtn} title="Слои"><Layers size={20} /></button>
            <button className={styles.rightIconBtn} title="Комментарии"><MessageSquare size={20} /></button>
          </aside>
        </div>
      </div>

      {showAuthModal && (
        <AuthModal onSuccess={() => { setShowAuthModal(false); }} onClose={() => setShowAuthModal(false)} />
      )}
    </>
  );
}

// ─── Движок полей по схеме шаблона ─────────────────────────────────────────────
const iconBtn = (disabled: boolean): React.CSSProperties => ({
  width: 26, height: 26, border: '1px solid rgba(206,197,186,0.6)', borderRadius: 6,
  background: '#fff', cursor: disabled ? 'default' : 'pointer', fontSize: 14, lineHeight: 1,
  color: disabled ? '#ccc' : '#685d4a', padding: 0,
});

function CharCounter({ value, max }: { value: string; max: number }) {
  const len = (value || '').length;
  return (
    <div style={{ textAlign: 'right', fontSize: 10, color: len >= max ? '#e74c3c' : '#a39b8e', marginTop: 3, fontFamily: 'var(--font-inter)' }}>
      {len} / {max}
    </div>
  );
}

function SchemaFieldRenderer({ field, value, onChange, apiBase, uploadImage }: {
  field: TemplateField;
  value: any;
  onChange: (v: any) => void;
  apiBase: string;
  uploadImage: (f: File) => Promise<string | null>;
}) {
  switch (field.type) {
    case 'text':
      return (
        <Field label={field.label}>
          <input className="input-field" placeholder={field.hint || ''} maxLength={field.maxLength}
            value={value || ''} onChange={e => onChange(e.target.value)} />
          {field.maxLength ? <CharCounter value={value} max={field.maxLength} /> : null}
        </Field>
      );
    case 'textarea':
      return (
        <Field label={field.label}>
          <textarea className="input-field" rows={4} placeholder={field.hint || ''} maxLength={field.maxLength}
            value={value || ''} onChange={e => onChange(e.target.value)} />
          {field.maxLength ? <CharCounter value={value} max={field.maxLength} /> : null}
        </Field>
      );
    case 'image':
      return (
        <Field label={field.label}>
          <ImagePicker value={value || ''} onChange={onChange} apiBase={apiBase} uploadImage={uploadImage} />
        </Field>
      );
    case 'colorList':
      return (
        <Field label={field.label}>
          <ColorListEditor value={value || []} onChange={onChange} />
        </Field>
      );
    case 'schedule':
      return <ScheduleEditor value={value || []} onChange={onChange} iconSet={field.iconSet} withDesc={field.withDesc} />;
    case 'drinks':
      return <DrinksEditor value={value || []} onChange={onChange} />;
    default:
      return null;
  }
}

function ImagePicker({ value, onChange, apiBase, uploadImage }: {
  value: string; onChange: (v: string) => void; apiBase: string;
  uploadImage: (f: File) => Promise<string | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showGallery, setShowGallery] = useState(false);
  const resolve = (url: string) => !url ? ''
    : (/^https?:\/\//.test(url) || url.startsWith('data:') || url.startsWith('/invite/')) ? url
      : url.startsWith('/') ? apiBase + url : url;
  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={async e => {
          const f = e.target.files?.[0];
          if (f) { const u = await uploadImage(f); if (u) onChange(u); }
          if (inputRef.current) inputRef.current.value = '';
        }} />
      <div className={styles.dropzone}
        onClick={() => inputRef.current?.click()}
        style={value ? { backgroundImage: `url(${resolve(value)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
        {!value && (
          <div className={styles.dropzoneInner}>
            <span className={styles.dropzoneIcon}>📷</span>
            <span>Загрузить фото</span>
            <span className={styles.dropzoneHint}>JPG, PNG до 10 MB</span>
          </div>
        )}
        {value && <div className={styles.dropzoneOverlay}>Изменить</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button type="button" onClick={() => setShowGallery(true)}
          style={{ flex: 1, padding: 7, border: '1px solid rgba(206,197,186,0.6)', borderRadius: 8, background: 'transparent', fontSize: 12, color: '#4b463d', cursor: 'pointer', fontFamily: 'var(--font-inter)' }}>
          🖼 Из галереи
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')}
            style={{ flex: 1, padding: 7, border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, background: 'transparent', fontSize: 12, color: '#e74c3c', cursor: 'pointer' }}>
            Удалить
          </button>
        )}
      </div>
      {showGallery && <GalleryModal onPick={u => { onChange(u); setShowGallery(false); }} onClose={() => setShowGallery(false)} />}
    </div>
  );
}

function GalleryModal({ onPick, onClose }: { onPick: (u: string) => void; onClose: () => void }) {
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(13,11,9,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(206,197,186,0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-inter)', fontWeight: 700, fontSize: 14, color: '#0e1d26' }}>Встроенная галерея</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#7d766c' }}>✕</button>
        </div>
        <div style={{ padding: 14, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
          {BUILTIN_GALLERY.map(src => (
            <button key={src} onClick={() => onPick(src)}
              style={{ aspectRatio: '1 / 1', border: '1px solid rgba(206,197,186,0.5)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', padding: 0, background: '#f5f0e8' }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorListEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const colors = value || [];
  const [hex, setHex] = useState('#c79bd6');
  return (
    <div style={{ marginBottom: 4 }}>
      <div className={styles.colorSwatches} style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {colors.map((c, i) => (
          <div key={c + i} title={c} className={`${styles.swatch} ${styles.swatchActive}`}
            style={{ background: c, position: 'relative' }}
            onClick={() => onChange(colors.filter((_, j) => j !== i))}>
            <div style={{ position: 'absolute', top: -5, right: -5, background: '#e74c3c', color: 'white', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: 'pointer' }}>×</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="color" value={hex} onChange={e => setHex(e.target.value)} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
        <input type="text" className="input-field" value={hex} onChange={e => setHex(e.target.value)} style={{ flex: 1, fontFamily: 'monospace' }} />
        <button type="button" onClick={() => { if (!colors.includes(hex)) onChange([...colors, hex]); }}
          style={{ padding: '10px 16px', background: '#685d4a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Добавить</button>
      </div>
    </div>
  );
}

function ScheduleEditor({ value, onChange, iconSet, withDesc }: {
  value: ScheduleItem[]; onChange: (v: ScheduleItem[]) => void; iconSet?: string; withDesc?: boolean;
}) {
  const items = value || [];
  const icons = (iconSet && ICON_SETS[iconSet]) || [];
  const update = (i: number, patch: Partial<ScheduleItem>) =>
    onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, dir: number) => {
    const j = i + dir; if (j < 0 || j >= items.length) return;
    const s = [...items]; const t = s[i]; s[i] = s[j]; s[j] = t; onChange(s);
  };
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const add = () => onChange([...items, { time: '', title: '', icon: icons[0] || '', ...(withDesc ? { desc: '' } : {}) }]);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{ padding: 9, background: '#fafaf7', border: '1px solid rgba(206,197,186,0.4)', borderRadius: 10 }}>
            {icons.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
                {icons.map(ic => (
                  <button key={ic} type="button" onClick={() => update(i, { icon: ic })}
                    style={{ width: 34, height: 34, padding: 3, borderRadius: 8, cursor: 'pointer', background: item.icon === ic ? '#efe3d2' : '#fff', border: item.icon === ic ? '2px solid #b08f4f' : '1px solid rgba(206,197,186,0.6)' }}>
                    <img src={ic} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: icons.length > 0 ? '78px 1fr auto' : '78px 44px 1fr auto', gap: 6, alignItems: 'center' }}>
              <input className="input-field" type="time" style={{ padding: '6px 4px', fontSize: 12, textAlign: 'center' }} value={item.time} onChange={e => update(i, { time: e.target.value })} />
              {icons.length === 0 && (
                <input className="input-field" style={{ padding: '6px 2px', fontSize: 16, textAlign: 'center' }} placeholder="✦" value={item.icon} onChange={e => update(i, { icon: e.target.value })} title="Эмодзи (необязательно)" />
              )}
              <input className="input-field" style={{ padding: '6px 8px', fontSize: 12 }} placeholder="Событие" value={item.title} onChange={e => update(i, { title: e.target.value })} />
              <div style={{ display: 'flex', gap: 2 }}>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={iconBtn(i === 0)}>↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} style={iconBtn(i === items.length - 1)}>↓</button>
                <button type="button" onClick={() => remove(i)} style={{ ...iconBtn(false), color: '#e74c3c' }}>×</button>
              </div>
            </div>
            {withDesc && (
              <textarea className="input-field" rows={2} placeholder="Описание (необязательно)" style={{ marginTop: 6, fontSize: 12 }}
                value={item.desc || ''} onChange={e => update(i, { desc: e.target.value })} />
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={add}
        style={{ width: '100%', padding: 9, border: '1.5px dashed rgba(206,197,186,0.7)', borderRadius: 10, background: 'transparent', fontSize: 12, color: '#685d4a', cursor: 'pointer', fontFamily: 'var(--font-inter)', fontWeight: 600, marginTop: 8 }}>
        + Добавить пункт
      </button>
    </div>
  );
}

function DrinksEditor({ value, onChange }: {
  value: DrinkOption[]; onChange: (v: DrinkOption[]) => void;
}) {
  const items = value || [];
  const update = (i: number, lbl: string) =>
    onChange(items.map((it, j) => (j === i ? { value: it.value, label: lbl } : it)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const add = () => onChange([...items, { value: 'opt_' + (items.length + 1) + '_' + Math.random().toString(36).slice(2, 5), label: '' }]);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'center' }}>
            <input className="input-field" style={{ padding: '7px 8px', fontSize: 13 }} placeholder="Напиток" value={it.label} onChange={e => update(i, e.target.value)} />
            <button type="button" onClick={() => remove(i)} style={{ ...iconBtn(false), color: '#e74c3c' }}>×</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={add}
        style={{ width: '100%', padding: 9, border: '1.5px dashed rgba(206,197,186,0.7)', borderRadius: 10, background: 'transparent', fontSize: 12, color: '#685d4a', cursor: 'pointer', fontFamily: 'var(--font-inter)', fontWeight: 600, marginTop: 8 }}>
        + Добавить напиток
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7d766c', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-inter)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ width: 36, height: 36, border: '2px solid rgba(206,197,186,0.4)', borderTopColor: '#685d4a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
