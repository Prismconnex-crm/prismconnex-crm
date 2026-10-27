/**
 * The Floor Plan tab in an event page's address, for any event:
 *
 *   /en-US/find-shows/<event>?tab=floor-plan
 *
 * The Floor Plan tab asks for sign-in the same way an exhibitor's details do: a visitor who is not signed in
 * is sent to the existing sign-in page with this address as its return, and lands back on the same event
 * with the Floor Plan tab open. The rule belongs to the tab, never to a floor-plan record, so it covers every
 * edition — plans verified now, found later, or editions added to the catalog afterwards.
 */
export const FLOOR_PLAN_TAB = 'floor-plan';

/** The event page's address with the Floor Plan tab open; other parameters are kept. */
export function floorPlanTabUrl(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  params.set('tab', FLOOR_PLAN_TAB);
  return `${pathname}?${params.toString()}`;
}

/** Whether an address asks for the Floor Plan tab (back from sign-in, or a shared link). */
export function opensFloorPlan(search: string) {
  return new URLSearchParams(search).get('tab') === FLOOR_PLAN_TAB;
}
