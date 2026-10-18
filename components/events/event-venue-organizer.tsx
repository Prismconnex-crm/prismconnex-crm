"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  ExternalLink,
  Globe2,
  Hotel,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
} from "lucide-react";
import type { FindShowEvent } from "@/types/find-shows";

/**
 * Venue and Organizer cards for the Location & Venue tab.
 *
 * The seed gives a venue name, a city and a country, and little else. Anything
 * richer — street address, postcode, organizer's legal name, phone, email — is
 * fetched from the event's own website the first time someone opens the event
 * and then cached server-side for a week (see /api/events/[slug]/enrichment).
 *
 * Seed values always win where they exist, because they were curated; fetched
 * values only fill blanks. A field neither source has reads "Not available"
 * with its action disabled, rather than linking somewhere that does not exist.
 */

const NOT_AVAILABLE = "Not available";

type Enrichment = {
  venueName: string | null;
  venueAddress: string | null;
  venueCity: string | null;
  venueCountry: string | null;
  venuePostcode: string | null;
  venueWebsite: string | null;
  organizerName: string | null;
  organizerLegalName: string | null;
  organizerWebsite: string | null;
  organizerAddress: string | null;
  organizerEmail: string | null;
  organizerPhone: string | null;
  sourceUrl: string | null;
};

type Payload = {
  enrichment: Enrichment | null;
  fetchedAt: string | null;
  error: string | null;
};

function googleMapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function prettyDomain(url: string | null) {
  if (!url) return null;
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "") || null;
}

/** One labelled line: an icon, then a value or a muted "Not available". */
function Line({
  icon,
  value,
  href,
  title,
}: {
  icon: React.ReactNode;
  value: string | null;
  href?: string | null;
  title?: string;
}) {
  if (!value) {
    return (
      <div className="flex items-start gap-3" aria-disabled="true">
        <span className="mt-0.5 shrink-0 text-slate-300 dark:text-slate-600">{icon}</span>
        <span className="text-[13px] font-medium text-slate-400 dark:text-slate-500">
          {NOT_AVAILABLE}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-indigo-500">{icon}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={title}
          className="text-[13px] font-bold text-indigo-500 hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">{value}</span>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 dark:border-[#22304A] dark:bg-[#0B1220]/50">
      <h4 className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function EventVenueOrganizer({ event }: { event: FindShowEvent }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (refresh: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const response = await fetch(
          `/api/events/${encodeURIComponent(event.slug)}/enrichment`,
          refresh ? { method: "POST" } : undefined
        );
        setData(response.ok ? ((await response.json()) as Payload) : null);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [event.slug]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const extra = data?.enrichment ?? null;

  // Seed first, fetched only as a fallback.
  const venueName = event.venue && event.venue !== "Venue to be announced" ? event.venue : extra?.venueName ?? null;
  const city = event.city || extra?.venueCity || null;
  const country = event.country && event.country !== "Unknown" ? event.country : extra?.venueCountry ?? null;
  const place = [city, country].filter(Boolean).join(", ") || null;
  const mapQuery = [venueName, city, country].filter(Boolean).join(", ");

  const organizerName = event.organizer || extra?.organizerName || null;
  const organizerSite = extra?.organizerWebsite ?? event.website ?? null;
  const organizerEmail = event.email || extra?.organizerEmail || null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title="Venue Details">
          <Line icon={<Hotel className="size-4" />} value={venueName} />
          <Line icon={<MapPin className="size-4" />} value={place} />
          <Line icon={<Building2 className="size-4" />} value={extra?.venueAddress ?? null} />
          <Line icon={<MapPin className="size-4" />} value={extra?.venuePostcode ?? null} />
          <Line
            icon={<Globe2 className="size-4" />}
            value={prettyDomain(extra?.venueWebsite ?? null)}
            href={extra?.venueWebsite ?? null}
            title="Venue website"
          />
          <Line
            icon={<ExternalLink className="size-4" />}
            value={mapQuery ? "Open in Google Maps" : null}
            href={mapQuery ? googleMapsUrl(mapQuery) : null}
            title="Open in Google Maps"
          />
        </Card>

        <Card title="Organizer">
          <Line icon={<Building2 className="size-4" />} value={organizerName} />
          <Line icon={<Building2 className="size-4" />} value={extra?.organizerLegalName ?? null} />
          <Line
            icon={<Globe2 className="size-4" />}
            value={prettyDomain(organizerSite)}
            href={organizerSite}
            title="Organizer website"
          />
          <Line icon={<MapPin className="size-4" />} value={extra?.organizerAddress ?? null} />
          <Line
            icon={<Mail className="size-4" />}
            value={organizerEmail}
            href={organizerEmail ? `mailto:${organizerEmail}` : null}
            title="Organizer email"
          />
          <Line
            icon={<Phone className="size-4" />}
            value={extra?.organizerPhone ?? null}
            href={extra?.organizerPhone ? `tel:${extra.organizerPhone.replace(/\s+/g, "")}` : null}
            title="Organizer phone"
          />
        </Card>
      </div>

      {/* Provenance and a manual re-fetch. Says plainly when the lookup found
          nothing, so empty fields are never ambiguous. */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" />
              Looking up venue and organizer detail...
            </span>
          ) : data?.error ? (
            `Extra detail unavailable (${data.error}). Showing what the catalog holds.`
          ) : extra?.sourceUrl ? (
            `Extra detail from ${prettyDomain(extra.sourceUrl)}${
              data?.fetchedAt ? `, fetched ${new Date(data.fetchedAt).toLocaleDateString()}` : ""
            }.`
          ) : (
            "Showing what the catalog holds."
          )}
        </p>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-300 dark:hover:border-indigo-400/50"
        >
          <RefreshCw className={refreshing ? "size-3 animate-spin" : "size-3"} />
          Refresh
        </button>
      </div>
    </div>
  );
}
