"use client";

import { useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { SidebarProvider } from "./sidebar-context";
import { AssistantConversationProvider } from "@/components/assistant/assistant-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [openMobile, setOpenMobile] = useState(false);

  return (
    <SidebarProvider>
      {/* Lives here, not in a page: an App Router layout persists across
          navigation within its segment, so the conversation survives a
          handoff from Companies to Events without serialization. */}
      <AssistantConversationProvider>
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <AppSidebar open={openMobile} onClose={() => setOpenMobile(false)} />
          <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden transition-all duration-300">
            <AppTopbar onMenuClick={() => setOpenMobile(true)} />
            <main className="app-gradient flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
              {children}
            </main>
          </div>
        </div>
      </AssistantConversationProvider>
    </SidebarProvider>
  );
}
