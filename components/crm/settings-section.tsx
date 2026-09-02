"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutGrid,
    Globe,
    Palette,
    Bell,
    Send,
    Lock,
    Database,
    Moon,
    Sun,
    Monitor,
    Check,
    CheckCircle2,
    RotateCcw,
    ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SignOutDialog } from "@/components/app-shell/sign-out-dialog";
import { NotificationSettingsPanel } from "./settings/notification-settings-panel";

/**
 * The secondary nav. `href` marks the panels that are actually built: those
 * items navigate, so the panel is addressable and Back returns to the previous
 * one. The rest stay inert, as they were — a link to a panel that does not
 * exist would only highlight itself and change nothing on the right.
 */
const sidebarItems = [
    { id: "workspace", label: "Workspace", icon: LayoutGrid },
    { id: "localization", label: "Localization", icon: Globe },
    { id: "theme", label: "Theme", icon: Palette, href: "/app/settings" },
    { id: "notifications", label: "Notification Settings", icon: Bell, href: "/app/settings/notifications" },
    { id: "email", label: "Email Sending", icon: Send },
    { id: "privacy", label: "Privacy & Compliance", icon: Lock },
    { id: "data", label: "Data Retention", icon: Database },
];

/** Panels with their own content. Anything else falls back to Theme. */
const PANELS = ["theme", "notifications"] as const;
type Panel = (typeof PANELS)[number];

function panelFrom(sub: string | undefined): Panel {
    return PANELS.includes(sub as Panel) ? (sub as Panel) : "theme";
}

const accentColors = [
    { name: "Indigo", color: "bg-indigo-600" },
    { name: "Emerald", color: "bg-emerald-500" },
    { name: "Amber", color: "bg-amber-500" },
    { name: "Rose", color: "bg-rose-500" },
    { name: "Slate", color: "bg-slate-500" },
];

export function SettingsSection({ sub }: { sub?: string }) {
    const router = useRouter();
    // The URL is the source of truth for which panel is open (/app/settings ->
    // Theme, /app/settings/notifications -> Notification Settings), so Back and
    // Forward move between them and a panel can be linked to directly.
    const panel = panelFrom(sub);
    const [selectedTheme, setSelectedTheme] = useState("dark");
    const [selectedAccent, setSelectedAccent] = useState("Indigo");
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const [uiPrefs, setUiPrefs] = useState({
        compactSidebar: false,
        showConfidence: true,
        reduceMotion: false,
        highContrast: false,
    });

    // "Sign out from all devices" — the one real, irreversible action on this
    // page, so it is confirmed in a modal and reports its own outcome instead
    // of riding on the mock "Save Changes" toast below.
    const [signOutAllOpen, setSignOutAllOpen] = useState(false);
    const [signOutAllDone, setSignOutAllDone] = useState(false);

    /**
     * Posts to the same endpoint the topbar's Sign Out uses, with scope
     * "global": Supabase revokes every refresh token the user holds
     * (supabase.auth.signOut({ scope: 'global' })) and the route expires this
     * browser's auth cookies either way.
     *
     * Throwing on a failed request is what lets the dialog show the error and
     * offer a retry — the auth cookies are httpOnly, so a request that never
     * reached the server has ended nothing, and redirecting anyway would claim
     * a sign-out that did not happen.
     */
    const handleSignOutEverywhere = async () => {
        const res = await fetch("/api/auth/sign-out", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scope: "global" }),
        });

        if (!res.ok) {
            console.error("[sign-out] global sign-out failed", res.status);
            throw new Error(
                "We could not sign you out from all devices. Please try again."
            );
        }

        // Success is stated here and again on the login page: this card is
        // still on screen for the moment the redirect takes.
        setSignOutAllDone(true);
        // ?signedOut=1 makes the login page show the confirmation banner.
        router.replace("/login?signedOut=1");
        // Drops the cached RSC payload for /app so a back-navigation cannot
        // render the authenticated shell from cache.
        router.refresh();
    };

    const handleSave = () => {
        setSaving(true);
        setTimeout(() => {
            setSaving(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        }, 1000);
    };

    return (
        <div className={cn("flex flex-col h-full space-y-3 max-w-[1200px] mx-auto relative overflow-hidden", panel === "theme" ? "pb-14" : "pb-4")}>
            
            {/* Header Section */}
            <div className="space-y-0.5 shrink-0 border-b dark:border-white/[0.06] border-slate-200 pb-2">
                <h1 className="text-base font-bold dark:text-white text-slate-900 tracking-tight">Settings</h1>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">Workspace preferences, localization, theme, notifications, and compliance controls</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-start flex-1 min-h-0 overflow-hidden">
                
                {/* Secondary Sidebar */}
                <nav className="flex flex-col gap-0.5 p-1.5 dark:bg-white/[0.02] bg-white/70 backdrop-blur-xl border dark:border-white/[0.06] border-slate-200 rounded-xl shrink-0">
                    {sidebarItems.map((item) => {
                        const Icon = item.icon;
                        const active = item.id === panel;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                aria-current={active ? "page" : undefined}
                                onClick={item.href ? () => router.push(item.href) : undefined}
                                className={cn(
                                    "flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all duration-200 text-left text-[10px] font-medium group",
                                    active 
                                        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20" 
                                        : "dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 dark:hover:bg-white/5 hover:bg-slate-100 border border-transparent"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon className={cn("size-3.5", active ? "text-indigo-600 dark:text-indigo-400" : "dark:text-slate-500 text-slate-400 group-hover:dark:text-white group-hover:text-slate-800")} />
                                    {item.label}
                                </div>
                                {active && <span className="text-[7.5px] font-bold uppercase tracking-wider opacity-60">Active</span>}
                            </button>
                        );
                    })}
                </nav>

                {/* Content Area */}
                <div className={cn("space-y-3 overflow-y-auto custom-scrollbar pr-2 h-full", panel === "theme" ? "pb-20" : "pb-4")}>
                    
                    {/* One panel at a time, chosen by the URL. The Notification
                        Settings card is the very same component the Profile
                        page used to render — imported, not reimplemented, so
                        the toggles and their PATCH exist in one place. */}
                    {panel === "notifications" ? <NotificationSettingsPanel /> : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        {/* Theme Mode Card */}
                        <div className="dark:bg-white/[0.02] bg-white/70 backdrop-blur-xl border dark:border-white/[0.06] border-slate-200 rounded-xl p-3 space-y-3">
                            <h3 className="text-[12px] font-bold dark:text-white text-slate-900">Theme Mode</h3>
                            <div className="flex p-0.5 dark:bg-[#070B14] bg-slate-100 rounded-md border dark:border-white/[0.03] border-slate-200 gap-0.5">
                                {[
                                    { id: "light", label: "Light", icon: Sun },
                                    { id: "dark", label: "Dark", icon: Moon },
                                    { id: "system", label: "Auto", icon: Monitor },
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedTheme(t.id)}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium transition-all duration-200",
                                            selectedTheme === t.id 
                                                ? "bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.3)]" 
                                                : "dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900"
                                        )}
                                    >
                                        <t.icon className="size-3" />
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[9.5px] text-slate-600 dark:text-slate-400">System uses your device appearance setting.</p>
                        </div>

                        {/* Preview Card */}
                        <div className="dark:bg-white/[0.02] bg-white/70 backdrop-blur-xl border dark:border-white/[0.06] border-slate-200 rounded-xl p-3 space-y-3 flex flex-col justify-between">
                            <h3 className="text-[12px] font-bold dark:text-white text-slate-900">Preview</h3>
                            <div className="flex gap-3">
                                <div className="flex-1 space-y-1.5">
                                    <div className="aspect-[4/3] rounded-md bg-white border border-slate-200 p-1.5 overflow-hidden shadow-sm">
                                        <div className="w-full h-full bg-slate-50 rounded border border-slate-200 relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-3 bg-white border-b border-slate-200"></div>
                                            <div className="absolute top-4 left-1.5 w-10 h-10 bg-white border border-slate-200 shadow-sm"></div>
                                            <div className="absolute top-4 left-[56px] w-6 h-6 rounded-full bg-slate-200"></div>
                                            <div className="absolute top-4 right-1.5 w-12 h-2 rounded bg-slate-200"></div>
                                        </div>
                                    </div>
                                    <p className="text-[9.5px] font-medium text-slate-600 dark:text-slate-400 text-center">Light</p>
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    <div className="aspect-[4/3] rounded-md dark:bg-slate-900 bg-slate-800 border dark:border-white/[0.06] border-slate-700 p-1.5 overflow-hidden shadow-md">
                                        <div className="w-full h-full dark:bg-slate-950 bg-slate-900 rounded border border-white/[0.04] relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-3 dark:bg-slate-900 bg-slate-800 border-b border-white/[0.04]"></div>
                                            <div className="absolute top-4 left-1.5 w-10 h-10 dark:bg-slate-900 bg-slate-800 border border-white/[0.04]"></div>
                                            <div className="absolute top-4 left-[56px] w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30"></div>
                                            <div className="absolute top-4 right-1.5 w-12 h-2 rounded bg-white/[0.04]"></div>
                                        </div>
                                    </div>
                                    <p className="text-[9.5px] font-medium dark:text-white text-slate-200 text-center">Dark</p>
                                </div>
                            </div>
                        </div>

                        {/* Accent Color Card */}
                        <div className="dark:bg-white/[0.02] bg-white/70 backdrop-blur-xl border dark:border-white/[0.06] border-slate-200 rounded-xl p-3 space-y-3">
                            <h3 className="text-[12px] font-bold dark:text-white text-slate-900">Accent Color</h3>
                            <div className="flex flex-wrap gap-2.5">
                                {accentColors.map((color) => (
                                    <button
                                        key={color.name}
                                        onClick={() => setSelectedAccent(color.name)}
                                        className="flex flex-col items-center gap-1.5 group"
                                    >
                                        <div className={cn(
                                            "size-7 rounded-lg flex items-center justify-center transition-all duration-300 relative",
                                            color.color,
                                            selectedAccent === color.name ? "ring-2 ring-indigo-500/40 ring-offset-1 dark:ring-offset-[#0E1321] scale-105" : "opacity-80 hover:opacity-100 hover:scale-110"
                                        )}>
                                            {selectedAccent === color.name && <Check className="size-3.5 text-white drop-shadow-md" />}
                                        </div>
                                        <span className={cn(
                                            "text-[9px] font-medium transition-colors",
                                            selectedAccent === color.name ? "dark:text-white text-slate-900" : "dark:text-slate-400 text-slate-600"
                                        )}>{color.name}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[9.5px] text-slate-600 dark:text-slate-400">Accent color affects buttons and highlights.</p>
                        </div>

                        {/* UI Preferences Card */}
                        <div className="dark:bg-white/[0.02] bg-white/70 backdrop-blur-xl border dark:border-white/[0.06] border-slate-200 rounded-xl p-3 space-y-3">
                            <h3 className="text-[12px] font-bold dark:text-white text-slate-900">UI Preferences</h3>
                            <div className="space-y-2">
                                {[
                                    { id: "compactSidebar", label: "Compact sidebar" },
                                    { id: "showConfidence", label: "Show confidence badges" },
                                    { id: "reduceMotion", label: "Reduce motion" },
                                    { id: "highContrast", label: "High contrast mode" },
                                ].map((pref) => (
                                    <div key={pref.id} className="flex items-center justify-between group py-0.5">
                                        <div className="flex items-center gap-2">
                                            <div className="scale-[0.65] origin-left">
                                                <Switch 
                                                    checked={uiPrefs[pref.id as keyof typeof uiPrefs]} 
                                                    onCheckedChange={(val) => setUiPrefs(prev => ({ ...prev, [pref.id]: val }))}
                                                />
                                            </div>
                                            <span className="text-[10px] dark:text-slate-300 text-slate-700 group-hover:dark:text-white group-hover:text-slate-900 transition-colors -ml-2.5">{pref.label}</span>
                                        </div>
                                        <span className={cn(
                                            "text-[8.5px] font-bold tracking-widest uppercase opacity-60 transition-opacity",
                                            uiPrefs[pref.id as keyof typeof uiPrefs] ? "text-indigo-600 dark:text-indigo-400" : "dark:text-slate-400 text-slate-500"
                                        )}>
                                            — {uiPrefs[pref.id as keyof typeof uiPrefs] ? "On" : "Off"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Security Card — session controls. The topbar's Sign
                            Out ends this device only; ending every session
                            everywhere lives here, behind a confirmation. */}
                        <div className="dark:bg-white/[0.02] bg-white/70 backdrop-blur-xl border dark:border-white/[0.06] border-slate-200 rounded-xl p-3 space-y-3">
                            <h3 className="text-[12px] font-bold dark:text-white text-slate-900">Security</h3>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0 space-y-0.5">
                                    <p className="text-[10px] font-medium dark:text-slate-300 text-slate-700">Sign out from all devices</p>
                                    <p className="text-[9.5px] text-slate-600 dark:text-slate-400">Ends every active session, including this one.</p>
                                </div>
                                <Button
                                    onClick={() => setSignOutAllOpen(true)}
                                    disabled={signOutAllDone}
                                    variant="outline"
                                    className="h-7 px-3 rounded-md border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 font-bold text-[10px] shrink-0"
                                >
                                    <ShieldCheck className="size-3 mr-1.5" />
                                    Sign out from all devices
                                </Button>
                            </div>
                            {signOutAllDone && (
                                <p role="status" className="flex items-center gap-1.5 text-[9.5px] font-medium text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="size-3 shrink-0" />
                                    Signed out on every device. Taking you to sign in…
                                </p>
                            )}
                        </div>
                    </div>
                    )}
                </div>
            </div>

            {/* Failures are reported inside the dialog, which stays open so the
                action can be retried. */}
            <SignOutDialog
                open={signOutAllOpen}
                onOpenChange={setSignOutAllOpen}
                scope="global"
                onConfirm={handleSignOutEverywhere}
            />

            {/* Footer Navigation Bar — theme preferences only: the
                Notification Settings card saves itself, and a second
                "Save Changes" beside it would be ambiguous. */}
            {panel === "theme" && (
            <div className="absolute bottom-0 left-0 right-0 h-14 dark:bg-[#070B14]/80 bg-white/80 backdrop-blur-md border-t dark:border-white/[0.06] border-slate-200 flex items-center justify-center z-40 px-4 rounded-b-xl">
                <div className="w-full flex items-center justify-between">
                    <button className="flex items-center gap-1.5 text-[10px] font-medium dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 transition-colors group">
                        <RotateCcw className="size-3 group-hover:rotate-[-45deg] transition-transform duration-300" />
                        Reset to defaults
                    </button>
                    <Button 
                        onClick={handleSave}
                        disabled={saving}
                        className="h-7 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-all min-w-[120px]"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>
            )}

            {/* Success Notification */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute bottom-16 right-4 z-50 dark:bg-[#101928] bg-white border border-emerald-500/20 rounded-lg px-3 py-2 shadow-xl flex items-center gap-2"
                    >
                        <div className="h-4 w-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="size-2.5 text-emerald-500" />
                        </div>
                        <span className="text-[10px] font-bold dark:text-white text-slate-900 tracking-tight">Saved: <span className="dark:text-slate-400 text-slate-500 font-medium">Theme updated</span></span>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}
