"use client";

import { useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { SidebarProvider } from "./sidebar-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [openMobile, setOpenMobile] = useState(false);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar open={openMobile} onClose={() => setOpenMobile(false)} />
        <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden transition-all duration-300">
          <AppTopbar onMenuClick={() => setOpenMobile(true)} />
          <main className="app-gradient flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
