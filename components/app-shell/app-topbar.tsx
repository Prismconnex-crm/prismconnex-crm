"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Menu,
  Search,
  Plus,
  LogOut,
  User,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import { AvatarViewer } from "./avatar-viewer";
import { AVATAR_CHANGED_EVENT, type AvatarChangedDetail } from "@/lib/profile-events";
import type { AppShellUser } from "./app-shell";

/** Initials for the avatar, e.g. "Ada Byron Lovelace" -> "AL". */
function initialsOf(name: string | null, email: string | null) {
  const source = name?.trim();
  if (source) {
    const parts = source.split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  return email?.[0]?.toUpperCase() ?? "";
}

export function AppTopbar({
  onMenuClick,
  user,
}: {
  onMenuClick: () => void;
  user?: AppShellUser;
}) {
  const router = useRouter();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Falls back to the email local-part, then a neutral label, so the topbar
  // never renders an identity the session does not actually have.
  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "Account";
  const initials = initialsOf(user?.name ?? null, user?.email ?? null);

  /**
   * The avatar is the one piece of identity that changes without a navigation,
   * so it is held in state seeded from the server-rendered prop. The Profile
   * page's photo upload broadcasts AVATAR_CHANGED_EVENT and both avatars here
   * update in place — no reload, no refetch.
   */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);

  // Re-seed when the server sends a new value (a fresh load, or a navigation
  // that re-renders the layout), so the prop stays authoritative.
  useEffect(() => {
    setAvatarUrl(user?.avatarUrl ?? null);
  }, [user?.avatarUrl]);

  useEffect(() => {
    const onAvatarChanged = (event: Event) => {
      setAvatarUrl((event as CustomEvent<AvatarChangedDetail>).detail ?? null);
    };

    window.addEventListener(AVATAR_CHANGED_EVENT, onAvatarChanged);
    return () => window.removeEventListener(AVATAR_CHANGED_EVENT, onAvatarChanged);
  }, []);

  const submitSearch = () => {
    const query = searchValue.trim();
    if (!query) return;
    // Companies section listens for this when already mounted; the ?q= param
    // covers the case where the search triggers a navigation to the page.
    router.push(`/app/companies?q=${encodeURIComponent(query)}`);
    window.dispatchEvent(new CustomEvent("pcx:company-search", { detail: query }));
  };

  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);

    try {
      // Revokes the Supabase session (supabase.auth.signOut, scope=global) and
      // expires every auth cookie. The route always returns 200 and always
      // clears cookies, even if the Supabase call failed.
      const res = await fetch("/api/auth/sign-out", { method: "POST" });
      if (!res.ok) throw new Error(`Sign out failed: ${res.status}`);
    } catch (error) {
      // Logged, not surfaced: the redirect below still ends the session. The
      // cookies are httpOnly so they cannot be cleared here, but /login and
      // every private route are guarded server-side, so a stale or partially
      // cleared cookie cannot get the user back into the app.
      console.error("[sign-out]", error);
    } finally {
      // ?signedOut=1 makes the login page show the confirmation banner.
      router.replace("/login?signedOut=1");
      // Drops the cached RSC payload for /app so a back-navigation cannot
      // render the authenticated shell from cache.
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white dark:border-white/[0.04] dark:bg-[#0E1321] px-4 md:px-6">
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
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500 z-10" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch();
            }}
            placeholder="Search events, companies, people, deals..."
            className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/[0.08] dark:bg-[#141A2D] pl-10 pr-4 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
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
              <div className="absolute right-0 top-11 z-50 w-40 rounded-xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[#0E1321] p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                {['Lead', 'Company', 'Event', 'Deal', 'Sequence'].map((item) => (
                  <button
                    key={item}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.04] dark:hover:text-white transition-colors"
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
          <button type="button" className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-slate-200 transition-colors">
            <Bell className="size-4.5" />
          </button>
          <span className="absolute right-1.5 top-1.5 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/75" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
        </div>

        {/* ThemeToggle is kept from custom component but enclosed visually */}
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>

        {/* User menu */}
        <div className="relative ml-1">
          {/*
              Two controls sharing one pill, not one button doing two things:
              the photo opens the image viewer, the name opens the menu. They
              have to be siblings because a <button> cannot legally nest inside
              another <button> — the browser drops the inner one.
          */}
          <div className="flex max-w-[260px] items-center rounded-full border border-slate-200 bg-slate-50 p-1 pr-1 dark:border-white/[0.04] dark:bg-[#141A2D]">
            <button
              type="button"
              onClick={() => setViewerOpen(true)}
              title="View profile image"
              aria-label="View profile image"
              className="rounded-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            >
              <UserAvatar src={avatarUrl} initials={initials} size={36} />
            </button>

            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              className="flex min-w-0 items-center gap-1 rounded-full px-2 py-1.5 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 dark:hover:bg-white/[0.06]"
            >
              {/*
                  truncate + min-w-0 so a long name ("Reddappa gari
                  manjunatha") shortens instead of pushing the header controls
                  out of line. Hidden below sm, where the chevron alone opens
                  the menu and the avatar stays visible.
              */}
              <span className="hidden min-w-0 truncate text-sm font-medium text-slate-700 sm:block dark:text-slate-200">
                {displayName}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-slate-500 transition-transform dark:text-slate-400",
                  userMenuOpen && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>
          </div>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              {/* w-64 rather than w-56: the identity block is now centred
                  around a 64px photo, and an email still needs to fit. */}
              <div
                role="menu"
                aria-label="User menu"
                className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-200 dark:border-white/[0.08] dark:bg-[#0E1321]"
              >
                {/* Signed-in identity: the same photo and name as the trigger,
                    plus the email, which appears nowhere else in the shell.
                    The photo opens the viewer, as it does on the trigger. */}
                <div className="flex flex-col items-center gap-2 px-3 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setViewerOpen(true);
                    }}
                    title="View profile image"
                    aria-label="View profile image"
                    className="rounded-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                  >
                    <UserAvatar src={avatarUrl} initials={initials} size={64} />
                  </button>
                  <div className="w-full text-center">
                    <p className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {displayName}
                    </p>
                    {user?.email ? (
                      <p className="truncate text-[12px] text-slate-500" title={user.email}>
                        {user.email}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="my-1 border-t border-slate-200 dark:border-white/[0.04]" />

                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.04] dark:hover:text-white"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/app/profile");
                  }}
                >
                  <User className="size-3.5" /> Profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.04] dark:hover:text-white"
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/app/settings");
                  }}
                >
                  <Settings className="size-3.5" /> Settings
                </button>
                <div className="my-1 border-t border-slate-200 dark:border-white/[0.04]" />
                {/* Sign-out now makes a round trip to revoke the Supabase
                    session, so the control is disabled while it is in flight. */}
                <button
                  type="button"
                  role="menuitem"
                  disabled={signingOut}
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleSignOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-60"
                >
                  <LogOut className="size-3.5" /> Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Portals to the body, so the header's stacking context and
          overflow cannot clip it. */}
      <AvatarViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        src={avatarUrl}
        initials={initials}
        name={displayName}
      />
    </header>
  );
}
