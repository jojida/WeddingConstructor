'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, X } from 'lucide-react';
import TemplatePreview, { type InviteData as PreviewData } from '@/components/TemplatePreview';
import { TEMPLATES } from '@/lib/constants';
import { readPreviewNames } from '@/lib/preview-names';
import { DEVICE_OPTIONS, DeviceSwitch, FullPreview, useMediaQuery, type FullPreviewMode, type PreviewDevice } from './PreviewDevice';
import SitePreview from './SitePreview';
import styles from './SetupStep.module.css';

/* Первый шаг нового приглашения — «Расскажите о вашей свадьбе».
   С 16.11.26 — как у конкурентов: слева сам сайт-приглашение, как на странице
   демо (колонка во всю высоту, без рамки телефона — «превью сайта осталось,
   просто сместилось влево»), справа анкета. Имена, дата и место, которые пара
   вводит, сразу появляются в приглашении слева. Раньше анкета была отдельной
   страницей без шаблона, а посмотреть шаблон можно было только в демо.
   Превью — в режиме редактора (editing): сразу обложка, анимация открытия —
   кнопкой «▶ Посмотреть, как откроется»; этот режим рассчитан на правки на лету.
   На телефоне сайт — весь первый экран, анкета под ним. */

export interface SetupData {
  groomName: string;
  brideName: string;
  weddingDate: string;
  weddingTime: string;
  venue: string;
  venueAddress: string;
  mapLink: string;
}

type SetupKey = 'groomName' | 'brideName' | 'weddingDate' | 'weddingTime';

export default function SetupStep({ templateId, initialData, previewBase, apiBase, device, onDevice, onComplete, onClose }: {
  templateId: string;
  initialData?: Partial<SetupData>;
  /** Приглашение слева: пример шаблона (lib/demo-invite.ts) или уже начатое — если анкету открыли из редактора */
  previewBase: PreviewData;
  apiBase: string;
  /** Как смотреть сайт слева — общий выбор с редактором (useStoredDevice в нём) */
  device: PreviewDevice;
  onDevice: (d: PreviewDevice) => void;
  onComplete: (d: SetupData) => void;
  /** Анкету открыли из редактора («Имена и дата»): крестик возвращает туда. Без него — к шаблонам */
  onClose?: () => void;
}) {
  const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
  // Имена, вписанные в каталоге шаблонов (lib/preview-names.ts), — сразу в анкету:
  // человек уже видел их в приглашении, второй раз набирать незачем. Анкета
  // рисуется только в браузере (редактор сперва проверяет черновик), так что
  // localStorage читаем прямо в начальном состоянии — без мигания пустых полей.
  const [saved] = useState(() => (initialData?.groomName || initialData?.brideName ? null : readPreviewNames()));
  const [groomName,   setGroomName]   = useState(initialData?.groomName || saved?.groom.trim() || '');
  const [brideName,   setBrideName]   = useState(initialData?.brideName || saved?.bride.trim() || '');
  const [weddingDate, setWeddingDate] = useState(initialData?.weddingDate || '');
  const [weddingTime, setWeddingTime] = useState(initialData?.weddingTime || '15:00');
  const [venue,       setVenue]       = useState(initialData?.venue || '');
  const [venueAddress,setVenueAddress]= useState(initialData?.venueAddress || '');
  const [mapLink,     setMapLink]     = useState(initialData?.mapLink || '');
  // Ошибки показываем у самих полей: тост в углу по одной ошибке за раз
  // заставлял угадывать, какое поле не так.
  const [errors, setErrors] = useState<Partial<Record<SetupKey, string>>>({});
  const clearError = (k: SetupKey) => setErrors(prev => (prev[k] ? { ...prev, [k]: undefined } : prev));

  // Границы даты: свадьба не может быть в прошлом и не дальше 3 лет вперёд.
  const fmtDate = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const todayStr = fmtDate(new Date());
  const maxDateObj = new Date(); maxDateObj.setFullYear(maxDateObj.getFullYear() + 3);
  const maxDateStr = fmtDate(maxDateObj);

  const handleSubmit = () => {
    // Обязательны имена, дата и время. Место и адрес можно указать позже:
    // они входят в «Премиум» и «Максимум», а в бесплатном тарифе скрыты.
    const next: Partial<Record<SetupKey, string>> = {};
    if (!groomName.trim()) next.groomName = 'Введите имя жениха';
    if (!brideName.trim()) next.brideName = 'Введите имя невесты';
    // Дата должна быть корректной: не в прошлом и не слишком далеко.
    // Сравнение ISO-строк (YYYY-MM-DD) хронологично и не зависит от таймзоны.
    if (!weddingDate) next.weddingDate = 'Укажите дату свадьбы';
    else if (Number.isNaN(new Date(weddingDate + 'T00:00:00').getTime())) next.weddingDate = 'Неверная дата свадьбы';
    else if (weddingDate < todayStr) next.weddingDate = 'Дата свадьбы не может быть в прошлом';
    else if (weddingDate > maxDateStr) next.weddingDate = 'Дата слишком далеко — проверьте год';
    if (!weddingTime) next.weddingTime = 'Укажите время начала';

    setErrors(next);
    const firstInvalid = (Object.keys(next) as SetupKey[])[0];
    if (firstInvalid) { document.getElementById(`setup-${firstInvalid}`)?.focus(); return; }

    onComplete({
      groomName: groomName.trim(),
      brideName: brideName.trim(),
      weddingDate,
      weddingTime,
      venue: venue.trim(),
      venueAddress: venueAddress.trim(),
      mapLink: mapLink.trim(),
    });
  };

  // ── Шаблон слева: пример шаблона, поверх — то, что пара уже ввела ──
  const preview = useMemo<PreviewData>(() => {
    const ownAddress = venueAddress.trim();
    return {
      ...previewBase,
      groomName: groomName.trim() || previewBase.groomName,
      brideName: brideName.trim() || previewBase.brideName,
      weddingDate: weddingDate || previewBase.weddingDate,
      weddingTime: weddingTime || previewBase.weddingTime,
      venue: venue.trim() || previewBase.venue,
      venueAddress: ownAddress || previewBase.venueAddress,
      // Точка на карте — от адреса примера; свой адрес карта ищет сама,
      // а точную метку найдёт редактор (customData.mapPoint)
      customData: ownAddress && ownAddress !== previewBase.venueAddress
        ? { ...previewBase.customData, mapPoint: undefined }
        : previewBase.customData,
    };
  }, [previewBase, groomName, brideName, weddingDate, weddingTime, venue, venueAddress]);

  const small = useMediaQuery('(max-width: 768px)');
  // Как смотреть сайт слева — тот же переключатель и тот же выбор, что в редакторе
  // (помнится в браузере). На телефоне — только «Окно» во всю ширину.
  const shownDevice: PreviewDevice = small ? 'window' : device;
  // Нажатие на сайт на телефоне — во весь экран: листается, с анимацией открытия
  const [full, setFull] = useState(false);
  const [fullMode, setFullMode] = useState<FullPreviewMode>('window');
  const openFull = () => { setFullMode(shownDevice); setFull(true); };

  // Телефон: сайт занимает первый экран, анкета под ним. Пока анкету не видно,
  // внизу висит кнопка к ней — как «Изменить тексты и фото» в редакторе
  const panelRef = useRef<HTMLElement>(null);
  const [panelInView, setPanelInView] = useState(true);
  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setPanelInView(e.isIntersecting), { rootMargin: '0px 0px -30% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Крестик: на компьютере — в строке над анкетой рядом с переключателем,
  // на телефоне — в углу страницы поверх сайта (CSS показывает один из двух)
  const close = (className: string) => onClose
    ? <button type="button" className={className} onClick={onClose} aria-label="Закрыть и вернуться в редактор" title="Вернуться в редактор"><X size={22} strokeWidth={1.8} aria-hidden /></button>
    : <Link href="/templates" className={className} aria-label="Закрыть и вернуться к шаблонам" title="Все шаблоны"><X size={22} strokeWidth={1.8} aria-hidden /></Link>;

  return (
    <div className={styles.page}>
      {full && (
        <FullPreview mode={fullMode} onMode={m => { setFullMode(m); onDevice(m); }} onClose={() => setFull(false)}>
          <TemplatePreview key={fullMode} data={preview} apiBase={apiBase} fullPage />
        </FullPreview>
      )}

      {/* ── Слева: сайт, как в демо ── */}
      <main className={styles.stage} aria-label={`Шаблон «${template.name}»`}>
        {/* Тот же вид, что в редакторе (SitePreview.tsx). На телефоне сайт не ловит
            касания (свайп листал бы приглашение, а не страницу к анкете) —
            нажатие открывает его во весь экран */}
        <SitePreview device={shownDevice} onTap={openFull}>
          {/* Другое устройство — шаблон грузится заново под его ширину */}
          <TemplatePreview key={shownDevice} data={preview} apiBase={apiBase} editing />
        </SitePreview>
      </main>

      {close(`${styles.close} ${styles.closeCorner}`)}

      {/* ── Справа: анкета ── */}
      <section ref={panelRef} className={styles.panel} aria-labelledby="setup-title">
        {/* Над анкетой: как смотреть сайт слева и крестик (только на компьютере) */}
        <div className={styles.panelBar}>
          <DeviceSwitch value={device} options={DEVICE_OPTIONS} onChange={onDevice} className={styles.deviceSwitch} />
          {close(styles.close)}
        </div>
        <div className={styles.panelInner}>
          <p className={styles.eyebrow}>Шаблон: {template.name}</p>
          <h1 id="setup-title" className={styles.title}>Расскажите о вашей свадьбе</h1>
          <p className={styles.lead}>
            Имена и дата сразу появятся в приглашении. Всё можно изменить потом в редакторе.
          </p>

          <div className={styles.fields}>
            {/* Плейсхолдеры с «Например» — голые «Вадим»/«Дарья» принимали за уже введённые имена */}
            <div className={styles.pair}>
              <SetupField label="Имя жениха" htmlFor="setup-groomName" required error={errors.groomName}>
                <input id="setup-groomName" className="input-field" placeholder="Например, Вадим" value={groomName} maxLength={24}
                  aria-invalid={!!errors.groomName} style={errors.groomName ? SETUP_INVALID : undefined}
                  onChange={e => { setGroomName(e.target.value); clearError('groomName'); }}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} autoFocus={!small} />
              </SetupField>
              <SetupField label="Имя невесты" htmlFor="setup-brideName" required error={errors.brideName}>
                <input id="setup-brideName" className="input-field" placeholder="Например, Дарья" value={brideName} maxLength={24}
                  aria-invalid={!!errors.brideName} style={errors.brideName ? SETUP_INVALID : undefined}
                  onChange={e => { setBrideName(e.target.value); clearError('brideName'); }}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              </SetupField>
            </div>

            <div className={styles.pair}>
              <SetupField label="Дата свадьбы" htmlFor="setup-weddingDate" required error={errors.weddingDate}>
                <input id="setup-weddingDate" type="date" className="input-field" value={weddingDate} min={todayStr} max={maxDateStr}
                  aria-invalid={!!errors.weddingDate} style={errors.weddingDate ? SETUP_INVALID : undefined}
                  onChange={e => { setWeddingDate(e.target.value); clearError('weddingDate'); }} />
              </SetupField>
              <SetupField label="Время начала" htmlFor="setup-weddingTime" required error={errors.weddingTime}>
                <input id="setup-weddingTime" type="time" className="input-field" value={weddingTime}
                  aria-invalid={!!errors.weddingTime} style={errors.weddingTime ? SETUP_INVALID : undefined}
                  onChange={e => { setWeddingTime(e.target.value); clearError('weddingTime'); }} />
              </SetupField>
            </div>

            {/* Место — можно позже: многие пары ещё выбирают площадку */}
            <SetupField label="Название места" htmlFor="setup-venue" note="можно позже">
              <input id="setup-venue" className="input-field" placeholder="Например, «Артурс Спа Отель»" value={venue} maxLength={50} onChange={e => setVenue(e.target.value)} />
            </SetupField>
            <SetupField label="Адрес" htmlFor="setup-venueAddress" note="можно позже"
              hint="Пока места нет, в приглашении будет пример из шаблона — поменяете в редакторе.">
              <input id="setup-venueAddress" className="input-field" placeholder="Например, Московская обл., Мытищи…" value={venueAddress} maxLength={90} onChange={e => setVenueAddress(e.target.value)} />
            </SetupField>
            <SetupField label="Ссылка на карту" htmlFor="setup-mapLink" note="необязательно">
              <input id="setup-mapLink" className="input-field" placeholder="https://yandex.ru/maps/..." value={mapLink} onChange={e => setMapLink(e.target.value)} />
            </SetupField>
          </div>

          <button type="button" onClick={handleSubmit} className={`btn-primary ${styles.submit}`}>
            Продолжить в редакторе →
          </button>
        </div>
      </section>

      {small && !panelInView && !full && (
        <button type="button" className={styles.toForm}
          onClick={() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          Ввести имена и дату <ArrowDown size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}

const SETUP_INVALID: React.CSSProperties = { borderColor: '#c0392b', boxShadow: '0 0 0 3px rgba(192,57,43,0.12)' };

function SetupField({ label, htmlFor, required, note, hint, error, children }: {
  label: string; htmlFor?: string; required?: boolean;
  note?: string;   // приписка к подписи: «можно позже», «необязательно»
  hint?: string;   // пояснение под полем
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}{required && <span className={styles.required}>*</span>}
        {note && <span className={styles.note}> · {note}</span>}
      </label>
      {children}
      {error
        ? <div role="alert" className={styles.error}>{error}</div>
        : hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}
