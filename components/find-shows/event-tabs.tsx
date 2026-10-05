'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { EXHIBITORS_TAB } from '@/lib/find-shows/exhibitor-return';

/**
 * The event page's tabs, opening on the Exhibitors tab when the address says `?tab=exhibitors` — how a
 * visitor sent to sign in for an exhibitor's details comes back to it, for any event.
 *
 * The server's reading of the address only covers a fresh load. Back from the sign-in page, the router
 * restores the page as it was first rendered, so the address is read again here once mounted.
 */
export function EventTabs({ initialTab, className, children }: { initialTab: string; className?: string; children: ReactNode }) {
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === EXHIBITORS_TAB) setTab(EXHIBITORS_TAB);
  }, []);

  return (
    <Tabs value={tab} onValueChange={setTab} className={className}>
      {children}
    </Tabs>
  );
}
