"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Mic, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { localeDetails, localizePathname } from "@/lib/locale";
import type { Locale } from "@/types";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function LanguageSwitcher({ mobile = false }: { mobile?: boolean }) {
  const t = useTranslations("marketing.languageSwitcher");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, startTransition] = useTransition();

  const activeLocale = localeDetails.find((item) => item.code === locale) ?? localeDetails[0];

  async function handleSelect(nextLocale: Locale) {
    setOpen(false);

    if (nextLocale === locale) {
      return;
    }

    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
    } catch {
      // Route navigation still updates the visible locale even if persistence fails.
    }

    startTransition(() => {
      router.replace(localizePathname(pathname, nextLocale));
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group relative inline-flex items-center overflow-hidden rounded-xl border border-slate-200/60 bg-slate-50/80 text-slate-600 transition-all duration-300 hover:border-cyan-400/50 hover:bg-white hover:text-slate-900 hover:shadow-[0_0_24px_rgba(34,211,238,0.18)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-cyan-400/35 dark:hover:bg-white/[0.07] dark:hover:text-white dark:hover:shadow-[0_0_24px_rgba(34,211,238,0.16)]",
            mobile ? "w-full justify-between px-3 py-2.5" : "gap-2 px-3 py-2"
          )}
          aria-label={t("toggle")}
          disabled={isSaving}
        >
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="relative flex items-center gap-2">
            <span className="relative flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <div className="relative">
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                    fill="currentColor"
                  />
                  <path
                    d="M19 10v2a7 7 0 0 1-14 0v-2"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line
                    x1="12"
                    y1="19"
                    x2="12"
                    y2="23"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="8"
                    y1="23"
                    x2="16"
                    y2="23"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute -bottom-1 -right-1 flex size-3 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-blue-600/20">
                  <span className="text-[7px] font-black text-blue-600 leading-none">T</span>
                </div>
              </div>
              <Sparkles className="absolute -right-0.5 -top-0.5 size-2.5 text-cyan-100" />
            </span>
            <span className={cn("flex flex-col items-start leading-none", mobile ? "min-w-0 flex-1" : "min-w-[96px] max-w-[132px]")}>
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400 transition-colors group-hover:text-cyan-500 dark:text-slate-500 dark:group-hover:text-cyan-300">
                {t("label")}
              </span>
              <span className="mt-1 truncate text-sm font-semibold">{activeLocale.nativeLabel}</span>
            </span>
          </span>
          <ChevronsUpDown className="relative size-4 text-slate-400 transition-colors group-hover:text-cyan-500 dark:text-slate-500 dark:group-hover:text-cyan-300" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={mobile ? "center" : "end"} className="w-[320px] p-0">
        <Command>
          <CommandInput placeholder={t("searchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("empty")}</CommandEmpty>
            <CommandGroup>
              {localeDetails.map((item) => (
                <CommandItem key={item.code} value={`${item.nativeLabel} ${item.label}`} onSelect={() => handleSelect(item.code)}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="inline-flex h-9 min-w-[52px] items-center justify-center rounded-xl border border-slate-200/70 bg-slate-50 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400">
                      {item.switcherCode}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.nativeLabel}</p>
                      <p className="truncate text-xs text-slate-400 dark:text-slate-500">{item.label}</p>
                    </div>
                  </div>
                  <Check className={cn("ml-auto size-4", item.code === locale ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <div className="px-4 py-3 text-[11px] text-slate-400 dark:text-slate-500">{t("hint")}</div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
