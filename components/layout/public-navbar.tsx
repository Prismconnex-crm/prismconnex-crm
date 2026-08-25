'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Menu, X, ArrowRight, Sun, MoonStar, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { BrandLogo } from '@/components/brand-logo';
import { BrandWordmark } from '@/components/brand-wordmark';
import { useLocale, useTranslations } from 'next-intl';
import { localizePathname } from '@/lib/locale';
import type { Locale } from '@/types';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

const navLinks = [
  { href: '/product', labelKey: 'product' },
  { href: '/pricing', labelKey: 'pricing' },
  { href: '/security', labelKey: 'security' },
  { href: '/find-shows', labelKey: 'findShows' },
] as const;

const searchRouteDefs = [
  { keywords: ['product', 'features'], labelKey: 'product', href: '/product' },
  { keywords: ['pricing', 'plans', 'price'], labelKey: 'pricing', href: '/pricing' },
  { keywords: ['security', 'compliance', 'soc', 'gdpr'], labelKey: 'security', href: '/security' },
  {
    keywords: ['find shows', 'trade shows', 'events', 'exhibitions', 'uk events', 'germany events'],
    labelKey: 'findShows',
    href: '/find-shows',
  },
  { keywords: ['signin', 'sign in', 'login', 'log in'], labelKey: 'signIn', href: '/auth/sign-in' },
  { keywords: ['trial', 'start', 'free'], labelKey: 'startTrial', href: '/auth/sign-in' },
] as const;

const themeOptions = [
  { value: 'light', labelKey: 'light', icon: Sun },
  { value: 'dark', labelKey: 'dark', icon: MoonStar },
  { value: 'system', labelKey: 'system', icon: Monitor },
] as const;

type SearchRoute = {
  href: string;
  label: string;
  keywords: string[];
};

type SearchStrings = {
  placeholder: string;
  noResults: string;
  navigate: string;
  open: string;
};

function CmdKModal({
  open,
  onClose,
  routes,
  strings,
}: {
  open: boolean;
  onClose: () => void;
  routes: SearchRoute[];
  strings: SearchStrings;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? routes.filter((route) =>
        [route.label, ...route.keywords].some((keyword) =>
          keyword.toLowerCase().includes(query.toLowerCase())
        )
      )
    : routes;

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const navigate = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((index) => (index + 1) % filtered.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((index) => (index - 1 + filtered.length) % filtered.length);
      } else if (event.key === 'Enter' && filtered[selectedIndex]) {
        navigate(filtered[selectedIndex].href);
      } else if (event.key === 'Escape') {
        onClose();
      }
    },
    [filtered, navigate, onClose, selectedIndex]
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        if (open) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-x-4 top-[15%] z-[101] mx-auto max-w-lg overflow-hidden rounded-2xl border border-slate-200/60 bg-white/95 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#0f1729]/95"
          >
            <div className="flex items-center gap-3 border-b border-slate-200/50 px-5 py-4 dark:border-white/[0.06]">
              <Search className="size-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={strings.placeholder}
                className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                ESC
              </kbd>
            </div>

            <div className="max-h-64 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                  {strings.noResults}
                </p>
              ) : (
                filtered.map((route, index) => (
                  <button
                    key={route.href}
                    type="button"
                    onClick={() => navigate(route.href)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition-all duration-150 ${
                      index === selectedIndex
                        ? 'bg-indigo-500/10 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300'
                        : 'text-slate-600 hover:bg-slate-100/60 dark:text-slate-400 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="font-medium">{route.label}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{route.href}</span>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-slate-200/50 px-5 py-3 dark:border-white/[0.06]">
              <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                <kbd className="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 text-[10px] dark:border-white/10 dark:bg-white/5">
                  ??
                </kbd>
                {strings.navigate}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                <kbd className="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 text-[10px] dark:border-white/10 dark:bg-white/5">
                  ?
                </kbd>
                {strings.open}
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ThemeDropdown({
  labels,
}: {
  labels: {
    toggle: string;
    light: string;
    dark: string;
    system: string;
  };
}) {
  const { setTheme, theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentTheme = mounted ? theme : undefined;
  const currentIcon = themeOptions.find((option) => option.value === currentTheme)?.icon || Sun;
  const CurrentIcon = currentIcon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="nav-action-btn relative flex size-9 items-center justify-center rounded-xl border border-slate-200/60 bg-slate-50/80 text-slate-500 transition-all duration-200 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-white/[0.15] dark:hover:bg-white/[0.08] dark:hover:text-white"
        aria-label={labels.toggle}
      >
        <CurrentIcon className="size-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 min-w-[140px] overflow-hidden rounded-xl border border-slate-200/60 bg-white/95 p-1 shadow-xl shadow-slate-900/10 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#0f1729]/95 dark:shadow-black/30"
          >
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const active = mounted && currentTheme === option.value;
              const label = labels[option.labelKey];

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setTheme(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
                    active
                      ? 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400'
                      : 'text-slate-600 hover:bg-slate-100/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white'
                  }`}
                >
                  <Icon className="size-3.5" />
                  {label}
                  {active ? <span className="ml-auto size-1.5 rounded-full bg-indigo-500" /> : null}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavLink({ href, label, isActive }: { href: string; label: string; isActive: boolean }) {
  const [hovered, setHovered] = useState(false);
  const showMarker = isActive || hovered;

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`nav-link group relative flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
        isActive
          ? 'text-indigo-600 dark:text-indigo-400'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
      }`}
    >
      <span
        className={`nav-marker absolute -left-1 top-1/2 flex -translate-y-1/2 items-center gap-px transition-all duration-300 ${
          showMarker ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'
        }`}
      >
        <span className="h-5 w-[3px] rounded-full bg-gradient-to-b from-indigo-500 to-blue-500" />
        <span className="size-0 border-y-[4px] border-l-[5px] border-y-transparent border-l-indigo-500" />
      </span>

      {label}

      <span
        className={`absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-300 ${
          isActive
            ? 'scale-x-100 opacity-100'
            : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-60'
        }`}
        style={{ transformOrigin: 'center' }}
      />
    </Link>
  );
}

export function PublicNavbar() {
  const t = useTranslations('marketing.navbar');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const localizedNavLinks = navLinks.map((link) => ({
    href: localizePathname(link.href, locale),
    label: t(`links.${link.labelKey}`),
  }));

  const localizedSearchRoutes: SearchRoute[] = searchRouteDefs.map((route) => ({
    href: route.href.startsWith('/auth') ? route.href : localizePathname(route.href, locale),
    label: t(`links.${route.labelKey}`),
    keywords: [...route.keywords],
  }));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setCmdkOpen((value) => !value);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-500 ${
          scrolled
            ? 'bg-white/90 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(99,102,241,0.06)] backdrop-blur-xl dark:bg-[#0B1220]/90 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_8px_24px_rgba(99,102,241,0.08)]'
            : 'bg-white/80 backdrop-blur-lg dark:bg-[#0B1220]/80'
        }`}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400" />

        <div className="pointer-events-none absolute inset-0 hidden overflow-hidden dark:block">
          <div className="nav-particle absolute left-[15%] top-3 size-[2px] rounded-full bg-indigo-400/30" />
          <div className="nav-particle absolute left-[40%] top-5 size-[1.5px] rounded-full bg-blue-400/25 [animation-delay:0.8s]" />
          <div className="nav-particle absolute left-[65%] top-2 size-[2px] rounded-full bg-cyan-400/20 [animation-delay:1.6s]" />
          <div className="nav-particle absolute left-[85%] top-4 size-[1.5px] rounded-full bg-indigo-400/25 [animation-delay:2.4s]" />
        </div>

        <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
          <Link href={localizePathname('/', locale)} className="flex items-center gap-3">
            <div className="relative flex size-11 items-center justify-center overflow-hidden rounded-xl">
              {/*
                `mix-blend-multiply` was there to knock the opaque JPEG's white
                background out against the light navbar. The variants have a
                real alpha channel, so it is no longer needed.
              */}
              <BrandLogo
                width={42}
                height={42}
                style={{ width: 'auto', height: 'auto' }}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                <BrandWordmark />
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600 dark:text-slate-300">
                Global Solutions
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {localizedNavLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                isActive={pathname === link.href || pathname.startsWith(`${link.href}/`)}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCmdkOpen(true)}
              className="nav-action-btn relative hidden size-9 items-center justify-center rounded-xl border border-slate-200/60 bg-slate-50/80 text-slate-500 transition-all duration-200 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-white/[0.15] dark:hover:bg-white/[0.08] dark:hover:text-white md:flex"
              aria-label={t('searchButton')}
            >
              <Search className="size-4" />
            </button>

            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>

            <div className="hidden md:block">
              <ThemeDropdown
                labels={{
                  toggle: t('theme.toggle'),
                  light: t('theme.light'),
                  dark: t('theme.dark'),
                  system: t('theme.system'),
                }}
              />
            </div>

            <div className="hidden h-5 w-px bg-slate-200 dark:bg-white/[0.08] md:block" />

            <Link
              href="/auth/sign-in"
              className="group/signin relative hidden items-center justify-center overflow-hidden rounded-full border border-slate-300 px-5 py-2 text-[13px] font-semibold text-slate-600 transition-all duration-300 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.12)] dark:border-white/[0.12] dark:text-slate-300 dark:hover:border-indigo-400/40 md:flex"
            >
              <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/[0.06] via-emerald-500/[0.04] to-indigo-500/[0.06] opacity-0 transition-opacity duration-300 group-hover/signin:opacity-100" />
              <span className="relative transition-opacity duration-200 group-hover/signin:opacity-0">
                {t('links.signIn')}
              </span>
              <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-indigo-500 to-emerald-500 bg-clip-text text-[13px] font-semibold text-transparent opacity-0 transition-opacity duration-200 group-hover/signin:opacity-100">
                {t('links.signIn')}
              </span>
            </Link>

            <Link href="/auth/sign-in" className="hidden md:block">
              <div className="nav-cta-border group/cta relative rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400 bg-[length:400%_100%] p-[3px] transition-all duration-500 hover:shadow-[0_0_24px_rgba(139,92,246,0.35),0_0_60px_rgba(59,130,246,0.15)] active:scale-[0.97]">
                <div className="relative flex items-center gap-1.5 rounded-full bg-[#0a0f1e] px-5 py-2.5 transition-all duration-300 group-hover/cta:bg-[#0e1428]">
                  <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-700 group-hover/cta:translate-x-full" />
                  </span>
                  <span className="relative text-[12px] font-semibold text-white">
                    {t('links.startTrial')}
                  </span>
                  <ArrowRight className="relative size-3 text-white/80 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
                </div>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white md:hidden"
              aria-label={t('mobileMenu')}
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X className="size-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Menu className="size-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm dark:bg-black/40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="fixed inset-x-3 top-[82px] z-50 rounded-2xl border border-slate-200/60 bg-white/95 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#0f1729]/95 dark:shadow-black/30 md:hidden"
            >
              <div className="space-y-1">
                {localizedNavLinks.map((link) => {
                  const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white'
                      }`}
                    >
                      {link.label}
                      {isActive ? (
                        <span className="ml-auto size-1.5 rounded-full bg-indigo-500" />
                      ) : null}
                    </Link>
                  );
                })}
              </div>

              <div className="my-3 border-t border-slate-200/50 dark:border-white/[0.06]" />

              <div className="space-y-2 px-2 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    setCmdkOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/[0.04]"
                >
                  <Search className="size-3.5" />
                  {t('searchCta')}
                </button>
                <div className="flex items-center justify-between gap-2">
                  <LanguageSwitcher mobile />
                  <ThemeDropdown
                    labels={{
                      toggle: t('theme.toggle'),
                      light: t('theme.light'),
                      dark: t('theme.dark'),
                      system: t('theme.system'),
                    }}
                  />
                </div>
              </div>

              <div className="my-3 border-t border-slate-200/50 dark:border-white/[0.06]" />

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/auth/sign-in"
                  className="flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-white/[0.08] dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  {t('links.signIn')}
                </Link>
                <Link
                  href="/auth/sign-in"
                  className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:brightness-105 hover:shadow-lg"
                  onClick={() => setMobileOpen(false)}
                >
                  {t('links.startTrialShort')}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CmdKModal
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        routes={localizedSearchRoutes}
        strings={{
          placeholder: t('searchPlaceholder'),
          noResults: t('searchNoResults'),
          navigate: t('searchNavigate'),
          open: t('searchOpen'),
        }}
      />
    </>
  );
}
