// Метки напитков для статистики RSVP и уведомлений владельцу.
// Форма шаблона шлёт value ('sparkling'); пара может переопределить список
// напитков в редакторе (customData.drinks) — тогда метка берётся оттуда.
export const DEFAULT_DRINK_LABELS: Record<string, string> = {
  sparkling: 'Игристое',
  red: 'Красное вино',
  white: 'Белое вино',
  cognac: 'Коньяк',
  wine: 'Вино',
  champagne: 'Шампанское',
  juice: 'Сок',
  water: 'Вода',
  no_alcohol: 'Без алкоголя',
  other: 'Другое',
};

/** value→label для приглашения: дефолты + свой список из customData (JSON-строка). */
export function inviteDrinkLabels(customData?: string | null): Record<string, string> {
  const labels: Record<string, string> = { ...DEFAULT_DRINK_LABELS };
  try {
    const custom = JSON.parse(customData || '{}');
    if (Array.isArray(custom.drinks)) {
      for (const d of custom.drinks) {
        if (d && d.value) labels[String(d.value)] = String(d.label || d.value);
      }
    }
  } catch { /* битый JSON — остаются дефолты */ }
  return labels;
}

/** "sparkling,red" → "Игристое, Красное вино" по карте меток. */
export function formatDrinkChoice(choice: string, labels: Record<string, string>): string {
  return String(choice || '')
    .split(',').map(s => s.trim()).filter(Boolean)
    .map(v => labels[v] || v)
    .join(', ');
}
