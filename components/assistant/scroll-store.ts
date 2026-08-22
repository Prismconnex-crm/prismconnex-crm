import type { AssistantEntity } from '@/lib/assistant/types';

/**
 * Where each thread was scrolled to, per conversation and per entity.
 *
 * In-memory rather than sessionStorage: the offset is worthless after a reload
 * anyway, since the thread is re-rendered at a different height, and a write on
 * every scroll event would be the most frequent storage write in the app.
 *
 * Module-level state. A test that combines `vi.resetModules()` with a dynamic
 * import gets a SECOND copy of this Map and will read back zeros — use the
 * static import and `resetScrollsForTests`.
 */
const offsets = new Map<string, number>();

/** Entity is part of the key: one conversation spans several pages. */
export function scrollKey(conversationId: string, entity: AssistantEntity): string {
  return `${conversationId}::${entity}`;
}

export function saveScroll(key: string, offset: number): void {
  // A NaN from a mid-unmount measurement would otherwise stick permanently.
  if (!Number.isFinite(offset)) return;
  offsets.set(key, Math.max(0, offset));
}

/** 0 for an unknown key — a thread nobody has scrolled starts at the top. */
export function readScroll(key: string): number {
  return offsets.get(key) ?? 0;
}

export function resetScrollsForTests(): void {
  offsets.clear();
}
