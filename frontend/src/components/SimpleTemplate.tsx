'use client';
import styles from './SimpleTemplate.module.css';

export interface ScheduleItem { time: string; title: string; icon: string; }

export interface SimpleInviteData {
  groomName: string;
  brideName: string;
  weddingDate: string;
  weddingTime: string;
  venue: string;
  venueAddress: string;
  story: string;
  inviteText: string;
  dressCode: string;
  coverPhoto: string;
  galleryPhotos: string[];
  mapLink: string;
  schedule: ScheduleItem[];
  enabledSections?: Record<string, boolean>;
}

interface Props {
  data: SimpleInviteData;
  apiBase: string;
}

function imgUrl(apiBase: string, url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${apiBase}${url}`;
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return dateStr; }
}

export default function SimpleTemplate({ data, apiBase }: Props) {
  const sec = data.enabledSections ?? {};
  const on = (key: string) => sec[key] !== false;

  const coverUrl = imgUrl(apiBase, data.coverPhoto);

  return (
    <div className={styles.wrapper}>

      {/* Cover photo */}
      {on('gallery') && (
        <div
          className={styles.coverPhoto}
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : {}}
        >
          {!coverUrl && (
            <div className={styles.coverPlaceholder}>
              <span className={styles.coverPlaceholderIcon}>📷</span>
              <span>Главное фото</span>
            </div>
          )}
        </div>
      )}

      {/* Names + date */}
      {on('couple') && (
        <div className={styles.header}>
          <p className={styles.headerTag}>Приглашение на свадьбу</p>
          <h1 className={styles.names}>
            {data.brideName || 'Невеста'}
            <span className={styles.amp}>&</span>
            {data.groomName || 'Жених'}
          </h1>
          {(data.weddingDate || data.weddingTime) && (
            <div className={styles.dateLine}>
              {data.weddingDate && <span>{fmtDate(data.weddingDate)}</span>}
              {data.weddingDate && data.weddingTime && <span className={styles.dateSep}>•</span>}
              {data.weddingTime && <span>{data.weddingTime}</span>}
            </div>
          )}
        </div>
      )}

      <div className={styles.divider} />

      {/* Invite text */}
      {on('couple') && data.inviteText && (
        <>
          <div className={styles.section}>
            <p className={styles.inviteText}>{data.inviteText}</p>
          </div>
          <div className={styles.divider} />
        </>
      )}

      {/* Venue */}
      {on('event') && (data.venue || data.venueAddress) && (
        <>
          <div className={styles.section}>
            <span className={styles.sectionTitle}>📍 Место проведения</span>
            {data.venue && <p className={styles.venueName}>{data.venue}</p>}
            {data.venueAddress && <p className={styles.venueAddress}>{data.venueAddress}</p>}
            {data.mapLink && (
              <a href={data.mapLink} className={styles.mapLink} target="_blank" rel="noopener noreferrer">
                Открыть на карте →
              </a>
            )}
          </div>
          <div className={styles.divider} />
        </>
      )}

      {/* Schedule */}
      {on('schedule') && data.schedule?.length > 0 && (
        <>
          <div className={styles.section}>
            <span className={styles.sectionTitle}>⏱ Программа дня</span>
            <div className={styles.scheduleList}>
              {data.schedule.map((item, i) => (
                <div key={i} className={styles.scheduleItem}>
                  <span className={styles.scheduleIcon}>{item.icon}</span>
                  <span className={styles.scheduleTime}>{item.time}</span>
                  <span className={styles.scheduleTitle}>{item.title}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.divider} />
        </>
      )}

      {/* Story */}
      {on('style') && data.story && (
        <>
          <div className={styles.section}>
            <span className={styles.sectionTitle}>💑 Наша история</span>
            <p className={styles.storyText}>{data.story}</p>
          </div>
          <div className={styles.divider} />
        </>
      )}

      {/* Dress code */}
      {on('style') && data.dressCode && (
        <>
          <div className={styles.section}>
            <span className={styles.sectionTitle}>👗 Дресс-код</span>
            <span className={styles.dressCodeBadge}>{data.dressCode}</span>
          </div>
          <div className={styles.divider} />
        </>
      )}

      {/* Gallery */}
      {on('gallery') && data.galleryPhotos?.length > 0 && (
        <>
          <div className={styles.section}>
            <span className={styles.sectionTitle}>📸 Фотогалерея</span>
            <div className={styles.galleryGrid}>
              {data.galleryPhotos.map((url, i) => (
                <div
                  key={i}
                  className={styles.galleryItem}
                  style={{ backgroundImage: `url(${imgUrl(apiBase, url)})` }}
                />
              ))}
            </div>
          </div>
          <div className={styles.divider} />
        </>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <p className={styles.footerText}>Eloquence · Цифровые приглашения</p>
      </div>

    </div>
  );
}
