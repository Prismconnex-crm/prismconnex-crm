"use client";

import { MoonStar, Sun, MonitorSmartphone } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { cn } from "@/lib/utils";

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: MoonStar },
  { value: "system", label: "System", icon: MonitorSmartphone },
] as const;

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1">
      {themes.map((item) => {
        const Icon = item.icon;
        const active = mounted && item.value === theme;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => setTheme(item.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs transition",
              active
                ? "bg-accent text-white shadow-glow"
                : "text-muted-foreground hover:bg-elevated hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
