'use client';
import TemplatePreview, { InviteData } from './TemplatePreview';
import PreviewScale from './PreviewScale';
import LazyMount from './LazyMount';
import styles from './TemplateShowcase.module.css';

/* Витрина шаблона в карточках главной и каталога: слева открытка для печати
   (первый экран приглашения в пропорциях листа A6/A5), справа — телефон с тем
   же первым экраном, как его увидит гость.

   Обе картинки — одна и та же лёгкая миниатюра шаблона (не-live режим
   TemplatePreview), просто в разных пропорциях. Её же печатает вкладка
   «Открытка с QR» в кабинете (PrintCardTab), так что витрина честно
   показывает, что получится на бумаге. */
/* Экран телефона ~9:19 — рендерим миниатюру уже, чтобы она заполнила его
   по высоте, а не оставила пустую полосу снизу */
const PHONE_BASE = 360;
/* Миниатюры-картинки с постоянными пропорциями: их высота зависит только от
   ширины, поэтому в телефоне они идут в режиме cover (см. PreviewScale) */
const PHONE_COVER = new Set(['tenderness', 'forest', 'garden-evening', 'vitrage', 'angels']);

export default function TemplateShowcase({ data, apiBase, initialVisible = false }: {
  data: InviteData;
  apiBase: string;
  initialVisible?: boolean;
}) {
  return (
    <div className={styles.stage}>
      <div className={styles.paper}>
        <PreviewScale className={styles.scale}>
          <LazyMount initialVisible={initialVisible}>
            <TemplatePreview data={data} apiBase={apiBase} />
          </LazyMount>
        </PreviewScale>
      </div>
      <div className={styles.phone}>
        <div className={styles.screen}>
          <PreviewScale className={styles.scale}
            {...(PHONE_COVER.has(data.templateId) ? { baseWidth: 480, coverHeight: 680 } : { baseWidth: PHONE_BASE })}>
            <LazyMount initialVisible={initialVisible}>
              <TemplatePreview data={data} apiBase={apiBase} />
            </LazyMount>
          </PreviewScale>
        </div>
        <span className={styles.notch} aria-hidden="true" />
      </div>
    </div>
  );
}
