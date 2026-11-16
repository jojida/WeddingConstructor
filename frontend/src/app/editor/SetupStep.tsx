'use client';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Maximize, X } from 'lucide-react';
import TemplatePreview, { type InviteData as PreviewData } from '@/components/TemplatePreview';
import { TEMPLATES } from '@/lib/constants';
import { readPreviewNames } from '@/lib/preview-names';
import { DEVICES, DeviceSwitch, FullPreview, fitScale, useMediaQuery, useStoredDevice, type FullPreviewMode, type PreviewDevice } from './PreviewDevice';
import styles from './SetupStep.module.css';

/* Первый шаг нового приглашения — «Расскажите о вашей свадьбе».
   С 16.11.26 — как у конкурентов: слева живой шаблон (в рамке телефона,
   планшета или компьютера, как в редакторе), справа анкета. Имена, дата и
   место, которые пара вводит, сразу появляются в приглашении слева. Раньше
   анкета была отдельной страницей без шаблона, а посмотреть шаблон можно было
   только в демо — пара выбирала «вслепую» или ходила туда-обратно.
   На телефоне шаблон — над анкетой, поменьше; нажатие открывает его целиком. */

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

export default function SetupStep({ templateId, initialData, previewBase, apiBase, onComplete, onClose }: {
  templateId: string;
  initialData?: Partial<SetupData>;
  /** Приглашение слева: пример шаблона (lib/demo-invite.ts) или уже начатое — если анкету открыли из редактора */
  previewBase: PreviewData;
  apiBase: string;
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

  // Устройство превью — общее с редактором (помнится в браузере); на телефоне только телефон
  const [device, setDevice] = useStoredDevice();
  const small = useMediaQuery('(max-width: 768px)');
  const shownDevice: PreviewDevice = small ? 'phone' : device;
  const stageRef = useRef<HTMLElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      if (window.matchMedia('(max-width: 768px)').matches) {
        // Над анкетой — телефон шириной в половину экрана: анкета начинается
        // уже на первом экране. От высоты окна не зависит — у мобильных
        // браузеров она «прыгает» вместе с адресной строкой.
        setScale(Math.min(0.62, Math.floor((window.innerWidth * 0.52 / DEVICES.phone.w) * 100) / 100));
        return;
      }
      // Сверху — строка с переключателем устройства, 64 px (как у превью в редакторе)
      setScale(fitScale(shownDevice, el.clientWidth - 48, el.clientHeight - 88));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shownDevice]);

  // Во весь экран — то же приглашение «как у гостя», с анимацией открытия
  const [fullMode, setFullMode] = useState<FullPreviewMode | null>(null);
  const openFull = () => setFullMode(shownDevice);

  const dev = DEVICES[shownDevice];
  const close = onClose
    ? <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть и вернуться в редактор" title="Вернуться в редактор"><X size={22} strokeWidth={1.8} aria-hidden /></button>
    : <Link href="/templates" className={styles.close} aria-label="Закрыть и вернуться к шаблонам" title="Все шаблоны"><X size={22} strokeWidth={1.8} aria-hidden /></Link>;

  return (
    <div className={styles.page}>
      {fullMode && (
        <FullPreview mode={fullMode} onMode={m => { setFullMode(m); setDevice(m); }} onClose={() => setFullMode(null)}>
          <TemplatePreview key={fullMode} data={preview} apiBase={apiBase} fullPage />
        </FullPreview>
      )}

      {/* ── Слева: шаблон ── */}
      <main className={styles.stage} ref={stageRef} aria-label={`Шаблон «${template.name}»`}>
        <div className={styles.stageBar}>
          <button type="button" className={styles.fullBtn} onClick={openFull} title="Открыть во весь экран">
            <Maximize size={15} aria-hidden />
            <span>Во весь экран</span>
          </button>
          <DeviceSwitch value={device} options={['phone', 'tablet', 'desktop'] as const} onChange={setDevice} className={styles.deviceSwitch} />
        </div>
        {/* На телефоне превью не ловит касания (свайп листал бы приглашение, а не
            страницу) — нажатие открывает его во весь экран. */}
        <div className={styles.phoneBox}
          style={scale ? { width: dev.w * scale, height: dev.h * scale } : { visibility: 'hidden' }}
          onClick={() => { if (window.matchMedia('(max-width: 768px)').matches) openFull(); }}>
          <div className={`${styles.phone} ${shownDevice === 'tablet' ? styles.tablet : ''} ${shownDevice === 'desktop' ? styles.desktop : ''}`}
            style={{ width: dev.w, height: dev.h, transform: `scale(${scale ?? 1})` }}>
            <div className={styles.screen}>
              <div className={styles.content}>
                {/* Другое устройство — шаблон грузится заново под его ширину */}
                <TemplatePreview key={shownDevice} data={preview} apiBase={apiBase} editing />
              </div>
            </div>
          </div>
        </div>
        <button type="button" className={styles.tapHint} onClick={openFull}>
          <Maximize size={14} aria-hidden /> Посмотреть целиком
        </button>
      </main>

      {close}

      {/* ── Справа: анкета ── */}
      <section className={styles.panel} aria-labelledby="setup-title">
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
