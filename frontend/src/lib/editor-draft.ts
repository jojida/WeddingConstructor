/** Implicit recovery must never replace the design explicitly chosen in the URL. */
export function canResumeDraft(value: unknown, templateId: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const draft = value as { templateId?: unknown; status?: unknown };
  return draft.templateId === templateId && (!draft.status || draft.status === 'draft');
}

export function readGuestDraft<T extends object>(raw: string | null, templateId: string): Partial<T> {
  try {
    const value: unknown = JSON.parse(raw || 'null');
    return canResumeDraft(value, templateId) ? value as Partial<T> : {};
  } catch {
    return {};
  }
}
