"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Menu,
  Search,
  Plus,
  LogOut,
  User,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Mic2, ChevronDown } from "lucide-react";

export function AppTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.push("/auth/sign-in");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.04] bg-[#0E1321] px-4 md:px-6">
      <div className="flex items-center flex-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="md:hidden"
        >
          <Menu className="size-5" />
        </Button>

        {/* Search */}
        <div className="relative hidden sm:flex items-center mr-auto w-full max-w-[400px]">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500 z-10" />
          <input
            type="text"
            placeholder="Search events, companies, people, deals..."
            className="w-full h-10 rounded-xl border border-white/[0.08] bg-[#141A2D] pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Quick add with Dropdown (+ New) */}
        <div className="relative hidden sm:block">
          <button 
            type="button"
            onClick={() => setNewMenuOpen(!newMenuOpen)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-400 transition-colors"
          >
            <Plus className="size-4" /> New
          </button>

          {newMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNewMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-50 w-40 rounded-xl border border-white/[0.08] bg-[#0E1321] p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                {['Lead', 'Company', 'Event', 'Deal', 'Sequence'].map((item) => (
                  <button
                    key={item}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.04] hover:text-white transition-colors"
                    onClick={() => setNewMenuOpen(false)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Notifications */}
        <div className="relative mx-1">
          <button type="button" className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition-colors">
            <Bell className="size-4.5" />
          </button>
          <span className="absolute right-1.5 top-1.5 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/75" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
        </div>

        {/* Intelligence Icon (Pinterest Style) */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer group">
          <div className="relative flex items-center justify-center size-8 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 p-1.5 shadow-glow-sm transition-transform group-hover:scale-110">
             <Mic2 className="size-full text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 group-hover:text-white transition-colors">Event Intel</span>
        </div>

        {/* ThemeToggle is kept from custom component but enclosed visually */}
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>

        {/* User menu */}
        <div className="relative ml-1">
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-full border border-white/[0.04] bg-[#141A2D] p-1 pr-3 hover:bg-[#1A2138] transition-colors"
          >
            <div className="flex size-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
              <User className="size-4" />
            </div>
            <span className="text-sm font-medium text-slate-200 hidden sm:block">Admin</span>
          </button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 top-11 z-50 w-48 rounded-xl border border-white/[0.08] bg-[#0E1321] p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/app/settings");
                  }}
                >
                  <User className="size-3.5" /> Profile
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/app/settings");
                  }}
                >
                  <Settings className="size-3.5" /> Settings
                </button>
                <div className="my-1 border-t border-white/[0.04]" />
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleSignOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-500/10"
                >
                  <LogOut className="size-3.5" /> Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
