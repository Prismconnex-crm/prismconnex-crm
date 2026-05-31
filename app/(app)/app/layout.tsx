import { AppShell } from "@/components/app-shell/app-shell";
import { CopilotWidget } from "@/components/app-shell/copilot-widget";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <CopilotWidget />
    </AppShell>
  );
}
