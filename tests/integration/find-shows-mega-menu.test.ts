import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMegaMenuController,
  MEGA_MENU_CLOSE_DELAY_MS,
} from '../../lib/find-shows/mega-menu-hover';

describe('find shows mega menu hover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const changes: Array<string | null> = [];
    const controller = createMegaMenuController({ onChange: (id) => changes.push(id) });
    return { controller, changes };
  }

  it('closes on a 2000ms timer, not on the mouseleave itself', () => {
    const { controller } = setup();

    controller.openNow('region:Europe');
    controller.scheduleClose();

    // Still open right up to the deadline: a small overshoot or the gap
    // between the pill and the panel must not close it.
    expect(controller.getOpenId()).toBe('region:Europe');
    vi.advanceTimersByTime(MEGA_MENU_CLOSE_DELAY_MS - 1);
    expect(controller.getOpenId()).toBe('region:Europe');

    vi.advanceTimersByTime(1);
    expect(controller.getOpenId()).toBeNull();
    expect(MEGA_MENU_CLOSE_DELAY_MS).toBe(2000);
  });

  it('does not close when the cursor comes back within the grace period', () => {
    const { controller } = setup();

    controller.openNow('region:Americas');
    controller.scheduleClose();
    vi.advanceTimersByTime(MEGA_MENU_CLOSE_DELAY_MS - 500);

    // Cursor re-enters the panel: the pending timeout is cleared.
    controller.cancelScheduledClose();
    expect(controller.isCloseScheduled()).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(controller.getOpenId()).toBe('region:Americas');
  });

  it('restarts the grace period on every leave', () => {
    const { controller } = setup();

    controller.openNow('region:Europe');
    controller.scheduleClose();
    vi.advanceTimersByTime(MEGA_MENU_CLOSE_DELAY_MS - 500);
    controller.cancelScheduledClose();
    controller.scheduleClose();

    // The clock restarts, so the earlier 1500ms must not count towards it.
    vi.advanceTimersByTime(MEGA_MENU_CLOSE_DELAY_MS - 500);
    expect(controller.getOpenId()).toBe('region:Europe');

    vi.advanceTimersByTime(500);
    expect(controller.getOpenId()).toBeNull();
  });

  it('swaps panels immediately when another pill is hovered', () => {
    const { controller, changes } = setup();

    controller.openNow('region:Europe');
    controller.scheduleClose();
    controller.openNow('region:Asia-Pacific');

    expect(controller.getOpenId()).toBe('region:Asia-Pacific');
    expect(controller.isCloseScheduled()).toBe(false);

    // The pending close from the first pill must not take the second one down.
    vi.advanceTimersByTime(MEGA_MENU_CLOSE_DELAY_MS + 1000);
    expect(controller.getOpenId()).toBe('region:Asia-Pacific');
    expect(changes).toEqual(['region:Europe', 'region:Asia-Pacific']);
  });

  it('closes at once on a selection, Escape or an outside click', () => {
    const { controller } = setup();

    controller.openNow('region:Europe');
    controller.closeNow();

    expect(controller.getOpenId()).toBeNull();
    expect(controller.isCloseScheduled()).toBe(false);
  });

  it('toggles on click', () => {
    const { controller } = setup();

    controller.toggle('category');
    expect(controller.getOpenId()).toBe('category');

    controller.toggle('category');
    expect(controller.getOpenId()).toBeNull();

    controller.toggle('category');
    controller.toggle('region:Europe');
    expect(controller.getOpenId()).toBe('region:Europe');
  });

  it('ignores a scheduled close when nothing is open', () => {
    const { controller, changes } = setup();

    controller.scheduleClose();
    expect(controller.isCloseScheduled()).toBe(false);

    vi.advanceTimersByTime(MEGA_MENU_CLOSE_DELAY_MS);
    expect(changes).toEqual([]);
  });

  it('drops a pending close on dispose so an unmounted bar cannot fire it', () => {
    const { controller, changes } = setup();

    controller.openNow('region:Europe');
    controller.scheduleClose();
    controller.dispose();

    vi.advanceTimersByTime(MEGA_MENU_CLOSE_DELAY_MS + 1000);
    expect(changes).toEqual(['region:Europe']);
  });

  it('notifies only on real changes', () => {
    const { controller, changes } = setup();

    controller.openNow('region:Europe');
    controller.openNow('region:Europe');
    controller.closeNow();
    controller.closeNow();

    expect(changes).toEqual(['region:Europe', null]);
  });
});
