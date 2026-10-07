/** Private browsing, storage quotas and browser policies must not crash the editor. */
export function readStorage(kind: 'localStorage' | 'sessionStorage', key: string): string | null {
  try { return window[kind].getItem(key); } catch { return null; }
}

export function writeStorage(kind: 'localStorage' | 'sessionStorage', key: string, value: string | null): void {
  try {
    if (value === null) window[kind].removeItem(key);
    else window[kind].setItem(key, value);
  } catch { /* In-memory state remains usable when browser storage is unavailable. */ }
}

let inMemoryToken: string | null | undefined;

export function readAuthToken(): string | null {
  if (inMemoryToken !== undefined) return inMemoryToken;
  return readStorage('localStorage', 'wc_token');
}

export function resetAuthTokenCache(): void { inMemoryToken = undefined; }

export function writeAuthToken(token: string | null): void {
  inMemoryToken = token;
  writeStorage('localStorage', 'wc_token', token);
}
