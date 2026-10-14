import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Calendar,
    Mail,
    Share2,
    Video,
    X,
    Check,
    AlertCircle,
    CheckCircle2,
    Loader2,
    LayoutGrid,
    FileText,
    Cable,
    HardDrive,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { CALENDAR_PROVIDER_META, type CalendarProvider } from "@/lib/integrations/calendar/providers";
import { calendarErrorMessage, parseCalendarReturn } from "@/lib/integrations/calendar/errors";
import type {
    CalendarConnectionDTO,
    CalendarEventDTO,
    CalendarStatusResponse,
} from "@/models/calendar-integration";
import { WEBHOOK_EVENTS, type WebhookEvent, type WebhookListResponse } from "@/models/webhook";
import { getSocialProfileLink } from "@/lib/integrations/social-profiles";

type Category = "all" | "video" | "social" | "email" | "calendar" | "forms" | "webhooks" | "storage";

const CATEGORY_PILLS: { key: Category; label: string }[] = [
    { key: "all", label: "All" },
    { key: "video", label: "Video Meetings" },
    { key: "social", label: "Social Media" },
    { key: "email", label: "Email Configuration" },
    { key: "calendar", label: "Calendar" },
    { key: "forms", label: "CRM Forms" },
    { key: "webhooks", label: "Webhooks" },
    { key: "storage", label: "File Storage" },
];

const CATEGORY_ICONS: Record<Category, LucideIcon> = {
    all: LayoutGrid,
    video: Video,
    social: Share2,
    email: Mail,
    calendar: Calendar,
    forms: FileText,
    webhooks: Cable,
    storage: HardDrive,
};

const TILE_CATEGORY: Record<string, Category | null> = {
    calendar: "calendar",
    video: "video",
    social: "social",
    email: "email",
    webhooks: "webhooks",
    forms: "forms",
    storage: "storage",
};

const SOCIAL_PROVIDERS = ["LinkedIn", "Facebook", "Instagram", "X (Twitter)"];
const EMAIL_PROVIDERS = ["Outlook Mail", "Gmail", "Yahoo Mail", "Microsoft 365"];
const VIDEO_PROVIDERS = ["Zoom", "Google Meet", "Microsoft Teams"];
const CALENDAR_PROVIDERS = ["Google Calendar", "Microsoft 365", "Outlook"];

function ProviderMark({ provider, size = "small" }: { provider: string; size?: "small" | "large" }) {
    const sizeClass = size === "large" ? "size-8" : "size-4";
    const common = { className: `${sizeClass} shrink-0`, viewBox: "0 0 24 24", "aria-hidden": true as const };
    const logo = (() => {
        switch (provider) {
            case "Zoom":
                return <svg {...common}><rect x="1" y="4" width="22" height="16" rx="5" fill="#2D8CFF"/><path d="M5.5 9.1h5.3a2 2 0 0 1 1.6 3.2l-3.6 4.6H5l3.8-4.9H5.5a1.45 1.45 0 1 1 0-2.9Zm9.1.3 4-2.8a1.5 1.5 0 0 1 2.4 1.2v8.4a1.5 1.5 0 0 1-2.4 1.2l-4-2.8V9.4Z" fill="white"/></svg>;
            case "Google Meet":
                return <svg {...common}><path fill="#00832D" d="M3 6.2A2.2 2.2 0 0 1 5.2 4h8.4v5.1H8.4v5.8H3z"/><path fill="#0066DA" d="M13.6 4h3.2A2.2 2.2 0 0 1 19 6.2v2.9l3-2.4v10.6l-3-2.4v2.9a2.2 2.2 0 0 1-2.2 2.2h-3.2v-5.1h2.2V9.1h-2.2z"/><path fill="#2684FC" d="M3 13.1h5.4v5.1H5.2A2.2 2.2 0 0 1 3 16z"/><path fill="#00AC47" d="M8.4 13.1h5.2v5.1H8.4z"/><path fill="#FFBA00" d="M3 9.1h5.4v4H3z"/><path fill="#EA4335" d="M8.4 9.1h5.2v4H8.4z"/></svg>;
            case "Microsoft Teams":
            case "Microsoft 365":
                return <svg {...common}><path fill="#5059C9" d="M14.5 8.3h6.2A1.3 1.3 0 0 1 22 9.6v7.1a3.3 3.3 0 0 1-6.6 0V8.3Z"/><circle cx="17.7" cy="5.2" r="2.2" fill="#7B83EB"/><path fill="#7B83EB" d="M3 7h10.7a1.6 1.6 0 0 1 1.6 1.6v9.8a1.6 1.6 0 0 1-1.6 1.6H3a1.6 1.6 0 0 1-1.6-1.6V8.6A1.6 1.6 0 0 1 3 7Z"/><path fill="white" d="M11.6 10H5v1.8h2.2v6h2.1v-6h2.3z"/></svg>;
            case "Google Calendar":
                return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="3" fill="#4285F4"/><path d="M7 2v4M17 2v4" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/><path fill="#fff" d="M7 9h10v9H7z"/><path fill="#34A853" d="M7 9h3v3H7z"/><path fill="#FBBC04" d="M14 9h3v3h-3z"/><path fill="#EA4335" d="M10 15h4v3h-4z"/></svg>;
            case "Outlook":
            case "Outlook Mail":
                return <svg {...common}><path fill="#0078D4" d="M9 4h12v16H9z"/><path fill="#28A8EA" d="M13 7h8v10h-8z"/><path fill="#0364B8" d="M2 7h11v11H2z"/><path fill="#fff" d="M7.5 9.2c-1.8 0-3 1.4-3 3.3s1.2 3.3 3 3.3 3-1.4 3-3.3-1.2-3.3-3-3.3Zm0 1.5c.8 0 1.3.7 1.3 1.8s-.5 1.8-1.3 1.8-1.3-.7-1.3-1.8.5-1.8 1.3-1.8Z"/></svg>;
            case "LinkedIn":
                return <svg {...common}><rect x="2" y="2" width="20" height="20" rx="3" fill="#0A66C2"/><path fill="white" d="M6.3 9h2.8v9H6.3zm1.4-4.1a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2ZM10.8 9h2.7v1.2h.1a3 3 0 0 1 2.7-1.5c2.9 0 3.4 1.9 3.4 4.3V18h-2.8v-4.4c0-1 0-2.4-1.5-2.4s-1.8 1.1-1.8 2.3V18h-2.8z"/></svg>;
            case "Facebook":
                return <svg {...common}><circle cx="12" cy="12" r="10" fill="#1877F2"/><path fill="white" d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.3-1.5 1.6-1.5h1.7V3.7c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2H7.3V13h2.8v8z"/></svg>;
            case "Instagram":
                return <svg {...common}><defs><linearGradient id="instagram-gradient" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse"><stop stopColor="#FFDC80"/><stop offset=".5" stopColor="#E1306C"/><stop offset="1" stopColor="#833AB4"/></linearGradient></defs><rect x="2" y="2" width="20" height="20" rx="6" fill="url(#instagram-gradient)"/><rect x="6.5" y="6.5" width="11" height="11" rx="3.5" fill="none" stroke="white" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="white" strokeWidth="1.8"/><circle cx="17.2" cy="6.9" r="1" fill="white"/></svg>;
            case "X (Twitter)":
                return <svg {...common}><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.9 5.8 22H2.6l7.3-8.4L1.8 2h6.5l4.5 6.7L18.9 2Zm-1.1 18h1.7L7.2 3.9H5.4z"/></svg>;
            case "Gmail":
                return <svg {...common}><path fill="#4285F4" d="M3 6.5v12h4V9.3z"/><path fill="#34A853" d="M17 9.3v9.2h4v-12z"/><path fill="#EA4335" d="m3 6.5 2.1-1.7L12 10l6.9-5.2L21 6.5l-9 6.8z"/><path fill="#C5221F" d="M3 18.5h4v-9.2L3 6.5z"/><path fill="#FBBC04" d="M17 9.3v9.2h4v-12z"/></svg>;
            case "Yahoo Mail":
                return <svg {...common}><path fill="#6001D2" d="M2 5h4l3.1 5.1L12.2 5h4l-5.2 8.1v5.8H7.5v-5.8L2 5Zm13.1 11.8h4v2.1h-4z"/><path fill="#6001D2" d="m16.1 5h4l-1.7 9h-3.7z"/></svg>;
            default:
                return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="5" fill="#4285F4"/><path d="m7 8 10 8M17 8 7 16" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>;
        }
    })();
    return <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">{logo}</span>;
}

function ProviderPill({ provider }: { provider: string }) {
    const profileLink = getSocialProfileLink(provider);

    if (profileLink) {
        return (
            <a
                {...profileLink}
                aria-label={`Open the PrismConnex ${provider} profile`}
                title={`Open the PrismConnex ${provider} profile`}
                onClick={(event) => event.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-medium text-slate-600 transition-colors hover:border-pink-300 hover:text-pink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300 dark:hover:text-pink-300"
            >
                <ProviderMark provider={provider} />
                {provider}
            </a>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-medium text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300">
            <ProviderMark provider={provider} />
            {provider}
        </span>
    );
}

type Banner = { tone: "success" | "error"; text: string } | null;

function formatWhen(iso: string | null) {
    if (!iso) return "—";
    const date = new Date(iso);
    return date.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function readError(res: Response) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (res.status === 401) return "Your session has expired. Sign in again to manage integrations.";
    return body?.error?.message ?? "Something went wrong. Please try again.";
}

/** Calendar status from /api/integrations/calendar — the only source of "Connected". */
function useCalendarStatus() {
    const [data, setData] = useState<CalendarStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/integrations/calendar", { cache: "no-store" });
            if (!res.ok) {
                setError(await readError(res));
                return;
            }
            setData(await res.json());
            setError(null);
        } catch {
            setError("Couldn't reach the server to load calendar connections.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { data, loading, error, refresh };
}

function StatusPill({ connection }: { connection: CalendarConnectionDTO | undefined }) {
    if (!connection) {
        return (
            <span className="inline-flex items-center rounded-full dark:bg-slate-800 bg-slate-100 px-2 py-0.5 text-[9.5px] font-medium dark:text-slate-400 text-slate-500">
                Not connected
            </span>
        );
    }
    if (connection.status === "connected") {
        return (
            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-transparent px-2 py-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
                Connected
            </span>
        );
    }
    return (
        <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-transparent px-2 py-0.5 text-[9.5px] font-bold text-amber-600 dark:text-amber-400">
            {connection.status === "expired" ? "Reconnect needed" : "Error"}
        </span>
    );
}

function formatEventTime(event: CalendarEventDTO) {
    if (event.allDay) {
        // Date-only values are calendar days, not instants — don't shift them by the local offset.
        const [y, m, d] = event.start.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "2-digit", month: "short" }) + " · All day";
    }
    return formatWhen(event.start);
}

/** Next events from the connected calendar — read live through the server, never with a browser token. */
function UpcomingEvents({ provider, refreshKey }: { provider: CalendarProvider; refreshKey: string }) {
    const [events, setEvents] = useState<CalendarEventDTO[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setEvents(null);
        setError(null);
        fetch(`/api/integrations/calendar/${provider}/events?limit=5`, { cache: "no-store" })
            .then(async (res) => {
                if (cancelled) return;
                if (!res.ok) return setError(await readError(res));
                const body = (await res.json()) as { events: CalendarEventDTO[] };
                if (!cancelled) setEvents(body.events);
            })
            .catch(() => !cancelled && setError("Couldn't reach the server to load events."));
        return () => {
            cancelled = true;
        };
    }, [provider, refreshKey]);

    if (error) return <p className="text-[10px] text-amber-700 dark:text-amber-400">{error}</p>;
    if (!events) {
        return (
            <div className="flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-slate-400">
                <Loader2 className="size-3.5 animate-spin" /> Loading events…
            </div>
        );
    }
    if (!events.length) {
        return <p className="text-[10.5px] text-slate-500 dark:text-slate-400">No events in the next 30 days.</p>;
    }
    return (
        <div className="space-y-2">
            {events.map((event) => (
                <div key={event.id} className="flex justify-between gap-3 text-[10.5px]">
                    <span className="dark:text-white text-slate-900 font-bold truncate">{event.title}</span>
                    <span className="dark:text-slate-400 text-slate-600 whitespace-nowrap">{formatEventTime(event)}</span>
                </div>
            ))}
        </div>
    );
}

function CalendarProviderDialog({
    open,
    onOpenChange,
    status,
    loading,
    loadError,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    status: CalendarStatusResponse | null;
    loading: boolean;
    loadError: string | null;
}) {
    const connectionFor = (provider: CalendarProvider) =>
        status?.connections.find((c) => c.provider === provider);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[480px] dark:bg-[#0B1220] bg-white border dark:border-[#22304A] border-slate-200 p-5">
                <DialogHeader className="mb-2">
                    <DialogTitle className="text-[14px] font-bold dark:text-white text-slate-900">
                        Connect a calendar
                    </DialogTitle>
                    <DialogDescription className="text-[11px] text-slate-500 dark:text-slate-400">
                        Choose your calendar provider. You&apos;ll sign in with the provider and approve calendar access.
                    </DialogDescription>
                </DialogHeader>

                {loadError && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-2.5 text-[10.5px] text-red-600 dark:text-red-400">
                        <AlertCircle className="size-3.5 mt-[1px] shrink-0" /> {loadError}
                    </div>
                )}
                {status?.storageError && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-2.5 text-[10.5px] text-amber-700 dark:text-amber-400">
                        <AlertCircle className="size-3.5 mt-[1px] shrink-0" /> {status.storageError}
                    </div>
                )}

                <div className="space-y-2">
                    {(Object.keys(CALENDAR_PROVIDER_META) as CalendarProvider[]).map((provider) => {
                        const meta = CALENDAR_PROVIDER_META[provider];
                        const info = status?.providers.find((p) => p.provider === provider);
                        const connection = connectionFor(provider);

                        return (
                            <div
                                key={provider}
                                className="rounded-xl border dark:border-[#22304A] border-slate-200 dark:bg-[#111B2E]/60 bg-slate-50 p-3"
                            >
                                <div className="flex items-center gap-3">
                                    <ProviderMark provider={meta.label} size="large" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px] font-bold dark:text-white text-slate-900">{meta.label}</span>
                                            {!loading && <StatusPill connection={connection} />}
                                        </div>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                            {connection?.accountEmail ?? meta.description}
                                        </p>
                                    </div>
                                    {info && !info.configured ? (
                                        // Connecting would only bounce back with not_configured.
                                        <span
                                            aria-disabled="true"
                                            className="h-7 px-3 inline-flex items-center rounded-md dark:bg-slate-800 bg-slate-200 text-[10px] font-bold dark:text-slate-400 text-slate-500 cursor-not-allowed"
                                        >
                                            Setup needed
                                        </span>
                                    ) : connection?.status === "connected" ? (
                                        <a
                                            href={`/api/integrations/calendar/${provider}/connect`}
                                            className="h-7 px-3 inline-flex items-center rounded-md dark:bg-[#16233A] bg-slate-100 hover:bg-slate-200 dark:hover:bg-[#1F2937] text-[10px] font-bold dark:text-white text-slate-700 transition-colors"
                                        >
                                            Reconnect
                                        </a>
                                    ) : (
                                        /* A real navigation: the server redirects to the provider's consent screen. */
                                        <a
                                            href={`/api/integrations/calendar/${provider}/connect`}
                                            className="h-7 px-3 inline-flex items-center rounded-md bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-colors"
                                        >
                                            {connection ? "Reconnect" : "Connect"}
                                        </a>
                                    )}
                                </div>
                                {info && !info.configured && (
                                    <p className="mt-2 text-[9.5px] text-amber-700 dark:text-amber-400">
                                        Not configured on this server yet. Missing: {info.missingEnv.join(", ")}. Add
                                        {info.missingEnv.length > 1 ? " them" : " it"} to .env.local and restart the server.
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                <p className="mt-3 text-[9.5px] text-slate-500 dark:text-slate-400">
                    PrismConnex requests permission to read and manage calendar events. Tokens are encrypted and never shared with the browser.
                </p>
            </DialogContent>
        </Dialog>
    );
}

export function IntegrationsSection() {
    const [category, setCategory] = useState<Category>("all");
    const [selectedIntegration, setSelectedIntegration] = useState("calendar");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [videoProvidersOpen, setVideoProvidersOpen] = useState(false);
    const [banner, setBanner] = useState<Banner>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [webhookState, setWebhookState] = useState<WebhookListResponse | null>(null);
    const [webhookLoading, setWebhookLoading] = useState(true);
    const [webhookError, setWebhookError] = useState<string | null>(null);
    const [webhookBusy, setWebhookBusy] = useState<string | null>(null);
    const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
    const [webhookName, setWebhookName] = useState("");
    const [webhookUrl, setWebhookUrl] = useState("");
    const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>(["lead.created"]);
    const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null);
    const [secretCopied, setSecretCopied] = useState(false);
    const calendar = useCalendarStatus();

    const refreshWebhooks = useCallback(async () => {
        setWebhookLoading(true);
        try {
            const response = await fetch("/api/integrations/webhooks", { cache: "no-store" });
            if (!response.ok) {
                setWebhookError(await readError(response));
                return;
            }
            setWebhookState((await response.json()) as WebhookListResponse);
            setWebhookError(null);
        } catch {
            setWebhookError("Couldn't reach the server to load webhook endpoints.");
        } finally {
            setWebhookLoading(false);
        }
    }, []);

    useEffect(() => {
        void refreshWebhooks();
    }, [refreshWebhooks]);

    // Outcome of the OAuth round-trip, put on the URL by the callback route.
    useEffect(() => {
        const outcome = parseCalendarReturn(window.location.search);
        if (!outcome) return;

        if (outcome.kind === "connected") {
            setBanner({ tone: "success", text: `${CALENDAR_PROVIDER_META[outcome.provider].label} connected.` });
        } else {
            const label = outcome.provider ? `${CALENDAR_PROVIDER_META[outcome.provider].label}: ` : "";
            setBanner({ tone: "error", text: label + calendarErrorMessage(outcome.code) });
            setDialogOpen(true);
        }
        setCategory("calendar");
        window.history.replaceState(null, "", window.location.pathname);
    }, []);

    const connections = calendar.data?.connections ?? [];
    const healthy = connections.filter((c) => c.status === "connected");
    const primary = healthy[0] ?? connections[0];
    const show = (tile: string) => category === "all" || TILE_CATEGORY[tile] === category;

    const selectCategory = (key: Category) => {
        setCategory(key);
        if (key === "calendar") setSelectedIntegration("calendar");
        if (key === "video") setSelectedIntegration("video");
        if (key === "social") setSelectedIntegration("social");
        if (key === "email") setSelectedIntegration("email");
        if (key === "webhooks") setSelectedIntegration("webhooks");
        if (key === "forms") setSelectedIntegration("forms");
        if (key === "storage") setSelectedIntegration("storage");
    };

    const createWebhook = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setWebhookBusy("create");
        setWebhookError(null);
        try {
            const response = await fetch("/api/integrations/webhooks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: webhookName, url: webhookUrl, events: webhookEvents }),
            });
            if (!response.ok) throw new Error(await readError(response));
            const result = (await response.json()) as { signingSecret: string };
            setCreatedWebhookSecret(result.signingSecret);
            setWebhookName("");
            setWebhookUrl("");
            setWebhookEvents(["lead.created"]);
            await refreshWebhooks();
        } catch (error) {
            setWebhookError(error instanceof Error ? error.message : "Couldn't create the webhook endpoint.");
        } finally {
            setWebhookBusy(null);
        }
    };

    const updateWebhook = async (id: string, values: { isActive: boolean }) => {
        setWebhookBusy(id);
        setWebhookError(null);
        try {
            const response = await fetch(`/api/integrations/webhooks/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            if (!response.ok) throw new Error(await readError(response));
            await refreshWebhooks();
        } catch (error) {
            setWebhookError(error instanceof Error ? error.message : "Couldn't update the webhook endpoint.");
        } finally {
            setWebhookBusy(null);
        }
    };

    const testWebhook = async (id: string) => {
        setWebhookBusy(`test:${id}`);
        setWebhookError(null);
        try {
            const response = await fetch(`/api/integrations/webhooks/${id}/test`, { method: "POST" });
            if (!response.ok) throw new Error(await readError(response));
            await refreshWebhooks();
        } catch (error) {
            setWebhookError(error instanceof Error ? error.message : "Couldn't send a test delivery.");
        } finally {
            setWebhookBusy(null);
        }
    };

    const deleteWebhook = async (id: string) => {
        setWebhookBusy(`delete:${id}`);
        setWebhookError(null);
        try {
            const response = await fetch(`/api/integrations/webhooks/${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error(await readError(response));
            await refreshWebhooks();
        } catch (error) {
            setWebhookError(error instanceof Error ? error.message : "Couldn't remove the webhook endpoint.");
        } finally {
            setWebhookBusy(null);
        }
    };

    const runAction = async (provider: CalendarProvider, action: "check" | "disconnect") => {
        setBusy(`${action}:${provider}`);
        try {
            const res = await fetch(
                action === "check"
                    ? `/api/integrations/calendar/${provider}/check`
                    : `/api/integrations/calendar/${provider}`,
                { method: action === "check" ? "POST" : "DELETE" }
            );
            const label = CALENDAR_PROVIDER_META[provider].label;
            if (res.ok) {
                setBanner({
                    tone: "success",
                    text: action === "check" ? `${label} is working.` : `${label} disconnected.`,
                });
            } else {
                setBanner({ tone: "error", text: `${label}: ${await readError(res)}` });
            }
        } catch {
            setBanner({ tone: "error", text: "Couldn't reach the server. Please try again." });
        } finally {
            setBusy(null);
            await calendar.refresh();
        }
    };

    return (
        <div className="space-y-4 max-w-[1200px] mx-auto pb-14">

            {/* Top Navigation & Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col gap-4 pb-3 border-b dark:border-white/[0.06] border-slate-200"
            >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-0.5">
                        <h1 className="text-base font-bold dark:text-white text-slate-900 tracking-tight">Integrations</h1>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">Connect your communication, calendar, and CRM tools</p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto pt-2 sm:pt-0">
                        <button className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-white/[0.04] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                            View Logs
                        </button>
                        <button className="h-7 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-colors">
                            Add Integration
                        </button>
                    </div>
                </div>

                <div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {CATEGORY_PILLS.map((pill) => {
                            const Icon = CATEGORY_ICONS[pill.key];
                            return (
                                <button
                                    key={pill.key}
                                    type="button"
                                    onClick={() => selectCategory(pill.key)}
                                    aria-pressed={category === pill.key}
                                    className={cn(
                                        "inline-flex h-6 items-center gap-1.5 rounded-full px-3 text-[10px] font-bold transition-colors",
                                        category === pill.key
                                            ? "bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                                            : "border dark:border-[#22304A] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] dark:text-[#9CA3AF] text-slate-600 hover:text-slate-900 dark:hover:text-white"
                                    )}
                                >
                                    <Icon aria-hidden="true" className="size-3" />
                                    {pill.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </motion.div>

            {banner && (
                <div
                    role={banner.tone === "error" ? "alert" : "status"}
                    className={cn(
                        "flex items-start gap-2 rounded-lg border p-2.5 text-[11px]",
                        banner.tone === "success"
                            ? "border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                            : "border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 text-red-600 dark:text-red-400"
                    )}
                >
                    {banner.tone === "success" ? (
                        <CheckCircle2 className="size-3.5 mt-[1px] shrink-0" />
                    ) : (
                        <AlertCircle className="size-3.5 mt-[1px] shrink-0" />
                    )}
                    <span className="flex-1">{banner.text}</span>
                    <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
                        <X className="size-3.5" />
                    </button>
                </div>
            )}

            {/* Main Split-Pane Layout */}
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">

                {/* LEFT PANE: GRID & SUMMARY */}
                <div className="space-y-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="grid grid-cols-1 gap-3 md:grid-cols-2"
                    >
                        {/* Video meetings stay first, followed by the requested integration groups. */}
                        {show("video") && (
                            <button type="button" aria-pressed={selectedIntegration === "video"} onClick={() => { setSelectedIntegration("video"); setVideoProvidersOpen(true); }} className={cn("flex w-full cursor-pointer flex-col items-start gap-3 rounded-xl border p-3 text-left shadow-sm transition-colors", selectedIntegration === "video" ? "border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-[#16233A]/40" : "dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E]")}>
                                <div className="flex items-start gap-2.5">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><Video className="size-4" /></span>
                                    <div className="space-y-0.5">
                                        <h3 className="text-[13px] font-bold dark:text-white text-slate-900">Video Meetings</h3>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Create meeting links with your preferred platform</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {VIDEO_PROVIDERS.map((provider) => <ProviderPill key={provider} provider={provider} />)}
                                </div>
                                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[9.5px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Setup needed</span>
                            </button>
                        )}

                        {show("social") && (
                            <div className={cn("rounded-xl border p-3 text-left transition-colors flex flex-col items-start gap-3 shadow-sm", selectedIntegration === "social" ? "border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-[#16233A]/40" : "dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E]")}>
                                <button type="button" aria-pressed={selectedIntegration === "social"} onClick={() => setSelectedIntegration("social")} className="flex w-full items-start gap-2.5 text-left">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><Share2 className="size-4" /></span>
                                    <div className="space-y-0.5"><h3 className="text-[13px] font-bold dark:text-white text-slate-900">Social Media</h3><p className="text-[10px] text-slate-500 dark:text-slate-400">Connect social pages and messaging channels</p></div>
                                </button>
                                <div className="flex flex-wrap gap-1.5">{SOCIAL_PROVIDERS.map((provider) => <ProviderPill key={provider} provider={provider} />)}</div>
                                <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[9.5px] font-semibold text-amber-700 dark:text-amber-400">Setup needed</span>
                            </div>
                        )}

                        {show("email") && (
                            <button type="button" aria-pressed={selectedIntegration === "email"} onClick={() => setSelectedIntegration("email")} className={cn("rounded-xl border p-3 text-left transition-colors flex flex-col items-start gap-3 shadow-sm", selectedIntegration === "email" ? "border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-[#16233A]/40" : "dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E]")}>
                                <div className="flex items-start gap-2.5">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300"><Mail className="size-4" /></span>
                                    <div className="space-y-0.5"><h3 className="text-[13px] font-bold dark:text-white text-slate-900">Email Configuration</h3><p className="text-[10px] text-slate-500 dark:text-slate-400">Connect inboxes for CRM email workflows</p></div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">{EMAIL_PROVIDERS.map((provider) => <ProviderPill key={provider} provider={provider} />)}</div>
                                <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[9.5px] font-semibold text-amber-700 dark:text-amber-400">Setup needed</span>
                            </button>
                        )}

                        {/* Calendar Sync */}
                        {show("calendar") && (
                            <div
                                role="button"
                                tabIndex={0}
                                aria-pressed={selectedIntegration === "calendar"}
                                onClick={() => setSelectedIntegration("calendar")}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setSelectedIntegration("calendar");
                                    }
                                }}
                                className={cn("rounded-xl border p-3 transition-colors cursor-pointer relative shadow-sm text-left flex flex-col items-start gap-3", selectedIntegration === "calendar" ? "dark:border-indigo-500/30 border-indigo-200 dark:bg-[#16233A]/40 bg-indigo-50 hover:bg-indigo-100 dark:hover:bg-[#16233A]" : "dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E]")}
                            >
                                <div className="flex items-start gap-2.5">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300"><Calendar className="size-4" /></span>
                                    <div className="space-y-0.5">
                                        <h3 className="text-[13px] font-bold dark:text-white text-slate-900">Calendar Sync</h3>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Sync CRM activity with your calendar</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {CALENDAR_PROVIDERS.map((provider) => <ProviderPill key={provider} provider={provider} />)}
                                </div>
                                {calendar.loading && !calendar.data ? (
                                    <span className="inline-flex items-center gap-1 text-[9.5px] text-slate-500 dark:text-slate-400">
                                        <Loader2 className="size-3 animate-spin" /> Checking…
                                    </span>
                                ) : (
                                    <StatusPill connection={primary} />
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDialogOpen(true);
                                    }}
                                    className="w-full mt-1.5 h-7 rounded-md border dark:border-[#374151] border-slate-300 hover:border-slate-400 dark:hover:border-[#4B5563] dark:bg-[#0B1220] bg-white text-[10px] font-bold dark:text-white text-slate-700 transition-all shadow-sm"
                                >
                                    {connections.length ? "Manage calendars" : "Connect calendar"}
                                </button>
                            </div>
                        )}

                        {/* CRM Forms */}
                        {show("forms") && (
                        <button type="button" aria-pressed={selectedIntegration === "forms"} onClick={() => setSelectedIntegration("forms")} className={cn("rounded-xl border p-3 text-left transition-colors flex flex-col items-start gap-3 shadow-sm", selectedIntegration === "forms" ? "border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-[#16233A]/40" : "dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E]")}>
                            <div className="flex items-start gap-2.5">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"><FileText className="size-4" /></span>
                                <div className="space-y-0.5">
                                    <h3 className="text-[13px] font-bold dark:text-white text-slate-900">CRM Forms</h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Capture website leads</p>
                                </div>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[9.5px] font-semibold text-amber-700 dark:text-amber-400">
                                Setup needed
                            </span>
                            <span className="w-full mt-1.5 h-7 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50 text-center pt-1.5 text-[10px] font-bold dark:text-slate-300 text-slate-700">View setup</span>
                        </button>
                        )}

                        {/* Webhooks */}
                        {show("webhooks") && (
                        <button type="button" aria-pressed={selectedIntegration === "webhooks"} onClick={() => setSelectedIntegration("webhooks")} className={cn("rounded-xl border p-3 text-left transition-colors flex flex-col items-start gap-3 shadow-sm", selectedIntegration === "webhooks" ? "border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-[#16233A]/40" : "dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E]")}>
                            <div className="flex items-start gap-2.5">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300"><Cable className="size-4" /></span>
                                <div className="space-y-0.5">
                                    <h3 className="text-[13px] font-bold dark:text-white text-slate-900">Webhooks</h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Automate external actions</p>
                                </div>
                            </div>
                            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold", webhookState?.schemaReady && webhookState.endpoints.some((endpoint) => endpoint.isActive) ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400")}>
                                {webhookLoading ? "Checking…" : webhookState?.schemaReady === false ? "Migration needed" : webhookState?.endpoints.some((endpoint) => endpoint.isActive) ? "Configured" : "Setup needed"}
                            </span>
                            <span className="w-full mt-1.5 h-7 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50 text-center pt-1.5 text-[10px] font-bold dark:text-slate-300 text-slate-700">Manage webhooks</span>
                        </button>
                        )}

                        {/* File Storage */}
                        {show("storage") && (
                        <button type="button" aria-pressed={selectedIntegration === "storage"} onClick={() => setSelectedIntegration("storage")} className={cn("rounded-xl border p-3 text-left transition-colors flex flex-col items-start gap-3 shadow-sm", selectedIntegration === "storage" ? "border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-[#16233A]/40" : "dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E]")}>
                            <div className="flex items-start gap-2.5">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300"><HardDrive className="size-4" /></span>
                                <div className="space-y-0.5">
                                    <h3 className="text-[13px] font-bold dark:text-white text-slate-900">File Storage</h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Store exports and attachments</p>
                                </div>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[9.5px] font-semibold text-amber-700 dark:text-amber-400">
                                Setup needed
                            </span>
                            <span className="w-full mt-1.5 h-7 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50 text-center pt-1.5 text-[10px] font-bold dark:text-slate-300 text-slate-700">View setup</span>
                        </button>
                        )}
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-slate-50 p-4 max-w-[400px]"
                    >
                         <h3 className="text-[11px] font-bold dark:text-white text-slate-900 mb-3 tracking-wide uppercase">Connected Integrations</h3>
                         {healthy.length || webhookState?.endpoints.some((endpoint) => endpoint.isActive) ? (
                             <div className="space-y-2">
                                 {healthy.map((connection) => (
                                     <div key={connection.provider} className="flex justify-between items-center text-[10px]">
                                         <span className="dark:text-white text-slate-800 font-bold">Calendar Sync</span>
                                         <span className="inline-flex items-center gap-1.5 dark:text-slate-300 text-slate-600"><ProviderMark provider={CALENDAR_PROVIDER_META[connection.provider].label} />{CALENDAR_PROVIDER_META[connection.provider].label}</span>
                                     </div>
                                 ))}
                                 {webhookState?.endpoints.filter((endpoint) => endpoint.isActive).map((endpoint) => (
                                     <div key={endpoint.id} className="flex justify-between items-center text-[10px]">
                                         <span className="dark:text-white text-slate-800 font-bold">Webhook</span>
                                         <span className="max-w-[180px] truncate dark:text-slate-300 text-slate-600">{endpoint.name}</span>
                                     </div>
                                 ))}
                             </div>
                         ) : <p className="text-[10px] text-slate-500 dark:text-slate-400">No integrations connected yet.</p>}
                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white h-full shadow-sm flex flex-col pt-2 sm:pt-0"
                >
                    {/* Inspector Header */}
                    <div className="p-4 border-b dark:border-white/[0.06] border-slate-200 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <h2 className="text-[14px] font-bold dark:text-white text-slate-900">{{ calendar: "Calendar Sync", video: "Video Meetings", social: "Social Media", email: "Email Configuration", webhooks: "Webhooks", forms: "CRM Forms", storage: "File Storage" }[selectedIntegration] ?? "Calendar Sync"}</h2>
                            {selectedIntegration === "calendar" && !calendar.loading ? <StatusPill connection={primary} /> : selectedIntegration === "webhooks" ? (
                                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[9.5px] font-semibold", webhookState?.schemaReady && webhookState.endpoints.some((endpoint) => endpoint.isActive) ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400")}>
                                    {webhookLoading ? "Checking…" : webhookState?.schemaReady === false ? "Migration needed" : webhookState?.endpoints.some((endpoint) => endpoint.isActive) ? "Configured" : "Setup needed"}
                                </span>
                            ) : selectedIntegration !== "calendar" && <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[9.5px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Setup needed</span>}
                         </div>
                    </div>

                    <div className="p-4 overflow-y-auto space-y-6">
                        {selectedIntegration === "webhooks" ? (
                            <div className="space-y-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Endpoint configuration</div>
                                        <p className="mt-1 text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-300">Subscribe an HTTPS endpoint to CRM events. Requests include an HMAC signature in <code>X-PrismConnex-Signature</code>.</p>
                                    </div>
                                    <button type="button" disabled={!webhookState?.schemaReady || !webhookState.canManage || !webhookState.signingConfigured} onClick={() => { setCreatedWebhookSecret(null); setSecretCopied(false); setWebhookDialogOpen(true); }} className="h-8 shrink-0 rounded-md bg-indigo-600 px-3 text-[10px] font-bold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">Add endpoint</button>
                                </div>

                                {webhookState?.schemaReady === false && !webhookLoading && (
                                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[10.5px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300">Apply the new <code>workspace-webhooks</code> database migration before creating endpoints. It adds workspace-scoped endpoint and delivery tables without changing existing CRM rows.</p>
                                )}
                                {webhookState?.schemaReady && !webhookState.signingConfigured && !webhookLoading && (
                                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[10.5px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300">Add <code>INTEGRATIONS_ENCRYPTION_KEY</code> (at least 32 characters) to the server environment and restart the app to protect webhook signing secrets.</p>
                                )}
                                {webhookError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[10.5px] text-red-700 dark:border-red-500/20 dark:bg-red-500/5 dark:text-red-400">{webhookError}</p>}
                                {webhookLoading ? (
                                    <div className="flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-slate-400"><Loader2 className="size-3.5 animate-spin" /> Loading webhook configuration…</div>
                                ) : webhookState?.endpoints.length ? (
                                    <div className="space-y-3">
                                        {webhookState.endpoints.map((endpoint) => (
                                            <div key={endpoint.id} className="rounded-lg border border-slate-200 p-3 dark:border-white/[0.08]">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-[11px] font-bold text-slate-900 dark:text-white">{endpoint.name}</span>
                                                            <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold", endpoint.isActive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}>{endpoint.isActive ? "Active" : "Paused"}</span>
                                                        </div>
                                                        <p className="mt-1 break-all text-[10px] text-slate-500 dark:text-slate-400">{endpoint.url}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-1">{endpoint.events.map((eventName) => <span key={eventName} className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{eventName}</span>)}</div>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <button type="button" disabled={!webhookState.canManage || webhookBusy !== null} onClick={() => void testWebhook(endpoint.id)} className="h-7 rounded-md border border-slate-200 px-2.5 text-[9.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.04]">{webhookBusy === `test:${endpoint.id}` ? "Sending…" : "Send test"}</button>
                                                    <button type="button" disabled={!webhookState.canManage || webhookBusy !== null} onClick={() => void updateWebhook(endpoint.id, { isActive: !endpoint.isActive })} className="h-7 rounded-md border border-slate-200 px-2.5 text-[9.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.04]">{webhookBusy === endpoint.id ? "Saving…" : endpoint.isActive ? "Pause" : "Activate"}</button>
                                                    <button type="button" disabled={!webhookState.canManage || webhookBusy !== null} onClick={() => void deleteWebhook(endpoint.id)} className="h-7 rounded-md border border-red-200 px-2.5 text-[9.5px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/5">{webhookBusy === `delete:${endpoint.id}` ? "Removing…" : "Remove"}</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center dark:border-white/[0.1]">
                                        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">No webhook endpoints yet</p>
                                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Add an HTTPS endpoint and select which CRM events should trigger it.</p>
                                    </div>
                                )}

                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recent deliveries</div>
                                        <button type="button" onClick={() => void refreshWebhooks()} className="text-[9.5px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Refresh</button>
                                    </div>
                                    {webhookState?.deliveries.length ? (
                                        <div className="space-y-2">
                                            {webhookState.deliveries.slice(0, 8).map((delivery) => (
                                                <div key={delivery.id} className="flex items-start justify-between gap-2 text-[9.5px]">
                                                    <div className="min-w-0">
                                                        <div className="truncate font-semibold text-slate-800 dark:text-slate-200">{delivery.event} · {delivery.endpointName}</div>
                                                        <div className="text-slate-500 dark:text-slate-400">{formatWhen(delivery.createdAt)}{delivery.statusCode ? ` · HTTP ${delivery.statusCode}` : ""}{delivery.errorMessage ? ` · ${delivery.errorMessage}` : ""}</div>
                                                    </div>
                                                    <span className={cn("shrink-0 font-bold", delivery.status === "SUCCEEDED" ? "text-emerald-600 dark:text-emerald-400" : delivery.status === "FAILED" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")}>{delivery.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-[10px] text-slate-500 dark:text-slate-400">Delivery attempts will appear here.</p>}
                                </div>
                            </div>
                        ) : selectedIntegration !== "calendar" ? (
                            <div className="space-y-4">
                                <div>
                                    <div className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 tracking-wide uppercase mb-2">Status</div>
                                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                                        {selectedIntegration === "social" || selectedIntegration === "email"
                                            ? "These providers are listed for planning. Their secure authorization and data flows still need to be configured."
                                            : "No provider is connected for this integration yet, and its setup flow is not available."}
                                    </p>
                                </div>
                                {(selectedIntegration === "social" || selectedIntegration === "email") && (
                                    <div>
                                        <div className="mb-2 text-[9.5px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Available providers</div>
                                        <div className="space-y-2">
                                            {(selectedIntegration === "social" ? SOCIAL_PROVIDERS : EMAIL_PROVIDERS).map((provider) => (
                                                <div key={provider} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 dark:border-white/[0.08]">
                                                    {getSocialProfileLink(provider) ? (
                                                        <a
                                                            {...getSocialProfileLink(provider)!}
                                                            aria-label={`Open the PrismConnex ${provider} profile`}
                                                            className="inline-flex items-center gap-2 text-[10.5px] font-semibold text-slate-800 hover:text-pink-700 dark:text-slate-200 dark:hover:text-pink-300"
                                                        ><ProviderMark provider={provider} />{provider}</a>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold text-slate-800 dark:text-slate-200"><ProviderMark provider={provider} />{provider}</span>
                                                    )}
                                                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Setup needed</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <div className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 tracking-wide uppercase mb-2">Next step</div>
                                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                                        {`Configure the required OAuth or API credentials before connecting ${({ video: "a meeting provider", social: "a social platform", email: "an email account", webhooks: "a webhook endpoint", forms: "a lead capture form", storage: "a file storage provider" } as Record<string, string>)[selectedIntegration] ?? "this provider"}.`}
                                    </p>
                                </div>
                            </div>
                        ) : <>

                        {/* 1) CONNECTIONS block */}
                        <div>
                            <div className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 tracking-wide uppercase mb-3">Connections</div>

                            {calendar.error && (
                                <p className="mb-3 text-[10.5px] text-red-600 dark:text-red-400">{calendar.error}</p>
                            )}
                            {calendar.data?.storageError && (
                                <p className="mb-3 text-[10.5px] text-amber-700 dark:text-amber-400">{calendar.data.storageError}</p>
                            )}

                            {calendar.loading && !calendar.data ? (
                                <div className="flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-slate-400">
                                    <Loader2 className="size-3.5 animate-spin" /> Loading…
                                </div>
                            ) : connections.length === 0 ? (
                                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mb-3">
                                    No calendar connected yet.
                                </p>
                            ) : (
                                <div className="space-y-3 mb-3">
                                    {connections.map((c) => (
                                        <div key={c.provider} className="rounded-lg border dark:border-white/[0.06] border-slate-200 p-2.5 space-y-2">
                                            <div className="flex justify-between items-center text-[10.5px]">
                                                <span className="inline-flex items-center gap-1.5 dark:text-white text-slate-900 font-bold"><ProviderMark provider={CALENDAR_PROVIDER_META[c.provider].label} />{CALENDAR_PROVIDER_META[c.provider].label}</span>
                                                <StatusPill connection={c} />
                                            </div>
                                            <div className="flex justify-between items-center text-[10.5px]">
                                                <span className="dark:text-slate-400 text-slate-600 font-medium">Account</span>
                                                <span className="dark:text-white text-slate-900 text-right max-w-[170px] truncate font-bold">{c.accountEmail ?? "—"}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10.5px]">
                                                <span className="dark:text-slate-400 text-slate-600 font-medium">Last checked</span>
                                                <span className="dark:text-white text-slate-900 text-right font-bold">{formatWhen(c.lastCheckedAt)}</span>
                                            </div>
                                            {c.lastError && (
                                                <p className="text-[9.5px] text-amber-700 dark:text-amber-400">{c.lastError}</p>
                                            )}
                                            <div className="flex gap-2">
                                                {c.status === "connected" ? (
                                                    <button
                                                        type="button"
                                                        disabled={busy !== null}
                                                        onClick={() => runAction(c.provider, "check")}
                                                        className="flex-1 h-7 rounded-md dark:bg-[#16233A] bg-slate-100 hover:bg-slate-200 dark:hover:bg-[#1F2937] text-[10px] font-bold dark:text-white text-slate-700 transition-colors disabled:opacity-50"
                                                    >
                                                        {busy === `check:${c.provider}` ? "Checking…" : "Test connection"}
                                                    </button>
                                                ) : (
                                                    <a
                                                        href={`/api/integrations/calendar/${c.provider}/connect`}
                                                        className="flex-1 h-7 inline-flex items-center justify-center rounded-md dark:bg-[#16233A] bg-slate-100 hover:bg-slate-200 dark:hover:bg-[#1F2937] text-[10px] font-bold dark:text-white text-slate-700 transition-colors"
                                                    >
                                                        Reconnect
                                                    </a>
                                                )}
                                                <button
                                                    type="button"
                                                    disabled={busy !== null}
                                                    onClick={() => runAction(c.provider, "disconnect")}
                                                    className="flex-1 h-7 rounded-md border border-red-500/20 bg-red-50 hover:bg-red-100 dark:bg-red-500/5 dark:hover:bg-red-500/10 text-[10px] font-bold text-red-600 dark:text-red-500 transition-colors disabled:opacity-50"
                                                >
                                                    {busy === `disconnect:${c.provider}` ? "Disconnecting…" : "Disconnect"}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => setDialogOpen(true)}
                                className="w-full h-7 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-colors"
                            >
                                {connections.length ? "Add another calendar" : "Connect calendar"}
                            </button>
                        </div>

                        {/* 2) UPCOMING EVENTS — proves the connection reaches the provider's API */}
                        {primary?.status === "connected" && (
                            <div>
                                <div className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 tracking-wide uppercase mb-3">
                                    Upcoming · {CALENDAR_PROVIDER_META[primary.provider].label}
                                </div>
                                <UpcomingEvents
                                    provider={primary.provider}
                                    refreshKey={`${primary.connectedAt}|${primary.lastCheckedAt ?? ""}`}
                                />
                            </div>
                        )}

                        {/* 3) PERMISSIONS block — what the connect flow actually requests */}
                        <div>
                            <div className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 tracking-wide uppercase mb-3">Permissions requested</div>
                            <div className="space-y-2.5">
                                {["List your calendars", "Read calendar events", "Create, update and delete events", "Your account email"].map((label) => (
                                    <div key={label} className="flex items-center justify-between text-[10px]">
                                        <span className="flex items-center gap-1.5 dark:text-slate-300 text-slate-700 font-medium">
                                            <Check className="size-3 text-indigo-500 dark:text-indigo-400" /> {label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        </>}
                    </div>

                    {/* Notice Block */}
                    <div className="mt-auto p-4 border-t dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50">
                        <div className="flex items-start gap-2">
                             <h4 className="text-[10px] font-bold dark:text-white text-slate-900 whitespace-nowrap">Data Notice</h4>
                             <p className="text-[10px] dark:text-slate-400 text-slate-600 leading-tight mt-[1px]">Integrations share only the data needed for the selected features.</p>
                        </div>
                    </div>
                </motion.div>

            </div>

            <CalendarProviderDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                status={calendar.data}
                loading={calendar.loading}
                loadError={calendar.error}
            />

            <Dialog open={webhookDialogOpen} onOpenChange={(open) => {
                setWebhookDialogOpen(open);
                if (!open) {
                    setCreatedWebhookSecret(null);
                    setSecretCopied(false);
                }
            }}>
                <DialogContent className="max-h-[85vh] max-w-[560px] overflow-y-auto border border-slate-200 bg-white p-5 dark:border-[#22304A] dark:bg-[#0B1220]">
                    <DialogHeader className="mb-2">
                        <DialogTitle className="text-[14px] font-bold text-slate-900 dark:text-white">Add webhook endpoint</DialogTitle>
                        <DialogDescription className="text-[11px] text-slate-500 dark:text-slate-400">PrismConnex sends signed JSON when selected events happen in this workspace.</DialogDescription>
                    </DialogHeader>
                    {createdWebhookSecret ? (
                        <div className="space-y-3">
                            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] leading-relaxed text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-300">Endpoint created. Copy and save this signing secret now; it will not be shown again.</p>
                            <code className="block break-all rounded-lg bg-slate-100 p-3 text-[11px] text-slate-900 dark:bg-[#111B2E] dark:text-white">{createdWebhookSecret}</code>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(createdWebhookSecret); setSecretCopied(true); } catch { setSecretCopied(false); } }} className="h-8 rounded-md border border-slate-200 px-3 text-[10px] font-bold text-slate-700 dark:border-white/[0.08] dark:text-slate-300">{secretCopied ? "Copied" : "Copy secret"}</button>
                                <button type="button" onClick={() => setWebhookDialogOpen(false)} className="h-8 rounded-md bg-indigo-600 px-3 text-[10px] font-bold text-white">Done</button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={createWebhook} className="space-y-4">
                            <label className="block space-y-1.5">
                                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Endpoint name</span>
                                <input required maxLength={100} value={webhookName} onChange={(event) => setWebhookName(event.target.value)} placeholder="e.g. Sales automation" className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[11px] text-slate-900 outline-none focus:border-indigo-400 dark:border-white/[0.1] dark:bg-[#111B2E] dark:text-white" />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">HTTPS endpoint URL</span>
                                <input required type="url" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://example.com/webhooks/prismconnex" className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[11px] text-slate-900 outline-none focus:border-indigo-400 dark:border-white/[0.1] dark:bg-[#111B2E] dark:text-white" />
                                <span className="block text-[9.5px] text-slate-500 dark:text-slate-400">Only public HTTPS destinations are accepted. Private and local network addresses are blocked.</span>
                            </label>
                            <fieldset className="space-y-2">
                                <legend className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Events to send</legend>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {WEBHOOK_EVENTS.filter((eventName) => eventName !== "webhook.test").map((eventName) => (
                                        <label key={eventName} className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-300">
                                            <input type="checkbox" checked={webhookEvents.includes(eventName)} onChange={(event) => setWebhookEvents((current) => event.target.checked ? [...current, eventName] : current.filter((item) => item !== eventName))} className="size-3.5 accent-indigo-600" />
                                            {eventName}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            {webhookError && <p role="alert" className="text-[10.5px] text-red-600 dark:text-red-400">{webhookError}</p>}
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" onClick={() => setWebhookDialogOpen(false)} className="h-8 rounded-md border border-slate-200 px-3 text-[10px] font-bold text-slate-700 dark:border-white/[0.08] dark:text-slate-300">Cancel</button>
                                <button type="submit" disabled={webhookBusy === "create" || webhookEvents.length === 0} className="h-8 rounded-md bg-indigo-600 px-3 text-[10px] font-bold text-white disabled:opacity-50">{webhookBusy === "create" ? "Creating…" : "Create endpoint"}</button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={videoProvidersOpen} onOpenChange={setVideoProvidersOpen}>
                <DialogContent className="max-w-[480px] border border-slate-200 bg-white p-5 dark:border-[#22304A] dark:bg-[#0B1220]">
                    <DialogHeader className="mb-2">
                        <DialogTitle className="text-[14px] font-bold text-slate-900 dark:text-white">Connect a video meeting</DialogTitle>
                            <DialogDescription className="text-[11px] text-slate-500 dark:text-slate-400">
                            Connect a provider or open your configured Google Meet room inside PrismConnex.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        {([
                            { name: "Zoom", detail: "Create Zoom meeting links", configured: false, href: null },
                            { name: "Google Meet", detail: "Open your Google Meet room", configured: true, href: `/app/meetings?meetingUrl=${encodeURIComponent("https://meet.google.com/yff-zbai-yoe")}&title=${encodeURIComponent("Google Meet room")}` },
                            { name: "Microsoft Teams", detail: "Create Teams links with a work or school account", configured: calendar.data?.providers.find((p) => p.provider === "microsoft365")?.configured ?? false, href: "/api/integrations/calendar/microsoft365/connect" },
                        ] as const).map((provider) => {
                            const calendarProvider = provider.name === "Google Meet" ? "google" : provider.name === "Microsoft Teams" ? "microsoft365" : null;
                            const connection = calendarProvider ? connections.find((item) => item.provider === calendarProvider) : undefined;
                            return (
                                <div key={provider.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#22304A] dark:bg-[#111B2E]/60">
                                    <div className="flex items-center gap-3">
                                        <ProviderMark provider={provider.name} size="large" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[12px] font-bold text-slate-900 dark:text-white">{provider.name}</span>
                                                {provider.name === "Google Meet" ? (
                                                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">Meeting ready</span>
                                                ) : connection?.status === "connected" ? <StatusPill connection={connection} /> : !provider.configured ? (
                                                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[9.5px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Setup needed</span>
                                                ) : <StatusPill connection={connection} />}
                                            </div>
                                            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{connection?.accountEmail ?? provider.detail}</p>
                                        </div>
                                        {provider.href && provider.configured ? (
                                            provider.name === "Google Meet" ? (
                                                <Link href={provider.href} className="inline-flex h-7 shrink-0 items-center rounded-md bg-indigo-600 px-3 text-[10px] font-bold text-white transition-colors hover:bg-indigo-500">
                                                    View in CRM
                                                </Link>
                                            ) : (
                                                <a href={provider.href} className="inline-flex h-7 shrink-0 items-center rounded-md bg-indigo-600 px-3 text-[10px] font-bold text-white transition-colors hover:bg-indigo-500">
                                                    {connection?.status === "connected" ? "Reconnect" : "Connect"}
                                                </a>
                                            )
                                        ) : (
                                            <span className="inline-flex h-7 shrink-0 items-center rounded-md bg-slate-200 px-3 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                Setup needed
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
