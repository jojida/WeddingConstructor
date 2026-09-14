const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = ['groomName', 'brideName', 'weddingDate', 'weddingTime', 'venue', 'venueAddress', 'mapLink', 'story', 'inviteText', 'dressCode', 'dressCodePhoto', 'coverPhoto', 'coverVideo', 'colorScheme', 'musicUrl', 'templateId', 'title'];

function validJson(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (typeof value === 'string') return value.length <= 20000;
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return true;
  if (Array.isArray(value)) return value.length <= 100 && value.every(v => validJson(v, depth + 1));
  return record(value) && Object.entries(value).every(([k, v]) =>
    !['__proto__', 'constructor', 'prototype', 'apiBase', 'guestToken'].includes(k) && validJson(v, depth + 1));
}

export function validInviteInput(body: unknown): boolean {
  if (!record(body)) return false;
  for (const key of strings) if (body[key] !== undefined && (typeof body[key] !== 'string' || (body[key] as string).length > 20000)) return false;
  if (body.templateId !== undefined && !/^[a-z0-9][a-z0-9-]{1,63}$/.test(body.templateId as string)) return false;
  for (const key of ['galleryPhotos', 'dressCodeColors']) {
    const value = body[key];
    if (value !== undefined && (!Array.isArray(value) || value.length > 100 || !value.every(v => typeof v === 'string'))) return false;
  }
  if (body.schedule !== undefined && (!Array.isArray(body.schedule) || !body.schedule.every(v => record(v) && Object.values(v).every(x => typeof x === 'string')))) return false;
  if (body.enabledSections !== undefined && (!record(body.enabledSections) || !Object.values(body.enabledSections).every(v => typeof v === 'boolean'))) return false;
  if (body.customData !== undefined && !record(body.customData)) return false;
  return validJson(body);
}
