/** Отсутствующий ключ сохраняет исходный вид старых приглашений. */
export function isSectionEnabled(
  section: { id?: string; required?: boolean },
  enabledSections?: Record<string, boolean>,
  showMap?: unknown,
): boolean {
  if (section.required || !section.id) return true;
  const value = enabledSections?.[section.id];
  return typeof value === 'boolean' ? value : section.id !== 'map' || showMap !== false;
}
