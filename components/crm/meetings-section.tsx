"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CalendarDays, ExternalLink, Loader2, Video } from "lucide-react";
import type { CalendarEventDTO } from "@/models/calendar-integration";

type SelectedMeeting = {
    title: string;
    url: string;
    start?: string;
    end?: string;
    attendees?: number;
};

function safeMeetUrl(value: string | null | undefined) {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === "meet.google.com" ? url.toString() : null;
    } catch {
        return null;
    }
}

function formatMeetingTime(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
          });
}

function toSelectedMeeting(event: CalendarEventDTO): SelectedMeeting | null {
    const url = safeMeetUrl(event.meetingUrl);
    if (!url) return null;
    return {
        title: event.title,
        url,
        start: event.start,
        end: event.end,
        attendees: event.attendees.length,
    };
}

export function MeetingsSection() {
    const [selected, setSelected] = useState<SelectedMeeting | null>(null);
    const [events, setEvents] = useState<CalendarEventDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const url = safeMeetUrl(params.get("meetingUrl"));
        if (url) {
            setSelected({ title: params.get("title")?.slice(0, 160) || "Google Meet room", url });
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const from = new Date();
        const to = new Date(from.getTime() + 90 * 24 * 60 * 60 * 1000);
        const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), limit: "100" });

        fetch(`/api/integrations/calendar/google/events?${query.toString()}`, { cache: "no-store" })
            .then(async (response) => {
                const body = (await response.json().catch(() => null)) as
                    | { events?: CalendarEventDTO[]; error?: { message?: string } }
                    | null;
                if (!response.ok) throw new Error(body?.error?.message ?? "Could not load Google Calendar meetings.");
                if (!cancelled) setEvents(body?.events ?? []);
            })
            .catch((loadError: unknown) => {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : "Could not load Google Calendar meetings.");
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const meetings = events.map(toSelectedMeeting).filter((event): event is SelectedMeeting => Boolean(event));

    return (
        <section className="mx-auto w-full max-w-5xl space-y-5 pb-8">
            <Link
                href="/app/integrations"
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#111B2E]"
            >
                <ArrowLeft className="size-4" />
                Back to Integrations
            </Link>

            <header className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Video className="size-5" />
                </span>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Meetings</p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Google Meet</h1>
                    <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                        Review your meeting details here, then choose when to join the call.
                    </p>
                </div>
            </header>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
                <div className="space-y-4">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#0B1220] sm:p-6">
                        {selected ? (
                            <>
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Selected meeting</p>
                                        <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{selected.title}</h2>
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                        <Video className="size-3.5" /> Google Meet
                                    </span>
                                </div>

                                {selected.start && (
                                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                                        <span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-slate-400" />{formatMeetingTime(selected.start)}</span>
                                        {selected.end && <span>Ends {formatMeetingTime(selected.end)}</span>}
                                        {selected.attendees !== undefined && <span>{selected.attendees} attendee{selected.attendees === 1 ? "" : "s"}</span>}
                                    </div>
                                )}

                                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/[0.08] dark:bg-[#111B2E]">
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Meeting link</p>
                                    <p className="mt-1 break-all text-sm font-medium text-slate-800 dark:text-slate-200">{selected.url}</p>
                                </div>

                                <a
                                    href={selected.url}
                                    className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                                >
                                    Join Meeting <ExternalLink className="size-4" />
                                </a>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Joining navigates this tab to Google Meet.</p>
                            </>
                        ) : (
                            <div className="py-5 text-center sm:py-8">
                                <Video className="mx-auto size-8 text-slate-300 dark:text-slate-600" />
                                <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">Select a Google Meet event</h2>
                                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
                                    Calendar events that contain a Google Meet conference link will appear below.
                                </p>
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/5 sm:p-5">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
                            <div>
                                <h2 className="text-sm font-bold text-amber-950 dark:text-amber-100">The live call can’t be embedded here</h2>
                                <p className="mt-1 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                                    Google does not provide a supported way to place its live Meet interface inside a third-party CRM iframe. This page shows the meeting details and link; Join Meeting takes you to Google Meet in this same tab. Google’s Meet add-on iframe works in the opposite direction: it places an app inside Meet.
                                </p>
                                <a href="https://developers.google.com/workspace/meet/add-ons/guides/overview" className="mt-2 inline-flex text-xs font-semibold text-amber-900 underline underline-offset-2 dark:text-amber-200">
                                    Google Meet add-on documentation
                                </a>
                            </div>
                        </div>
                    </section>
                </div>

                <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#0B1220]">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <h2 className="text-base font-bold text-slate-950 dark:text-white">Upcoming Meet events</h2>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">From your connected Google Calendar</p>
                        </div>
                        <CalendarDays className="size-5 text-indigo-500" />
                    </div>

                    {loading ? (
                        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Loader2 className="size-4 animate-spin" />Loading calendar…</div>
                    ) : error ? (
                        <div role="status" className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-[#111B2E] dark:text-slate-300">
                            {error} <Link href="/app/integrations" className="font-semibold text-indigo-600 underline dark:text-indigo-300">Check Calendar Sync</Link>
                        </div>
                    ) : meetings.length ? (
                        <ul className="mt-4 space-y-2">
                            {meetings.map((meeting) => (
                                <li key={`${meeting.url}-${meeting.start ?? ""}`}>
                                    <button
                                        type="button"
                                        onClick={() => setSelected(meeting)}
                                        aria-pressed={selected?.url === meeting.url}
                                        className={`w-full rounded-xl border p-3 text-left transition-colors ${selected?.url === meeting.url ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10" : "border-slate-200 hover:bg-slate-50 dark:border-white/[0.08] dark:hover:bg-[#111B2E]"}`}
                                    >
                                        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{meeting.title}</span>
                                        {meeting.start && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{formatMeetingTime(meeting.start)}</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-600 dark:bg-[#111B2E] dark:text-slate-300">
                            No upcoming Google Calendar events with Meet links were found in the next 90 days.
                        </p>
                    )}
                </aside>
            </div>
        </section>
    );
}
