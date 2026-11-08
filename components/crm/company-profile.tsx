"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Gauge,
  Globe,
  Info,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Company profile for a discovery-dataset company.
 *
 * The sibling of BettExhibitorProfile, for the other 2,713 rows. Same layout
 * and the same five tabs, so moving between an exhibitor and an ordinary
 * company does not feel like moving between two applications — but fed from
 * the DiscoveryCompany row rather than the show directory.
 *
 * Deliberately NOT a generalisation of BettExhibitorProfile. That component
 * leads with directory facts an ordinary company has none of (named contact,
 * job title, stand, trade-show banner), and the two would have ended up as one
 * component threaded with `source === 'bett'` conditionals in every section.
 * Two readable components beat one that has to be read twice.
 *
 * Summary cards are Founded / Employee Range / HQ — the same three the
 * exhibitor profile shows, in the same order, so the eye lands in the same
 * place on both.
 *
 * Nothing here is inferred. `DiscoveryCompany` has no people, deals or
 * activity records, so those tabs state that plainly rather than showing
 * invented rows; they light up on their own once the data exists.
 */

const NOT_AVAILABLE = "Not available";

const TABS = ["Overview", "People", "Events", "Deals", "Activity"] as const;
type Tab = (typeof TABS)[number];

/** Mirrors the formatted row from /api/companies and /api/companies/[id]. */
export type CompanyProfileRecord = {
  id: string;
  name: string;
  category: string;
  description: string;
  domain: string;
  website: string;
  founded: string;
  employeeRange: string;
  headquarters: string;
  region: string;
  revenueRange: string;
  engagementScore: number;
  trustSignals: string;
  tags: string[];
  email: string;
  phone: string;
  highlights: string[];
  insights: string[];
};

/** Empty string and whitespace count as missing, not just null. */
function orNotAvailable(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : NOT_AVAILABLE;
}

function prettyDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "") || null;
}

/** A bare domain needs a scheme before it can be an href. */
function toHref(website: string, domain: string): string | null {
  const raw = website?.trim() || domain?.trim();
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Title-cases a stored category. The dataset holds three of its categories in
 * two spellings at once ("computer software"/"Computer Software"), which read
 * as two industries if shown raw. Display only.
 */
function formatCategoryLabel(value: string): string {
  return value
    .split(" ")
    .map((part) => (part === "&" ? "&" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
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
          "mt-0.5 truncate text-[13px] font-semibold",
          missing ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"
        )}
        title={missing ? undefined : value}
      >
        {value}
      </p>
    </div>
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

function PanelTitle({ icon: Icon, children }: { icon: typeof Info; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      <Icon className="size-3.5" />
      {children}
    </p>
  );
}

/** Bulleted list used by both Highlights and Signals on the Overview tab. */
function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-2 text-[12px] leading-relaxed text-slate-700 dark:text-slate-300"
        >
          <span
            aria-hidden="true"
            className="mt-1.5 size-1 shrink-0 rounded-full bg-indigo-500 dark:bg-indigo-400"
          />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CompanyProfile({
  companyId,
  initialCompany,
  onBack,
}: {
  companyId: string;
  /**
   * The row the table already holds, so clicking through paints immediately.
   * A refresh or a shared link arrives without it and falls back to the fetch.
   */
  initialCompany?: CompanyProfileRecord | null;
  onBack: () => void;
}) {
  const [company, setCompany] = useState<CompanyProfileRecord | null>(initialCompany ?? null);
  const [loading, setLoading] = useState(!initialCompany);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [logoFailed, setLogoFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}`);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const { company: row } = (await response.json()) as { company: CompanyProfileRecord };
      setCompany(row);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load company");
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    // The handed-down row is already the right company; only fetch without one.
    if (initialCompany && initialCompany.id === companyId) {
      setCompany(initialCompany);
      setLoading(false);
      return;
    }
    void load();
  }, [companyId, initialCompany, load]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="size-5 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-[10px] border border-slate-200 bg-white py-16 dark:border-[#22304A] dark:bg-[#111B2E]">
        <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
          Could not load this company
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{error}</p>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-[8px] bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-indigo-700"
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

  const domain = prettyDomain(company.website || company.domain);
  const href = toHref(company.website, company.domain);
  const logoUrl = company.domain ? `https://logo.clearbit.com/${company.domain}` : null;
  const category = company.category ? formatCategoryLabel(company.category) : "";
  // Companies carried in from the BETT import keep their tag, which is the one
  // thing on this page that explains why a row is in the CRM at all.
  const tradeShowTag = company.tags.find((tag) => /exhibitor/i.test(tag)) ?? null;

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
              {logoUrl && !logoFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={`${company.name} logo`}
                  loading="lazy"
                  className="size-11 object-contain"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className="text-[14px] font-bold tracking-wide text-indigo-600 dark:text-indigo-300">
                  {initials(company.name)}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[18px] font-bold tracking-tight text-slate-900 dark:text-white">
                  {company.name}
                </h2>
                {category ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                    <Tag className="size-3" />
                    {category}
                  </span>
                ) : null}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-slate-600 dark:text-slate-300">
                {href && domain ? (
                  <a
                    href={href}
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

                {company.email ? (
                  <a
                    href={`mailto:${company.email}`}
                    className="inline-flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-300"
                  >
                    <Mail className="size-3.5 text-slate-400" />
                    {company.email}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <Mail className="size-3.5" />
                    {NOT_AVAILABLE}
                  </span>
                )}

                {company.phone ? (
                  <a
                    href={`tel:${company.phone.replace(/\s+/g, "")}`}
                    className="inline-flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-300"
                  >
                    <Phone className="size-3.5 text-slate-400" />
                    {company.phone}
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

      {/* Summary cards — same three, same order, as the exhibitor profile. */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <SummaryCard label="Founded" value={orNotAvailable(company.founded)} />
        <SummaryCard label="Employee Range" value={orNotAvailable(company.employeeRange)} />
        <SummaryCard label="HQ" value={orNotAvailable(company.headquarters)} />
      </div>

      {/* Trade show presence, only for rows the BETT import brought in. Sits
          above the tab bar so it stays visible on every tab, matching the
          exhibitor profile. */}
      {tradeShowTag ? (
        <div className="rounded-[10px] border border-indigo-200 bg-indigo-50/60 p-3.5 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-500/[0.07]">
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-slate-900 dark:text-white">
                Trade show presence
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-slate-900 dark:text-white">
                {tradeShowTag}.
              </p>
            </div>
          </div>
        </div>
      ) : null}

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
                <PanelTitle icon={Info}>Company description</PanelTitle>
                {company.description ? (
                  <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">
                    {company.description}
                  </p>
                ) : (
                  <p className="mt-2 text-[12px] italic text-slate-400 dark:text-slate-500">
                    No description published for this company.
                  </p>
                )}
              </Panel>

              <Panel>
                <PanelTitle icon={Building2}>Firmographics</PanelTitle>
                <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
                  <Field label="Founded" value={orNotAvailable(company.founded)} />
                  <Field label="Employee range" value={orNotAvailable(company.employeeRange)} />
                  <Field label="Headquarters" value={orNotAvailable(company.headquarters)} />
                  <Field label="Region" value={orNotAvailable(company.region)} />
                  <Field label="Industry" value={orNotAvailable(category)} />
                  <Field label="Revenue range" value={orNotAvailable(company.revenueRange)} />
                </div>
              </Panel>

              {company.highlights.length > 0 ? (
                <Panel>
                  <PanelTitle icon={Sparkles}>Highlights</PanelTitle>
                  <BulletList items={company.highlights} />
                </Panel>
              ) : null}

              {company.insights.length > 0 ? (
                <Panel>
                  <PanelTitle icon={Gauge}>Signals</PanelTitle>
                  <BulletList items={company.insights} />
                </Panel>
              ) : null}

              {company.tags.length > 0 ? (
                <Panel>
                  <PanelTitle icon={Tag}>Tags</PanelTitle>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {company.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Panel>
              ) : null}
            </div>
          ) : null}

          {activeTab === "People" ? (
            <EmptyState
              title="No contacts yet"
              hint={`The discovery dataset holds no named contacts for ${company.name}. Imported or manually added people will appear here.`}
            />
          ) : null}

          {activeTab === "Events" ? (
            tradeShowTag ? (
              <Panel>
                <PanelTitle icon={Sparkles}>Trade show presence</PanelTitle>
                <p className="mt-2 text-[12px] font-medium text-slate-800 dark:text-slate-100">
                  {tradeShowTag}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Recorded when this company was imported from the show directory.
                </p>
              </Panel>
            ) : (
              <EmptyState
                title="No events yet"
                hint={`Trade shows ${company.name} attends or exhibits at will appear here.`}
              />
            )
          ) : null}

          {activeTab === "Deals" ? (
            <EmptyState
              title="No deals yet"
              hint={`Deals raised against ${company.name} will appear here.`}
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

      {/* Provenance, matching the exhibitor profile's footnote — an empty
          Founded card is never ambiguous about where the gap came from. */}
      <div className="flex items-center gap-2 px-1 text-[10px] text-slate-500 dark:text-slate-400">
        <MapPin className="size-3" />
        Firmographics from the discovery dataset record for &ldquo;{company.name}&rdquo;.
      </div>
    </div>
  );
}
