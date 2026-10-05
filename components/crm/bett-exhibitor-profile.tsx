"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Company profile for a BETT exhibitor.
 *
 * Reached by clicking a card on the BETT Exhibitors tab, which routes to
 * /app/companies?source=bett&exhibitorId=<id>. The record is the show
 * directory's own data (named contact, job title, LinkedIn, stand, phone),
 * joined to the DiscoveryCompany row for the same organisation where one
 * exists — that match supplies founded and employee range, which the directory
 * never published.
 *
 * Summary cards are deliberately Founded / Employee Range / HQ. Engagement
 * Score, Revenue Range and Domain are absent: the first two are scores this
 * dataset has no basis for on an exhibitor, and the domain is already a live
 * link in the header, so a card repeating it is wasted space.
 *
 * Nothing here is inferred. A field the source did not publish renders as
 * "Not available" and its action, if any, is disabled rather than linking
 * somewhere misleading.
 */

const EVENT_LABEL = "BETT 2027";
const EVENT_LOCATION = "London, United Kingdom";
const EVENT_DATES = "20 - 22 Jan 2027";

/** LinkedIn brand colour, used only for the company mark. */
const LINKEDIN_BLUE = "#0A66C2";

type ExhibitorProfile = {
  id: string;
  eventSlug: string;
  name: string;
  logoUrl: string | null;
  stand: string | null;
  website: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  designation: string | null;
  personLinkedInUrl: string | null;
  companyLinkedInUrl: string | null;
  profileUrl: string | null;
  directoryUrl: string | null;
  description: string | null;
};

type CompanyMatch = {
  id: string;
  name: string;
  founded: string | null;
  employeeRange: string | null;
  headquarters: string | null;
  region: string | null;
  category: string | null;
  description: string | null;
  domain: string | null;
  tags: string | null;
};

type ProfileResponse = {
  exhibitor: ExhibitorProfile;
  company: CompanyMatch | null;
  matchedBy: "domain" | "name" | null;
};

const TABS = ["Overview", "People", "Events", "Deals", "Activity"] as const;
type Tab = (typeof TABS)[number];

const NOT_AVAILABLE = "Not available";

/** Empty string and whitespace count as missing, not just null. */
function orNotAvailable(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : NOT_AVAILABLE;
}

function prettyDomain(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "") || null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  const missing = value === NOT_AVAILABLE;
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white p-2.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-[12px] font-semibold",
          missing ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

/** A LinkedIn mark that links out, or renders inert when there is no URL. */
function LinkedInAction({
  url,
  label,
  brand,
}: {
  url: string | null;
  label: string;
  brand?: boolean;
}) {
  const shared =
    "inline-flex size-8 items-center justify-center rounded-[8px] border transition-colors";

  if (!url) {
    return (
      <span
        aria-disabled="true"
        title={`${label} — ${NOT_AVAILABLE}`}
        className={cn(
          shared,
          "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-600"
        )}
      >
        <LinkedInGlyph />
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className={cn(
        shared,
        "border-slate-200 bg-white hover:border-indigo-300 dark:border-[#22304A] dark:bg-[#0B1220]"
      )}
      style={brand ? { color: LINKEDIN_BLUE } : undefined}
    >
      <LinkedInGlyph />
    </a>
  );
}

/** Inline so no icon pack is needed; currentColor lets the brand colour apply. */
function LinkedInGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM2.4 9.5h5.16V21H2.4zM9.6 9.5h4.95v1.57h.07c.69-1.24 2.38-2.3 4.4-2.3 3.68 0 4.58 2.3 4.58 5.6V21h-5.16v-5.6c0-1.34-.03-3.07-1.95-3.07-1.96 0-2.26 1.46-2.26 2.97V21H9.6z" />
    </svg>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-[#22304A] dark:bg-[#111B2E]">
      <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white p-4 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const missing = value === NOT_AVAILABLE;
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-[12px] font-medium",
          missing ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-100"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function BettExhibitorProfile({
  exhibitorId,
  onBack,
}: {
  exhibitorId: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [logoFailed, setLogoFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/exhibitors/${encodeURIComponent(exhibitorId)}`);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setData((await response.json()) as ProfileResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load exhibitor");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [exhibitorId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
        <Loader2 className="size-4 animate-spin" />
        Loading exhibitor profile...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-[13px] font-semibold text-rose-600 dark:text-rose-400">
          {error ?? "Exhibitor not found"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-[8px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-[8px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200"
          >
            Back to Companies
          </button>
        </div>
      </div>
    );
  }

  const { exhibitor, company } = data;
  const domain = prettyDomain(exhibitor.website);
  const contactName = [exhibitor.firstName, exhibitor.lastName].filter(Boolean).join(" ");
  // The show's own country is the only location the directory publishes; the
  // matched company's headquarters is richer (city + country) when present.
  const hq = company?.headquarters?.trim() || exhibitor.country?.trim() || null;

  return (
    <div className="flex flex-1 flex-col space-y-2.5 overflow-y-auto pb-4 pr-1">
      {/* Header */}
      <div className="rounded-[10px] border border-slate-200 bg-white p-3.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
        >
          <ArrowLeft className="size-3.5" />
          Back to Companies
        </button>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#0B1220]">
              {exhibitor.logoUrl && !logoFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={exhibitor.logoUrl}
                  alt={`${exhibitor.name} logo`}
                  loading="lazy"
                  className="size-11 object-contain"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className="text-[14px] font-bold tracking-wide text-indigo-600 dark:text-indigo-300">
                  {initials(exhibitor.name)}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[18px] font-bold tracking-tight text-slate-900 dark:text-white">
                  {exhibitor.name}
                </h2>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                  {EVENT_LABEL} Exhibitor
                </span>
                {/* The stand badge was dropped from the header: the stand is
                    already a field on the Overview tab's exhibitor record and
                    on the Events tab, so repeating it beside the name added
                    nothing. */}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-slate-600 dark:text-slate-300">
                {exhibitor.website && domain ? (
                  <a
                    href={exhibitor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                  >
                    <Globe className="size-3.5" />
                    {domain}
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <Globe className="size-3.5" />
                    {NOT_AVAILABLE}
                  </span>
                )}

                {/* The company LinkedIn sits where the email used to, rather
                    than off on the right of the header. The address is still
                    on the People tab beside the person it belongs to, which is
                    where someone goes looking for a contact. */}
                <LinkedInAction
                  url={exhibitor.companyLinkedInUrl}
                  label={`${exhibitor.name} on LinkedIn`}
                  brand
                />

                {exhibitor.phone ? (
                  <a
                    href={`tel:${exhibitor.phone.replace(/\s+/g, "")}`}
                    className="inline-flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-300"
                  >
                    <Phone className="size-3.5 text-slate-400" />
                    {exhibitor.phone}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <Phone className="size-3.5" />
                    {NOT_AVAILABLE}
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <SummaryCard label="Founded" value={orNotAvailable(company?.founded)} />
        <SummaryCard label="Employee Range" value={orNotAvailable(company?.employeeRange)} />
        <SummaryCard label="HQ" value={orNotAvailable(hq)} />
      </div>

      {/* Tabs */}
      <div className="rounded-[10px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2 dark:border-[#22304A]">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "whitespace-nowrap px-3 py-2.5 text-[12px] font-semibold transition-colors",
                activeTab === tab
                  ? "border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-3.5">
          {activeTab === "Overview" ? (
            <div className="space-y-2.5">
              <Panel>
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-900 dark:text-white">
                      Trade show presence
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                      Exhibiting at {EVENT_LABEL} — {EVENT_LOCATION}, {EVENT_DATES}
                      {exhibitor.stand ? `, stand ${exhibitor.stand}` : ""}.
                    </p>
                  </div>
                </div>
              </Panel>

              {/* About — the company's own published description, read from
                  their website's meta/og description by
                  scripts/fetch-exhibitor-descriptions.mjs. First-party copy, so
                  nothing here is generated or paraphrased. Hidden entirely when
                  the site published none, rather than showing an empty card. */}
              {exhibitor.description?.trim() ? (
                <Panel>
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-500 dark:bg-[#0B1220] dark:text-slate-400">
                      <Info className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-900 dark:text-white">
                        About {exhibitor.name}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                        {exhibitor.description.trim()}
                      </p>
                      {domain ? (
                        <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                          Source: {domain}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Panel>
              ) : null}

              <Panel>
                <p className="mb-3 text-[12px] font-semibold text-slate-900 dark:text-white">
                  Exhibitor record
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
                  <Field label="Show" value={EVENT_LABEL} />
                  <Field label="Stand" value={orNotAvailable(exhibitor.stand)} />
                  <Field label="Country" value={orNotAvailable(exhibitor.country)} />
                  <Field label="Official website" value={orNotAvailable(domain)} />
                </div>
              </Panel>

              <Panel>
                <p className="mb-3 text-[12px] font-semibold text-slate-900 dark:text-white">
                  Firmographics
                </p>
                {company ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
                    <Field label="Founded" value={orNotAvailable(company.founded)} />
                    <Field label="Employee range" value={orNotAvailable(company.employeeRange)} />
                    <Field label="Headquarters" value={orNotAvailable(company.headquarters)} />
                    <Field label="Region" value={orNotAvailable(company.region)} />
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    No matching company record, so firmographics are {NOT_AVAILABLE.toLowerCase()}.
                  </p>
                )}
              </Panel>
            </div>
          ) : null}

          {activeTab === "People" ? (
            contactName || exhibitor.designation || exhibitor.email ? (
              <Panel>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-[12px] font-bold text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                      {contactName ? initials(contactName) : <User className="size-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                        {orNotAvailable(contactName)}
                      </p>
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        {orNotAvailable(exhibitor.designation)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                        {exhibitor.email ? (
                          <a
                            href={`mailto:${exhibitor.email}`}
                            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300"
                          >
                            <Mail className="size-3.5 text-slate-400" />
                            {exhibitor.email}
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <Mail className="size-3.5" />
                            {NOT_AVAILABLE}
                          </span>
                        )}
                        {exhibitor.phone ? (
                          <a
                            href={`tel:${exhibitor.phone.replace(/\s+/g, "")}`}
                            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300"
                          >
                            <Phone className="size-3.5 text-slate-400" />
                            {exhibitor.phone}
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <Phone className="size-3.5" />
                            {NOT_AVAILABLE}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <LinkedInAction url={exhibitor.personLinkedInUrl} label="Contact LinkedIn" />
                    <LinkedInAction
                      url={exhibitor.companyLinkedInUrl}
                      label="Company LinkedIn"
                      brand
                    />
                  </div>
                </div>
              </Panel>
            ) : (
              <EmptyState
                title="No named contact"
                hint="The show directory published no contact for this exhibitor."
              />
            )
          ) : null}

          {activeTab === "Events" ? (
            <Panel>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                    <CalendarDays className="size-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                      {EVENT_LABEL}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                      {EVENT_LOCATION} · {EVENT_DATES}
                      {exhibitor.stand ? ` · Stand ${exhibitor.stand}` : ""}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  Exhibiting
                </span>
              </div>
            </Panel>
          ) : null}

          {activeTab === "Deals" ? (
            <EmptyState
              title="No deals yet"
              hint={`Deals raised against ${exhibitor.name} will appear here.`}
            />
          ) : null}

          {activeTab === "Activity" ? (
            <EmptyState
              title="No activity yet"
              hint="Emails, calls and meetings logged for this company will appear here."
            />
          ) : null}
        </div>
      </div>

      {/* Matched company footnote — states plainly whether firmographics came
          from a real match, so an empty Founded card is never ambiguous. */}
      <div className="flex items-center gap-2 px-1 text-[10px] text-slate-500 dark:text-slate-400">
        <Building2 className="size-3" />
        {company
          ? `Firmographics from the matched company record "${company.name}" (matched by ${data.matchedBy}).`
          : "No matching company record in the discovery dataset."}
      </div>
    </div>
  );
}
