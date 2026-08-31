"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, PanelLeftClose, PanelLeft, Building, X } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { BrandWordmark } from "@/components/brand-wordmark";
import { navItems } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { useSidebar } from "./sidebar-context";

export function AppSidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const activeSlug = pathname.split("/app/")[1]?.split("/")[0] || "dashboard";

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 72 : 256 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "fixed z-50 flex h-screen flex-col border-r border-slate-200 bg-white dark:border-white/[0.04] dark:bg-[#0E1321] transition-transform duration-300 ease-in-out",
          // Mobile: slide-over drawer (always in DOM, translated off-screen when closed)
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: always visible, static positioning
          "md:static md:translate-x-0",
          isCollapsed ? "w-[72px]" : "w-64" // Fallback classes
        )}
      >
        {/* Logo & Toggle Header */}
        <div className="flex h-16 items-center border-b border-slate-200 px-4 bg-white dark:border-white/[0.04] dark:bg-[#0E1321] relative overflow-hidden shrink-0">
          
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors md:hidden z-20"
            aria-label="Close sidebar"
          >
            <X className="size-5" />
          </button>
          
          {/* Default Logo + Name (Visible when expanded) */}
          <Link 
             href="/app/dashboard"
             className={cn(
                "inline-flex items-center gap-3 group shrink-0 min-w-0 transition-opacity duration-200 absolute left-4",
                isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
             )}
          >
            {/* The emblem stands on its own: no plate, no border, no hover
                transform. The bordered rounded square used to exist to contain
                the full lockup, whose baked-in wordmark was unreadable at 36px
                and made the whole thing read as a rectangle. BrandMark is the
                emblem alone, so it needs no container to look like a logo. */}
            <div className="relative h-9 w-9 shrink-0">
              <BrandMark fill sizes="36px" className="object-contain" priority />
            </div>

            {/* Company name sits to the right of the emblem — BrandMark renders
                the mark only, so there is no duplicate wordmark. */}
            {/* Brand blue, matching the wordmark in the logo artwork, rather
                than the near-black/white the rest of the shell's text uses.
                `brand` -> `brand-hover` on dark is the standard substitution
                from globals.css: #005C9D is only 2.47:1 on the #0E1321
                sidebar, #0086E6 restores it to 4.55:1. */}
            <div className="leading-tight overflow-hidden whitespace-nowrap">
              <p className="text-sm font-bold tracking-wide text-brand dark:text-brand-hover">
                <BrandWordmark />
              </p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-brand dark:text-brand-hover">
                Global Solutions
              </p>
            </div>
          </Link>

          {/* Toggle Button Container - Positioned to perfectly cover the logo when collapsed, or float right when expanded */}
          <div className={cn(
            "flex items-center justify-center absolute transition-all duration-300 ease-in-out z-10",
             isCollapsed ? "left-1/2 -translate-x-1/2" : "right-3"
          )}>
            {/* Collapse Icon (Visible when expanded) */}
            <button 
              onClick={toggleSidebar}
              className={cn(
                "p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white transition-all absolute",
                isCollapsed ? "opacity-0 scale-75 pointer-events-none" : "opacity-100 scale-100"
              )}
              title="Collapse Sidebar"
            >
              <PanelLeftClose className="size-5" />
            </button>
            
            {/* Expand Icon (Visible when collapsed - exactly where logo would be) */}
            <button 
              onClick={toggleSidebar}
              className={cn(
                "p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-[#161B2B] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white transition-all shadow-md group",
                isCollapsed ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none absolute"
              )}
              title="Expand Sidebar"
            >
              <PanelLeft className="size-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 custom-scrollbar">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSlug === item.slug;
              return (
                <Link
                  key={item.slug}
                  href={`/app/${item.slug}`}
                  onClick={onClose}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 mb-0.5",
                    isActive
                      ? "bg-indigo-50 text-indigo-600 font-semibold dark:bg-indigo-500/10 dark:text-indigo-400"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white",
                    isCollapsed ? "justify-center px-0 w-12 mx-auto" : "justify-start px-3"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  {/* Active indicator line */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className={cn(
                         "absolute rounded-r-md bg-indigo-500",
                         isCollapsed ? "left-[-12px] top-1/2 h-6 w-1 -translate-y-1/2" : "left-0 top-1/2 h-5 w-1 -translate-y-1/2"
                      )}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon
                    className={cn(
                      "transition-all duration-200 shrink-0",
                      isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300",
                      isCollapsed ? "size-5" : "size-[18px]"
                    )}
                  />
                  
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span 
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              );
            })}
          </div>
        </nav>
        {/* Bottom Workspace Selector */}
        <div className={cn("mt-auto border-t border-slate-200 dark:border-white/[0.04]", isCollapsed ? "p-3" : "p-4")}>
          <button 
            onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
            className={cn(
                "flex w-full items-center rounded-lg border font-medium transition-all duration-300 focus:outline-none",
                isWorkspaceOpen && !isCollapsed
                    ? "bg-indigo-50 border-indigo-300 text-slate-900 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-white shadow-glow-sm" 
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-[#161B2B] dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.04]",
                isCollapsed ? "justify-center p-2 size-12 mx-auto" : "justify-between px-3 py-2 text-[13px]"
            )}
            title={isCollapsed ? "Switch Workspace" : undefined}
          >
            {isCollapsed ? (
               <Building className={cn("size-5", isWorkspaceOpen ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400")} />
            ) : (
                <>
                  <span className="truncate whitespace-nowrap">Prism Connex Workspace</span>
                  <ChevronDown className={cn("size-3.5 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-300 ml-2", isWorkspaceOpen && "rotate-180 text-indigo-400")} />
                </>
            )}
          </button>
        </div>
      </motion.aside>

      <WorkspaceSwitcher 
        isOpen={isWorkspaceOpen} 
        onClose={() => setIsWorkspaceOpen(false)} 
      />
    </>
  );
}
