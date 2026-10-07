export const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = ['groomName', 'brideName', 'weddingDate', 'weddingTime', 'venue', 'venueAddress', 'mapLink', 'story', 'inviteText', 'dressCode', 'dressCodePhoto', 'coverPhoto', 'coverVideo', 'colorScheme', 'musicUrl', 'templateId', 'title'];
const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);
const runtimeKeys = new Set(['apiBase', 'guestToken', 'guestName', 'guestPlanner', 'wcMenu', 'plan', 'slug', 'enabledSections', 'editing']);
const urlFields = ['mapLink', 'dressCodePhoto', 'coverPhoto', 'coverVideo', 'musicUrl'];

/** Only normal HTTP(S) URLs or asset paths may be persisted as navigation/media. */
export function safeAssetUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 20000 || /[\x00-\x1f\x7f\\]/.test(value)) return false;
  const text = value.trim();
  if (!text) return true;
  if (text.startsWith('//')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    try { const url = new URL(text); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
  }
  return !/^[^/?#]*:/.test(text);
}

function validJson(value: unknown, depth = 0, budget = { remaining: 5000 }): boolean {
  if (depth > 8 || --budget.remaining < 0) return false;
  if (typeof value === 'string') return value.length <= 20000;
  if (value == null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 100 && value.every(v => validJson(v, depth + 1, budget));
  return record(value) && Object.keys(value).length <= 300 && Object.entries(value).every(([k, v]) =>
    k.length <= 120 && !unsafeKeys.has(k) && validJson(v, depth + 1, budget));
}

/** Strip runtime-controlled values even from old rows saved before validation existed. */
export function cleanCustomData(value: unknown): Record<string, unknown> {
  if (!record(value)) return {};
  const clean = (input: unknown, depth = 0): unknown => {
    if (depth > 8) return null;
    if (typeof input === 'string') {
      const compact = input.replace(/[\x00-\x20\x7f]/g, '');
      return /^(?:javascript|vbscript|data):/i.test(compact) ? '' : input;
    }
    if (Array.isArray(input)) return input.slice(0, 100).map(v => clean(v, depth + 1));
    if (record(input)) return Object.fromEntries(Object.entries(input).filter(([key]) => !unsafeKeys.has(key) && !runtimeKeys.has(key)).slice(0, 300).map(([key, v]) => [key, clean(v, depth + 1)]));
    return input;
  };
  return clean(value) as Record<string, unknown>;
}

export function validInviteInput(body: unknown): boolean {
  if (!record(body)) return false;
  for (const key of strings) if (body[key] !== undefined && (typeof body[key] !== 'string' || (body[key] as string).length > 20000)) return false;
  if (body.templateId !== undefined && !/^[a-z0-9][a-z0-9-]{1,63}$/.test(body.templateId as string)) return false;
  for (const key of urlFields) if (body[key] !== undefined && !safeAssetUrl(body[key])) return false;
  for (const key of ['galleryPhotos', 'dressCodeColors']) {
    const value = body[key];
    if (value !== undefined && (!Array.isArray(value) || value.length > 100 || !value.every(v => typeof v === 'string' && (key !== 'galleryPhotos' || safeAssetUrl(v))))) return false;
  }
  if (body.schedule !== undefined && (!Array.isArray(body.schedule) || !body.schedule.every(v => record(v) && Object.values(v).every(x => typeof x === 'string')))) return false;
  if (body.enabledSections !== undefined && (!record(body.enabledSections) || !Object.values(body.enabledSections).every(v => typeof v === 'boolean'))) return false;
  if (body.customData !== undefined && !record(body.customData)) return false;
  return validJson(body);
}
