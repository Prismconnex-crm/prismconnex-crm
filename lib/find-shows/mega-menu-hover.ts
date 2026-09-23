/**
 * Hover coordination for the Find Shows mega menu.
 *
 * The panels are Radix popovers rendered in a portal, so the panel is NOT a
 * DOM child of the pill that opens it: a `mouseleave` on the pill fires the
 * moment the cursor starts travelling towards the panel. Closing on that event
 * directly is what made the menu feel like it vanished. Instead every leave
 * only *schedules* a close, and any re-entry — pill or panel — cancels it.
 *
 * One controller owns every menu in the bar, so hovering a different pill
 * swaps panels instantly instead of leaving two open during the grace period.
 *
 * Kept free of React so the timing rules can be tested with fake timers.
 */

/**
 * How long a panel stays open after the cursor leaves it. Long enough to cross
 * the gap between a pill and its panel, or to recover from a small overshoot,
 * without leaving the panel parked over the results grid.
 */
export const MEGA_MENU_CLOSE_DELAY_MS = 2000;

type TimerHandle = ReturnType<typeof setTimeout>;

export type MegaMenuTimers = {
  setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
};

/**
 * How the open menu was opened. A hover-opened panel must not pull focus (the
 * cursor is still elsewhere and focusing would scroll the page), while one
 * opened from the keyboard or a click focuses normally.
 */
export type MegaMenuOpenSource = 'hover' | 'interaction';

export type MegaMenuController = {
  /** Currently open menu id, or null. */
  getOpenId: () => string | null;
  /** How the currently open menu was opened. */
  getOpenSource: () => MegaMenuOpenSource;
  /** Opens `id` at once, cancelling any pending close. */
  openNow: (id: string, source?: MegaMenuOpenSource) => void;
  /** Click behaviour: open `id`, or close it when it is already open. */
  toggle: (id: string) => void;
  /** Escape, outside click, or a chosen filter — close without the grace period. */
  closeNow: () => void;
  /** Cursor left a pill or a panel: close after the grace period. */
  scheduleClose: () => void;
  /** Cursor came back within the grace period. */
  cancelScheduledClose: () => void;
  isCloseScheduled: () => boolean;
  /** Clears any pending timer (unmount). */
  dispose: () => void;
};

export function createMegaMenuController({
  onChange,
  delayMs = MEGA_MENU_CLOSE_DELAY_MS,
  timers = globalThis,
}: {
  onChange: (openId: string | null) => void;
  delayMs?: number;
  timers?: MegaMenuTimers;
}): MegaMenuController {
  let openId: string | null = null;
  let openSource: MegaMenuOpenSource = 'interaction';
  let closeHandle: TimerHandle | null = null;

  const cancelScheduledClose = () => {
    if (closeHandle !== null) {
      timers.clearTimeout(closeHandle);
      closeHandle = null;
    }
  };

  const setOpenId = (nextId: string | null) => {
    if (openId === nextId) {
      return;
    }
    openId = nextId;
    onChange(openId);
  };

  const closeNow = () => {
    cancelScheduledClose();
    setOpenId(null);
  };

  const openNow = (id: string, source: MegaMenuOpenSource = 'interaction') => {
    cancelScheduledClose();
    openSource = source;
    setOpenId(id);
  };

  return {
    getOpenId: () => openId,
    getOpenSource: () => openSource,
    openNow,
    closeNow,
    cancelScheduledClose,
    isCloseScheduled: () => closeHandle !== null,
    dispose: cancelScheduledClose,
    toggle: (id: string) => {
      if (openId === id) {
        closeNow();
        return;
      }
      openNow(id, 'interaction');
    },
    scheduleClose: () => {
      if (openId === null) {
        return;
      }
      cancelScheduledClose();
      closeHandle = timers.setTimeout(() => {
        closeHandle = null;
        setOpenId(null);
      }, delayMs);
    },
  };
}
