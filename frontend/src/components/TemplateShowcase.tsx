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
/* Экран телефона ~9:19 — заметно уже открытки (~0,7). Миниатюры свёрстаны
   под ширину 480px, поэтому и в телефоне рисуются в 480: при более узком
   рендере (раньше было 360) текст и рамки вылезали за правый край.

   Миниатюры, которые сами тянутся по высоте (Айвори, Тёмная элегантность,
   Средиземноморье, Цветущая арка, Каллы), заполняют экран целиком.

   Остальные — картинка фиксированных пропорций или блок под открытку: они
   идут в режиме cover. Число — их высота при ширине 480px: столько рендерим,
   масштабируем по высоте экрана, по бокам срезается только фон — окно
   обрезки держится вокруг текста (fitText в PreviewScale). */
const PHONE_COVER: Record<string, number> = {
  tenderness: 711,
  forest: 763,
  'garden-evening': 776,
  vitrage: 738,
  angels: 764,
  floral: 677,
  sketch: 677,
};

export default function TemplateShowcase({ data, apiBase, initialVisible = false }: {
  data: InviteData;
  apiBase: string;
  initialVisible?: boolean;
}) {
  const coverHeight = PHONE_COVER[data.templateId];
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
            {...(coverHeight ? { coverHeight, fitText: true, fitKey: `${data.groomName}|${data.brideName}` } : {})}>
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
