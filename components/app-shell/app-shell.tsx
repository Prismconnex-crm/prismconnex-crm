"use client";

import { useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { SidebarProvider } from "./sidebar-context";

/** Identity shown in the topbar, resolved server-side by app/(app)/app/layout.tsx. */
export type AppShellUser = {
  name: string | null;
  email: string | null;
  /**
   * profiles.avatar_url — the same column the Profile page's photo upload
   * writes. Null renders initials. Resolved server-side so the photo is present
   * on first paint instead of popping in after a client fetch.
   */
  avatarUrl: string | null;
};

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: AppShellUser;
}) {
  const [openMobile, setOpenMobile] = useState(false);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar open={openMobile} onClose={() => setOpenMobile(false)} />
        <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden transition-all duration-300">
          <AppTopbar onMenuClick={() => setOpenMobile(true)} user={user} />
          <main className="app-gradient flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
