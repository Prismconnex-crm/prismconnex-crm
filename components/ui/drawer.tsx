"use client";

import type * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-40 transition",
        open ? "pointer-events-auto bg-black/45" : "pointer-events-none bg-transparent"
      )}
      onClick={onClose}
    >
      <aside
        className={cn(
          "absolute right-0 top-0 h-full w-full max-w-md border-l border-border bg-card p-5 shadow-soft transition-transform",
          open ? "translate-x-0" : "translate-x-full"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-elevated hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="h-[calc(100%-2rem)] overflow-auto pr-1">{children}</div>
      </aside>
    </div>
  );
}
