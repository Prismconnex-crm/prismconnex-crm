'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs } from '@/components/ui/tabs';
import { EXHIBITORS_TAB } from '@/lib/find-shows/exhibitor-return';
import { FLOOR_PLAN_TAB, floorPlanTabUrl, opensFloorPlan } from '@/lib/find-shows/floor-plan-return';
import { signInHrefReturningTo } from '@/lib/auth/return-to';
import { isSignedIn } from '@/lib/auth/session-client';

/**
 * The event page's tabs, opening on the Exhibitors tab when the address says `?tab=exhibitors` — how a
 * visitor sent to sign in for an exhibitor's details comes back to it, for any event — and on the Floor
 * Plan tab for `?tab=floor-plan`.
 *
 * The Floor Plan tab, on every event, asks for sign-in the way an exhibitor's details do: signed-in
 * visitors open it at once; anyone else goes through the existing Prismconnex sign-in, which returns to
 * this event with the Floor Plan tab open. Back or a cancelled sign-in returns to the page as it was.
 *
 * The server's reading of the address only covers a fresh load. Back from the sign-in page, the router
 * restores the page as it was first rendered, so the address is read again here once mounted.
 */
export function EventTabs({ initialTab, className, children }: { initialTab: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  // Asked once when the page opens, so a click on Floor Plan rarely waits for it.
  const session = useRef<Promise<boolean> | null>(null);
  const signedIn = () => (session.current ??= isSignedIn());

  useEffect(() => {
    const { search } = window.location;
    if (new URLSearchParams(search).get('tab') === EXHIBITORS_TAB) setTab(EXHIBITORS_TAB);
    // Without a session the Floor Plan panel itself asks for sign-in, so a cancelled sign-in never loops.
    else if (opensFloorPlan(search)) setTab(FLOOR_PLAN_TAB);
    void signedIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = async (value: string) => {
    if (value !== FLOOR_PLAN_TAB) return setTab(value);
    if (await signedIn()) return setTab(value);
    session.current = null;
    const { pathname, search } = window.location;
    router.push(signInHrefReturningTo(floorPlanTabUrl(pathname, search)));
  };

  return (
    <Tabs value={tab} onValueChange={changeTab} className={className}>
      {children}
    </Tabs>
  );
}
