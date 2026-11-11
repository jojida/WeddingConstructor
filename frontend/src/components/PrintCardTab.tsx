'use client';
import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import QRCode from 'qrcode';
import TemplatePreview, { InviteData } from './TemplatePreview';
import { hasPrintCard, isPublished } from '@/lib/plans';
import styles from './PrintCardTab.module.css';

/* Кабинет → «Открытка с QR»: печатная версия первого экрана приглашения.

   Лицевая сторона — та же миниатюра шаблона, что слева на карточках главной и
   каталога (TemplateShowcase), только в настоящих миллиметрах листа. QR-код
   ведёт на сайт пары: в углу открытки или на обороте (тогда в PDF две
   страницы — для двусторонней печати).

   PDF делает сам браузер: листы рендерятся порталом прямо в <body>, а
   стили @media print прячут всё остальное и задают @page без полей. Так текст
   и QR остаются векторными, а сервер ничего не рендерит.

   Платные тарифы (hasPrintCard) печатают чистую открытку. На бесплатном всё
   работает так же, но поверх обеих сторон — водяной знак WeddingCraft
   (Watermark): PDF собирается в браузере, и замок на кнопке легко обойти,
   а знак остаётся в самом файле. */

type Placement = 'right' | 'left' | 'back';
type Format = 'a6' | 'a5';

const FORMATS: Record<Format, { w: number; h: number; label: string }> = {
  a6: { w: 105, h: 148, label: 'A6 · 10,5 × 14,8 см' },
  a5: { w: 148, h: 210, label: 'A5 · 14,8 × 21 см' },
};
const PLACEMENTS: { id: Placement; label: string }[] = [
  { id: 'right', label: 'В углу справа' },
  { id: 'left', label: 'В углу слева' },
  { id: 'back', label: 'На обороте' },
];
const MM = 96 / 25.4;          // CSS-пикселей в миллиметре
const BASE = 480;              // родная ширина миниатюры шаблона (как в PreviewScale)
const PREVIEW_W = 300;         // ширина листа в предпросмотре на экране
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export type PrintCardInvite = InviteData & {
  id: string; slug: string; status: string; plan: string; customDomain?: string;
};

export default function PrintCardTab({ invite, origin, apiBase }: {
  invite: PrintCardInvite; origin: string; apiBase: string;
}) {
  const watermark = !hasPrintCard(invite.plan);
  const [format, setFormat] = useState<Format>('a6');
  const [placement, setPlacement] = useState<Placement>('right');
  const [caption, setCaption] = useState('Приглашение онлайн');
  const siteUrl = `${origin}/${invite.slug}`;
  const domainUrl = invite.customDomain ? `https://${invite.customDomain}` : '';
  const [useDomain, setUseDomain] = useState(false);
  const url = useDomain && domainUrl ? domainUrl : siteUrl;
  // QR строится только в браузере — он же служит признаком, что можно рисовать портал в <body>
  const [qr, setQr] = useState('');

  useEffect(() => {
    let alive = true;
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1d1a16', light: '#0000' } })
      .then(svg => { if (alive) setQr(svg); })
      .catch(() => { if (alive) setQr(''); });
    return () => { alive = false; };
  }, [url]);

  // Миниатюра шаблона в режиме печати (без таймера и т.п. — см. wcPrint в шаблонах)
  const data = useMemo<InviteData>(() => ({
    ...invite, customData: { ...invite.customData, wcPrint: true },
  }), [invite]);

  const sheetProps = { data, apiBase, format, placement, caption, qr, url, watermark };
  const fmt = FORMATS[format];
  const k = PREVIEW_W / (fmt.w * MM);

  const print = async () => {
    try { await document.fonts?.ready; } catch { /* шрифты не критичны */ }
    // Даём картинкам листа в портале догрузиться
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('.wc-print-root img'));
    await Promise.all(imgs.map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 4000); })));
    // Заголовок страницы браузер предлагает как имя PDF-файла
    const title = document.title;
    const couple = [invite.groomName, invite.brideName].filter(Boolean).join(' и ');
    document.title = couple ? `Открытка — ${couple}` : 'Открытка-приглашение';
    window.print();
    document.title = title;
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.intro}>
        <h2 className={styles.title}>Открытка для печати с QR-кодом</h2>
        <p className={styles.lead}>
          Первый экран вашего приглашения в формате открытки. Гость наводит камеру на QR-код — и открывается сайт: программа дня, место и анкета.
        </p>
      </div>

      <div className={styles.layout}>
        <div className={styles.previewCol}>
          <div className={styles.sheets}>
            <ScaledSheet k={k} fmt={fmt}><Sheet side="front" {...sheetProps} /></ScaledSheet>
            {placement === 'back' && <ScaledSheet k={k} fmt={fmt}><Sheet side="back" {...sheetProps} /></ScaledSheet>}
          </div>
        </div>

        <div className={styles.controls}>
          <fieldset className={styles.group}>
            <legend className={styles.label}>QR-код</legend>
            <div className={styles.chips}>
              {PLACEMENTS.map(p => (
                <button key={p.id} type="button" className={`${styles.chip} ${placement === p.id ? styles.chipOn : ''}`}
                  onClick={() => setPlacement(p.id)} aria-pressed={placement === p.id}>{p.label}</button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.label}>Размер</legend>
            <div className={styles.chips}>
              {(Object.keys(FORMATS) as Format[]).map(f => (
                <button key={f} type="button" className={`${styles.chip} ${format === f ? styles.chipOn : ''}`}
                  onClick={() => setFormat(f)} aria-pressed={format === f}>{FORMATS[f].label}</button>
              ))}
            </div>
          </fieldset>

          {placement === 'back' && <label className={styles.group}>
            <span className={styles.label}>Надпись на обороте</span>
            <input className="input-field" value={caption} maxLength={32}
              onChange={e => setCaption(e.target.value)} placeholder="Приглашение онлайн" />
          </label>}

          {domainUrl && (
            <fieldset className={styles.group}>
              <legend className={styles.label}>Ссылка в QR-коде</legend>
              <div className={styles.chips}>
                <button type="button" className={`${styles.chip} ${!useDomain ? styles.chipOn : ''}`} onClick={() => setUseDomain(false)}>{siteUrl.replace(/^https?:\/\//, '')}</button>
                <button type="button" className={`${styles.chip} ${useDomain ? styles.chipOn : ''}`} onClick={() => setUseDomain(true)}>{invite.customDomain}</button>
              </div>
            </fieldset>
          )}

          {!isPublished(invite.status) && (
            <p className={styles.warn}>Сайт ещё не опубликован — по QR-коду гости пока увидят заглушку. Опубликуйте его перед печатью.</p>
          )}

          <button type="button" className="btn-primary" onClick={print} disabled={!qr} style={{ width: '100%' }}>
            Скачать PDF
          </button>
          {watermark && (
            <p className={styles.note}>
              На бесплатном тарифе на открытке водяной знак WeddingCraft.{' '}
              <Link href={`/payment?id=${invite.id}`}>На «Премиум» и «Максимум» — без него →</Link>
            </p>
          )}
          <p className={styles.hint}>
            Откроется окно печати: выберите «Сохранить как PDF» или сразу принтер. Печатайте без полей, масштаб 100%.
            {placement === 'back' && ' В PDF две страницы — лицевая и оборот, для двусторонней печати.'}
          </p>
        </div>
      </div>

      {/* Листы для печати: вне экрана, видны только в @media print */}
      {qr && createPortal(
        <div className="wc-print-root" aria-hidden="true">
          <style>{`
            .wc-print-root { position: fixed; left: -10000px; top: 0; pointer-events: none; }
            @page { size: ${fmt.w}mm ${fmt.h}mm; margin: 0; }
            @media print {
              html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
              body > *:not(.wc-print-root) { display: none !important; }
              .wc-print-root { position: static; left: auto; }
              .wc-print-root .wc-print-sheet { break-after: page; page-break-after: always; }
              .wc-print-root .wc-print-sheet:last-child { break-after: auto; page-break-after: auto; }
            }
          `}</style>
          <Sheet side="front" {...sheetProps} />
          {placement === 'back' && <Sheet side="back" {...sheetProps} />}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* Лист в настоящих миллиметрах, ужатый для предпросмотра на экране */
function ScaledSheet({ k, fmt, children }: { k: number; fmt: { w: number; h: number }; children: React.ReactNode }) {
  return (
    <div className={styles.sheetFrame} style={{ width: fmt.w * MM * k, height: fmt.h * MM * k }}>
      <div style={{ transform: `scale(${k})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  );
}

function Sheet({ side, data, apiBase, format, placement, caption, qr, url, watermark }: {
  side: 'front' | 'back'; data: InviteData; apiBase: string; format: Format;
  placement: Placement; caption: string; qr: string; url: string; watermark: boolean;
}) {
  const { w, h } = FORMATS[format];
  const sheet: React.CSSProperties = {
    position: 'relative', width: `${w}mm`, height: `${h}mm`, overflow: 'hidden', background: '#fff',
    WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
  };
  // Размеры QR и подписи — в мм от ширины листа: на A5 всё пропорционально крупнее
  const u = (mm: number) => `${(mm * w / 105).toFixed(2)}mm`;

  if (side === 'back') {
    const names = [data.groomName, data.brideName].filter(Boolean).join(' & ');
    let date = '';
    const [y, m, d] = (data.weddingDate || '').split('-').map(Number);
    if (y && m && d) date = `${d} ${MONTHS[m - 1]} ${y}`;
    return (
      <div className="wc-print-sheet" style={{ ...sheet, background: '#faf7f2', color: '#2c2620', fontFamily: "'Cormorant Garamond', Georgia, serif", textAlign: 'center' }}>
        {/* знак под текстом и QR: код должен сканироваться чисто */}
        {watermark && <Watermark />}
        <div style={{ position: 'absolute', inset: u(6), border: `0.3mm solid rgba(104,93,74,.35)` }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: u(14) }}>
          {caption && <div style={{ fontSize: u(3.4), letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7d705c' }}>{caption}</div>}
          {names && <div style={{ marginTop: u(4), fontSize: u(8), fontStyle: 'italic', lineHeight: 1.15 }}>{names}</div>}
          {date && <div style={{ marginTop: u(2), fontSize: u(4.2), letterSpacing: '0.08em' }}>{date}</div>}
          <div style={{ width: u(46), height: u(46), marginTop: u(9) }} className={styles.qr} dangerouslySetInnerHTML={{ __html: qr }} />
          <div style={{ marginTop: u(7), fontSize: u(3.6), lineHeight: 1.35, maxWidth: u(70), color: '#2c2620' }}>
            Наведите камеру телефона на код — откроется сайт: программа дня, место и анкета для гостей
          </div>
          <div style={{ marginTop: u(3), fontFamily: 'Inter, system-ui, sans-serif', fontSize: u(2.8), color: '#7d705c', letterSpacing: '0.02em' }}>
            {url.replace(/^https?:\/\//, '')}
          </div>
        </div>
      </div>
    );
  }

  // Лицевая сторона: миниатюра в родной ширине 480px, ужатая до ширины листа
  const wpx = w * MM;
  const scale = wpx / BASE;
  const baseH = Math.round((h * MM) / scale);
  return (
    <div className="wc-print-sheet" style={sheet}>
      <div style={{ width: BASE, height: baseH, transform: `scale(${scale})`, transformOrigin: 'top left', overflow: 'hidden', pointerEvents: 'none' }}>
        <TemplatePreview data={data} apiBase={apiBase} />
      </div>
      {watermark && <Watermark />}
      {/* QR в углу — компактный (≈14 мм на A6) и у самого края, без подписи:
          крупная плашка закрывала дату внизу первого экрана (у «Айвори» — год) */}
      {placement !== 'back' && (
        <div style={{
          position: 'absolute', bottom: u(3), [placement === 'left' ? 'left' : 'right']: u(3),
          width: u(16), padding: u(0.9), boxSizing: 'border-box', borderRadius: u(1),
          background: 'rgba(255,255,255,.95)', boxShadow: '0 0.2mm 0.8mm rgba(0,0,0,.16)',
        }}>
          <div style={{ width: '100%', aspectRatio: '1' }} className={styles.qr} dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      )}
    </div>
  );
}

/* Водяной знак бесплатного тарифа: «WeddingCraft» косой шахматкой поверх листа.
   Лежит под QR-кодом, чтобы не мешать сканированию.
   Векторный <svg> с <pattern>, а не фон: фоновые картинки браузер печатает, только
   если включена галочка «Фон», а этот слой попадает в PDF всегда. Белая надпись с
   тёмной обводкой видна и на тёмных обложках («Айвори»), и на светлых. */
function Watermark() {
  // свой id узора у каждого листа: предпросмотр на экране при печати скрыт, и ссылка
  // на узор из скрытого поддерева могла бы не отрисоваться
  const id = `wc-wm-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg aria-hidden="true" width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <defs>
        <pattern id={id} width="360" height="110" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
          <text x="0" y="40" fontFamily="'Playfair Display', Georgia, serif" fontSize="26" fill="rgba(255,255,255,.5)"
            stroke="rgba(40,30,20,.35)" strokeWidth="0.6">WeddingCraft</text>
          <text x="180" y="95" fontFamily="'Playfair Display', Georgia, serif" fontSize="26" fill="rgba(255,255,255,.5)"
            stroke="rgba(40,30,20,.35)" strokeWidth="0.6">WeddingCraft</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
