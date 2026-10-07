/** Files needed by the authoring tool must never be served from public/. */
export function isPrivateTemplateFile(pathname: string): boolean {
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { return true; }
  return decoded.split(/[\\/]/).some(part =>
    /^_studio(?:\.json|-registry\.json)$/i.test(part) ||
    /^_backup-/i.test(part) || /\.(?:bak|backup|orig)$/i.test(part));
}
