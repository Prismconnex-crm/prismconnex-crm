"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bookmark,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  Mail,
  Phone,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EnrichedLeadsFinderPanel } from "@/components/crm/enriched-leads-finder-panel";
import { EventCatalogPanel } from "@/components/crm/event-catalog-panel";
import type { EventFilters, EventResult } from "@/models/event-query";
import {
  COMPANY_CATEGORIES,
  COMPANY_COUNTRIES,
  COMPANY_EMPLOYEE_RANGES,
  COMPANY_LOCATION_REGIONS,
} from "@/lib/company-classification";
import { parseLeadQuery } from "@/lib/lead-query";

type EventSearchState = {
  query: string;
  answer: string;
  filters: EventFilters;
  events: EventResult[];
  totalMatched: number;
  page: number;
  pageSize: number;
};

type CompanyEvent = {
  name: string;
  date: string;
  role: string;
  status: string;
};

type CompanyDeal = {
  name: string;
  value: string;
  status: string;
  owner: string;
};

type CompanyActivity = {
  title: string;
  meta: string;
  when: string;
};

type Company = {
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
  events: CompanyEvent[];
  deals: CompanyDeal[];
  activity: CompanyActivity[];
};

// Website link with a search-fallback: link straight to the real domain when it
// looks like a valid domain, otherwise fall back to a web search for the company
// name so the button never lands on a dead ("can't reach this page") domain.
function isLikelyRealDomain(domain?: string) {
  if (!domain) return false;
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(domain.trim());
}

function slugifyName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Seeded domains are derived from the company name and betray themselves three ways:
// a long digit run, a name-slug followed by digits, or a mid-word truncation of the slug.
function isGeneratedDomain(domain: string, name: string): boolean {
  if (/\d{4,}/.test(domain)) return true; // mittalnair1890000.co.in
  const label = domain.split(".")[0];
  const slug = slugifyName(name);
  const labelNoDigits = label.replace(/\d+$/, "");
  if (label !== labelNoDigits && slug.startsWith(labelNoDigits)) return true; // eliteconsultingllc10.co
  if (label.length >= 15 && slug.startsWith(label) && slug !== label) return true; // dependablesolut.net (truncated)
  return false;
}

function companyWebsiteLink(company: { domain?: string; website?: string; name: string }) {
  const domain = (company.domain ?? "").trim();
  const website = (company.website ?? "").trim();
  if (isLikelyRealDomain(domain) && !isGeneratedDomain(domain.toLowerCase(), company.name)) {
    return { href: website || `https://${domain}`, label: domain, isSearch: false };
  }
  return {
    href: `https://www.google.com/search?q=${encodeURIComponent(company.name)}`,
    label: "Search the web",
    isSearch: true,
  };
}

// Client-side cache of resolved websites so switching between companies doesn't re-query.
const resolvedWebsiteCache = new Map<string, string | null>();

// Website link that upgrades itself: seeded/dead domains trigger a server-side
// lookup (/api/companies/resolve-website) for the real official site; while it
// runs — and if nothing is found — the Google-search fallback stays clickable.
function CompanyWebsiteLink({ company }: { company: { id: string; domain?: string; website?: string; name: string } }) {
  const base = companyWebsiteLink(company);
  const cached = resolvedWebsiteCache.get(company.id);
  const [resolved, setResolved] = useState<string | null | undefined>(cached);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (!base.isSearch || resolvedWebsiteCache.has(company.id)) {
      setResolved(resolvedWebsiteCache.get(company.id));
      return;
    }
    const controller = new AbortController();
    setIsResolving(true);
    setResolved(undefined);
    const params = new URLSearchParams({ name: company.name, domain: company.domain ?? "" });
    fetch(`/api/companies/resolve-website?${params.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { website: null }))
      .then((data: { website?: string | null }) => {
        const website = typeof data.website === "string" ? data.website : null;
        resolvedWebsiteCache.set(company.id, website);
        setResolved(website);
        setIsResolving(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setResolved(null);
        setIsResolving(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const href = base.isSearch && resolved ? resolved : base.href;
  const label = base.isSearch
    ? resolved
      ? resolved.replace(/^https?:\/\/(www\.)?/, "")
      : isResolving
        ? "Finding website…"
        : base.label
    : base.label;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
    >
      <Globe className={cn("size-3.5", isResolving && "animate-pulse")} />
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}

type Employee = {
  id: string;
  name: string;
  title: string;
  companyId: string;
  company: string;
  email: string;
  phone: string;
  location: string;
  score: number;
};



const mockEmployees: Employee[] = [
  {
    id: "1",
    name: "Sarah Miller",
    title: "Marketing Manager",
    companyId: "novaai-systems",
    company: "NovaAI Systems",
    email: "sarah@novaai.example",
    phone: "+49 30 5555 1001",
    location: "Germany",
    score: 98,
  },
  {
    id: "2",
    name: "David Lee",
    title: "Sales Director",
    companyId: "cloudforge-ltd",
    company: "CloudForge Ltd",
    email: "david@cloudforge.example",
    phone: "+44 20 7000 1102",
    location: "United Kingdom",
    score: 85,
  },
  {
    id: "3",
    name: "Amina Khan",
    title: "Partnerships Lead",
    companyId: "medidata-europe",
    company: "Medidata Europe",
    email: "amina@medidata.example",
    phone: "+33 1 4400 7710",
    location: "France",
    score: 79,
  },
  {
    id: "4",
    name: "Jonas Richter",
    title: "Product Lead",
    companyId: "novaai-systems",
    company: "NovaAI Systems",
    email: "jonas@novaai.example",
    phone: "+49 30 5555 1044",
    location: "Germany",
    score: 91,
  },
  {
    id: "5",
    name: "Mia Thompson",
    title: "Operations Manager",
    companyId: "electromech-works",
    company: "ElectroMech Works",
    email: "mia@electromech.example",
    phone: "+1 312 555 4410",
    location: "United States",
    score: 65,
  },
  {
    id: "6",
    name: "Luca Romano",
    title: "Procurement Lead",
    companyId: "greenhydro-labs",
    company: "GreenHydro Labs",
    email: "luca@greenhydro.example",
    phone: "+49 40 5555 1008",
    location: "Germany",
    score: 88,
  },
  {
    id: "7",
    name: "Elena Silva",
    title: "HR Manager",
    companyId: "securenet-dynamics",
    company: "SecureNet Dynamics",
    email: "elena@securenet.example",
    phone: "+44 161 555 2230",
    location: "United Kingdom",
    score: 81,
  },
];

function initialsForCompany(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function formatCategoryLabel(value: string) {
  return value
    .split(" ")
    .map((part) => (part === "&" ? "&" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

function isRealDomain(domain: string | undefined): boolean {
  if (!domain) return false;
  // Generated domains look like "sharmatech123456.co.in" — they have a long numeric suffix
  // Real domains look like "tcs.com", "infosys.com", "bighaat.com"
  return !/\d{4,}/.test(domain);
}

// Official favicon straight from the company's live website via Google's favicon
// resolver (Clearbit's logo API was shut down). Returns 404 for dead/generated
// domains, which triggers the initials fallback below.
function companyLogoUrl(domain: string) {
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`;
}

function CompanyAvatar({ name, domain, className }: { name: string; domain?: string; className?: string }) {
  // Track which domain failed so a reused component instance retries when the row changes
  const [failedDomain, setFailedDomain] = useState<string | null>(null);
  const useLogo = domain && isRealDomain(domain) && failedDomain !== domain;

  if (useLogo) {
    return (
      <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-[14px] border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-[#22304A] dark:bg-[#0B1220]", className)}>
        <img
          src={companyLogoUrl(domain)}
          alt={name}
          loading="lazy"
          className="size-8 object-contain"
          onError={() => setFailedDomain(domain)}
        />
      </div>
    );
  }
  return (
    <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-[14px] border border-indigo-200 bg-indigo-50 text-[13px] font-bold tracking-wide text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300", className)}>
      {initialsForCompany(name)}
    </div>
  );
}


function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString();
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

// Left-rail filter catalogue. "location", "employee-headcount" and "industry"
// are wired to the live /api/companies query params; the rest are placeholders
// awaiting data sources.
const FILTER_OPTIONS: { key: string; label: string }[] = [
  { key: "ai-lookalikes", label: "AI Lookalikes" },
  { key: "category", label: "Category" },
  { key: "location", label: "Location" },
  { key: "country", label: "Country" },
  { key: "keywords", label: "Keywords" },
  { key: "employee-headcount", label: "Employee Headcount" },
  { key: "industry", label: "Industry" },
  { key: "buying-intent", label: "Buying Intent" },
  { key: "technologies", label: "Technologies" },
  { key: "revenue", label: "Revenue" },
  { key: "funding", label: "Funding" },
  { key: "founded-year", label: "Founded Year" },
  { key: "job-posting", label: "Job Posting" },
  { key: "ai-attributes", label: "AI Attributes" },
  { key: "website-traffic", label: "Website Traffic" },
  { key: "key-executives-events", label: "Key Executives Events" },
];

function CompanyTable({
  companies,
  onSelect,
  page,
  pageSize,
  total,
  hasNextPage,
  onNextPage,
  onPreviousPage,
  onPageSizeChange,
}: {
  companies: Company[];
  onSelect: (id: string) => void;
  page: number;
  pageSize: number;
  total: number | null;
  hasNextPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onPageSizeChange: (size: number) => void;
}) {
  const [showPageSizeDropdown, setShowPageSizeDropdown] = useState(false);
  const pageSizeOptions = [30, 50, 100];
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = companies.length > 0 ? rangeStart + companies.length - 1 : 0;
  const canGoPrev = page > 1;
  const canGoNext = hasNextPage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]"
    >
      {/* Sticky Table Header */}
      <div className="flex-shrink-0 overflow-x-auto border-b border-slate-200 bg-slate-50 dark:border-[#22304A] dark:bg-[#0B1220]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-slate-500 dark:text-slate-400">
              <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{width: '60px'}}>Logo</th>
              <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{minWidth: '180px'}}>Company Name</th>
              <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{width: '140px'}}>Established Year</th>
              <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{width: '140px'}}>Employee Range</th>
              <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{minWidth: '150px'}}>Headquarters</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Scrollable Table Body - scrollbar stays INSIDE this card */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <tbody className="divide-y divide-slate-100 dark:divide-[#1A2740]">
            {companies.map((company) => (
              <tr
                key={company.id}
                onClick={() => onSelect(company.id)}
                className="group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-[#16233A]"
              >
                <td className="px-4 py-3" style={{width: '60px'}}>
                  <CompanyAvatar name={company.name} domain={company.domain} />
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white" style={{minWidth: '180px'}}>
                  {company.name}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300" style={{width: '140px'}}>
                  {company.founded}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300" style={{width: '140px'}}>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Users className="size-3" />
                    {company.employeeRange}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300" style={{minWidth: '150px'}}>
                  {company.headquarters}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-2.5 dark:border-[#22304A] dark:bg-[#0B1220]">
        {/* Left Arrow */}
        <button
          disabled={!canGoPrev}
          onClick={onPreviousPage}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md border transition-colors",
            canGoPrev
              ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A] cursor-pointer"
              : "border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed"
          )}
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* Page Selector Dropdown */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowPageSizeDropdown(!showPageSizeDropdown)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]"
            >
              {pageSize} per page
              <ChevronDown className="size-3" />
            </button>
            {showPageSizeDropdown && (
              <div className="absolute bottom-full left-0 z-50 mb-1 w-24 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-[#22304A] dark:bg-[#111B2E]">
                {pageSizeOptions.map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      onPageSizeChange(size);
                      setShowPageSizeDropdown(false);
                    }}
                    className={cn(
                      "block w-full px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-slate-100 dark:hover:bg-[#16233A]",
                      pageSize === size
                        ? "font-semibold text-indigo-600 dark:text-indigo-400"
                        : "text-slate-700 dark:text-slate-300"
                    )}
                  >
                    {size} per page
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Arrow */}
          <button
            disabled={!canGoNext}
            onClick={onNextPage}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md border transition-colors",
              canGoNext
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A] cursor-pointer"
                : "border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed"
            )}
          >
            <ChevronRight className="size-4" />
          </button>

          {/* Range Label */}
          <span className="text-[12px] text-slate-500 dark:text-slate-400">
            Page {page} - {companies.length > 0 ? `${rangeStart} - ${rangeEnd}` : "0"}
            {typeof total === "number" ? ` of ${formatCompactNumber(total)}` : ""}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function CompaniesSection() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const [totalCompanies, setTotalCompanies] = useState<number | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(30);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [mainTab, setMainTab] = useState<"companies" | "saved">("companies");
  // Saved companies are workspace-scoped in Postgres (/api/saved-companies);
  // localStorage is only read once to migrate pre-existing browser-local saves.
  const [savedCompanies, setSavedCompanies] = useState<Company[]>([]);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSaved() {
      try {
        const response = await fetch("/api/saved-companies");
        if (!response.ok) return;
        const rows = await response.json();
        const fromServer: Company[] = Array.isArray(rows)
          ? rows.map((row: { snapshot: Company }) => row.snapshot).filter(Boolean)
          : [];
        if (cancelled) return;
        setSavedCompanies(fromServer);

        // One-time migration of old browser-local saves.
        const stored = localStorage.getItem("prismconnex_saved_companies");
        if (stored) {
          localStorage.removeItem("prismconnex_saved_companies");
          const local: Company[] = JSON.parse(stored);
          const missing = local.filter((c) => c?.id && !fromServer.some((s) => s.id === c.id));
          for (const company of missing) {
            await fetch("/api/saved-companies", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ companyId: company.id, snapshot: company }),
            });
          }
          if (!cancelled && missing.length > 0) {
            setSavedCompanies((prev) => [...prev, ...missing]);
          }
        }
      } catch {
        // keep whatever we have; saved tab just shows empty on network failure
      }
    }

    loadSaved();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddToCrm = useCallback((company: Company) => {
    setSavedCompanies((prev) => {
      if (prev.some((c) => c.id === company.id)) return prev;
      return [...prev, company];
    });
    setJustSavedId(company.id);
    setTimeout(() => setJustSavedId(null), 2000);
    fetch("/api/saved-companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: company.id, snapshot: company }),
    }).catch(() => {
      // optimistic UI; a failed save will disappear on next load
    });
  }, []);

  const handleRemoveFromCrm = useCallback((companyId: string) => {
    setSavedCompanies((prev) => prev.filter((c) => c.id !== companyId));
    fetch(`/api/saved-companies/${encodeURIComponent(companyId)}`, { method: "DELETE" }).catch(() => {
      // optimistic UI; a failed delete will reappear on next load
    });
  }, []);

  const isCompanySaved = useCallback((companyId: string) => {
    return savedCompanies.some((c) => c.id === companyId);
  }, [savedCompanies]);

  const [isDetailView, setIsDetailView] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [companySearch, setCompanySearch] = useState("");
  // Natural-language search: Enter sends the query to /api/companies/ask, which
  // decides whether it's about trade shows or companies. Never fires per
  // keystroke — that would be one model call per character.
  const [eventSearch, setEventSearch] = useState<EventSearchState | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  // Set when /api/companies/ask reports no ANTHROPIC_API_KEY, so the UI can
  // explain why an event question did nothing instead of failing silently.
  const [askUnavailable, setAskUnavailable] = useState(false);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEmployeeRange, setSelectedEmployeeRange] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [filterOrder, setFilterOrder] = useState<string[]>([]);
  const debouncedCompanySearch = useDebouncedValue(companySearch.trim(), 300);
  const isSearchPending = companySearch.trim() !== debouncedCompanySearch;
  const currentCursor = pageCursors[tablePage - 1] ?? null;

  const resetCompanyPagination = useCallback(() => {
    setTablePage(1);
    setPageCursors([null]);
    setNextCursor(null);
    setHasNextPage(false);
  }, []);

  // Global topbar search: apply ?q= from the URL on mount, and react live to
  // searches submitted from the topbar while this section is already rendered.
  useEffect(() => {
    const applyGlobalSearch = (query: string) => {
      const value = query.trim();
      if (!value) return;
      setMainTab("companies");
      setCompanySearch(value);
      setIsDetailView(false);
      setSelectedCompanyId(null);
      resetCompanyPagination();
    };

    const fromUrl = new URLSearchParams(window.location.search).get("q");
    if (fromUrl) applyGlobalSearch(fromUrl);

    const onGlobalSearch = (event: Event) => {
      applyGlobalSearch((event as CustomEvent<string>).detail ?? "");
    };
    window.addEventListener("pcx:company-search", onGlobalSearch);
    return () => window.removeEventListener("pcx:company-search", onGlobalSearch);
  }, [resetCompanyPagination]);

  // "Find your enrich Leads" prompt: translate the free-text query into the
  // same filters the left rail uses, so the applied changes stay visible there.
  const handleLeadQuery = useCallback((raw: string) => {
    const parsed = parseLeadQuery(raw);
    const matchedAnyFilter =
      parsed.category || parsed.country || parsed.region || parsed.employeeRange || parsed.limit;

    setMainTab("companies");
    setIsDetailView(false);
    setSelectedCompanyId(null);

    const order: string[] = [];
    if (parsed.category) { setSelectedCategory(parsed.category); order.push("category"); }
    if (parsed.employeeRange) { setSelectedEmployeeRange(parsed.employeeRange); order.push("employeeRange"); }
    if (parsed.region) { setSelectedLocation(parsed.region); order.push("location"); }
    if (parsed.country) { setSelectedCountry(parsed.country); order.push("country"); }
    if (order.length) {
      setFilterOrder((prev) => [...prev.filter((f) => !order.includes(f)), ...order]);
    }
    if (parsed.limit) setTablePageSize(Math.min(100, Math.max(1, parsed.limit)));

    // Nothing recognized — treat the text as a company-name search instead.
    if (!matchedAnyFilter) setCompanySearch(raw);

    resetCompanyPagination();
  }, [resetCompanyPagination]);

  const handleNextCompanyPage = useCallback(() => {
    if (!nextCursor) {
      return;
    }

    setPageCursors((prev) => {
      const next = prev.slice(0, tablePage);
      next[tablePage] = nextCursor;
      return next;
    });
    setTablePage((page) => page + 1);
  }, [nextCursor, tablePage]);

  const handlePreviousCompanyPage = useCallback(() => {
    setTablePage((page) => Math.max(1, page - 1));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const params = new URLSearchParams();
    params.set('page', String(tablePage));
    params.set('limit', String(tablePageSize));
    if (currentCursor) params.set('cursor', currentCursor);
    if (debouncedCompanySearch) params.set('search', debouncedCompanySearch);
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedEmployeeRange) params.set('employeeRange', selectedEmployeeRange);
    if (selectedLocation) params.set('location', selectedLocation);
    if (selectedCountry) params.set('country', selectedCountry);

    // Instant paint on reload: serve the last response for this exact query from
    // sessionStorage (5 min TTL), then revalidate against the API in the background.
    const cacheKey = `pcx_companies:${params.toString()}`;
    let paintedFromCache = false;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Date.now() - cached.ts < 5 * 60 * 1000 && Array.isArray(cached.companies)) {
          setCompanies(cached.companies);
          setTotalCompanies(cached.total ?? null);
          setNextCursor(cached.nextCursor ?? null);
          setHasNextPage(Boolean(cached.hasNextPage));
          setLoadError(null);
          setIsLoading(false);
          paintedFromCache = true;
        } else {
          sessionStorage.removeItem(cacheKey);
        }
      }
    } catch {
      // corrupt cache entry — fall through to a normal fetch
    }

    async function loadCompanies(attempt = 1) {
      if (cancelled) return;
      if (!paintedFromCache) setIsLoading(true);
      if (attempt === 1 && !paintedFromCache) setLoadError(null);

      try {
        const response = await fetch(`/api/companies?${params.toString()}`, {
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error ?? `Request failed (${response.status})`);
        }

        if (cancelled) return;
        setCompanies(Array.isArray(data.companies) ? data.companies : []);
        setTotalCompanies(typeof data.total === "number" ? data.total : null);
        setNextCursor(typeof data.nextCursor === "string" ? data.nextCursor : null);
        setHasNextPage(Boolean(data.hasNextPage));
        setLoadError(null);
        setIsLoading(false);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            companies: data.companies,
            total: data.total,
            nextCursor: data.nextCursor,
            hasNextPage: data.hasNextPage,
            ts: Date.now(),
          }));
        } catch {
          // sessionStorage full — skip caching this response
        }
      } catch (err) {
        if ((err as Error).name === "AbortError" || cancelled) return;

        console.error(`Failed to load companies (attempt ${attempt}):`, err);

        // Retry up to 3 times with delay
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 2000));
          if (!cancelled) loadCompanies(attempt + 1);
          return;
        }

        // After all retries failed; if we already painted from cache, keep showing it.
        if (!cancelled && !paintedFromCache) {
          setCompanies([]);
          setTotalCompanies(null);
          setNextCursor(null);
          setHasNextPage(false);
          setLoadError("Unable to load companies. Please refresh the page.");
          setIsLoading(false);
        }
      }
    }

    loadCompanies();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedCompanySearch, currentCursor, selectedCategory, selectedEmployeeRange, selectedLocation, selectedCountry, tablePage, tablePageSize]);

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) {
      return COMPANY_CATEGORIES;
    }

    return COMPANY_CATEGORIES.filter((category) => category.includes(query));
  }, [categorySearch]);

  const filteredCompanies = companies;
  const isCompaniesBusy = isLoading || isSearchPending;

  /**
   * Sends the raw query to the assistant. On an event query the right pane
   * swaps to the trade-show results; on a company query (or any failure —
   * missing API key, rate limit, network) we quietly fall back to the existing
   * prefix search so the box never feels broken.
   */
  const runAsk = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim();
      if (query.length < 2) return;

      setIsAsking(true);
      setAskUnavailable(false);
      try {
        const response = await fetch("/api/companies/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: query }),
        });

        const result = await response.json().catch(() => null);

        if (!response.ok) {
          // A missing or rejected API key is a configuration problem worth
          // surfacing. Everything else (rate limit, overload, network) comes
          // back as a 200 with `degraded` and stays silent.
          if (result?.intent === "unavailable") {
            setAskUnavailable(true);
          }
          setEventSearch(null);
          return;
        }

        if (result.intent === "events") {
          setEventSearch({
            query,
            answer: result.answer,
            filters: result.filters,
            events: result.events,
            totalMatched: result.totalMatched,
            page: 1,
            pageSize: result.events.length || (result.filters?.limit ?? 25),
          });
          setSelectedCompanyId(null);
          setIsDetailView(false);
          return;
        }

        setEventSearch(null);
        if (result.intent === "companies" && result.name && result.name !== query) {
          setCompanySearch(result.name);
          resetCompanyPagination();
        }
      } catch {
        // Network failure — leave the prefix search in charge.
        setEventSearch(null);
      } finally {
        setIsAsking(false);
      }
    },
    [resetCompanyPagination]
  );

  /**
   * Pages through matches by replaying the filters Claude already extracted.
   * Deliberately hits /api/events/search, not /ask — no model call per page.
   */
  const handleEventPageChange = useCallback(
    async (nextPage: number) => {
      if (!eventSearch || nextPage < 1 || isAsking) return;

      setIsAsking(true);
      try {
        const response = await fetch("/api/events/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters: eventSearch.filters, page: nextPage }),
        });
        if (!response.ok) return;

        const result = await response.json();
        setEventSearch((prev) =>
          prev
            ? {
                ...prev,
                events: result.events,
                totalMatched: result.totalMatched,
                page: result.page,
                pageSize: result.pageSize,
              }
            : prev
        );
      } catch {
        // Keep the current page on a network failure.
      } finally {
        setIsAsking(false);
      }
    },
    [eventSearch, isAsking]
  );

  // Any live filter/search means the right panel shows matching companies;
  // with nothing active it shows the enriched-leads finder instead.
  const hasActiveCriteria = Boolean(
    selectedCategory || selectedEmployeeRange || selectedLocation || selectedCountry || companySearch.trim()
  );

  const activeCompany =
    filteredCompanies.find((company) => company.id === selectedCompanyId) ??
    savedCompanies.find((company) => company.id === selectedCompanyId) ??
    filteredCompanies[0] ??
    null;

  const activeEmployees = mockEmployees.filter(
    (employee) => employee.companyId === activeCompany?.id
  );

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto pb-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[24px] font-bold tracking-tight">
            <button
              type="button"
              onClick={() => {
                setIsDetailView(false);
                setSelectedCompanyId(null);
              }}
              className={cn(
                "tracking-tight transition-colors duration-300",
                mainTab === "companies" && isDetailView && activeCompany
                  ? "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 cursor-pointer"
                  : "text-slate-900 dark:text-white cursor-default"
              )}
            >
              Companies
            </button>
            <AnimatePresence mode="popLayout">
              {mainTab === "companies" && isDetailView && activeCompany ? (
                <motion.span
                  key={activeCompany.id}
                  initial={{ opacity: 0, x: -14, filter: "blur(6px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: 10, filter: "blur(6px)" }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-flex items-baseline gap-2.5"
                >
                  <span className="select-none bg-gradient-to-b from-indigo-400 to-fuchsia-500 bg-clip-text font-black italic text-transparent">
                    {"//"}
                  </span>
                  <span className="relative bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-fuchsia-400">
                    {activeCompany.name}
                    <motion.span
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
                      className="absolute -bottom-1 left-0 h-[2px] w-full origin-left rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-transparent"
                    />
                  </span>
                </motion.span>
              ) : null}
            </AnimatePresence>
          </h1>
          <p className="text-[13px] text-slate-900 dark:text-slate-400">
            Discover target accounts, inspect firmographics, and move buyers into CRM workflows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]">
            <Filter className="size-4" />
            Filters
          </button>
          <button className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]">
            <Download className="size-4" />
            Export
          </button>
        </div>
      </motion.div>

      {/* Main Tab Switcher: Companies / Saved Companies */}
      <div className="flex items-center gap-1 rounded-[12px] border border-slate-200 bg-white p-1 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E] w-fit">
        <button
          onClick={() => setMainTab("companies")}
          className={cn(
            "inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-all",
            mainTab === "companies"
              ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-[#0B1220]"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#16233A]"
          )}
        >
          <Building2 className="size-4" />
          Companies
        </button>
        <button
          onClick={() => setMainTab("saved")}
          className={cn(
            "inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-all",
            mainTab === "saved"
              ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-[#0B1220]"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#16233A]"
          )}
        >
          <Bookmark className="size-4" />
          Saved Companies
          {savedCompanies.length > 0 ? (
            <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white dark:bg-indigo-500">
              {savedCompanies.length}
            </span>
          ) : null}
        </button>
      </div>

      {mainTab === "saved" ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {savedCompanies.length === 0 ? (
            <div className="flex h-[500px] flex-col items-center justify-center rounded-[14px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
              <Bookmark className="mx-auto size-12 text-slate-400 dark:text-slate-500" />
              <p className="mt-4 text-[18px] font-bold text-slate-900 dark:text-white">
                No Saved Companies Yet
              </p>
              <p className="mt-2 max-w-md text-[14px] text-slate-500 dark:text-slate-400">
                Browse companies and click &quot;Add to CRM&quot; to save them here for quick access.
              </p>
              <button
                onClick={() => setMainTab("companies")}
                className="mt-6 inline-flex h-9 items-center gap-2 rounded-[10px] bg-indigo-600 px-5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500"
              >
                <Search className="size-4" />
                Browse Companies
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#22304A] dark:bg-[#0B1220]">
                <div>
                  <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">Saved Companies</h2>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    {savedCompanies.length} {savedCompanies.length === 1 ? "company" : "companies"} saved to your CRM
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-[#22304A] dark:text-slate-400">
                      <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{width: '60px'}}>Logo</th>
                      <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{minWidth: '200px'}}>Company Name</th>
                      <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{minWidth: '160px'}}>Category</th>
                      <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{width: '140px'}}>Employee Range</th>
                      <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{minWidth: '150px'}}>Headquarters</th>
                      <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{width: '100px'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1A2740]">
                    {savedCompanies.map((company) => (
                      <tr
                        key={company.id}
                        onClick={() => {
                          setSelectedCompanyId(company.id);
                          setMainTab("companies");
                          setIsDetailView(true);
                          setActiveTab("Overview");
                        }}
                        className="group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-[#16233A]"
                      >
                        <td className="px-4 py-3" style={{width: '60px'}}>
                          <CompanyAvatar name={company.name} domain={company.domain} />
                        </td>
                        <td className="px-4 py-3" style={{minWidth: '200px'}}>
                          <p className="font-semibold text-slate-900 dark:text-white">{company.name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{company.domain}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300" style={{minWidth: '160px'}}>
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                            {formatCategoryLabel(company.category)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300" style={{width: '140px'}}>
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <Users className="size-3" />
                            {company.employeeRange}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300" style={{minWidth: '150px'}}>
                          {company.headquarters}
                        </td>
                        <td className="px-4 py-3" style={{width: '100px'}}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFromCrm(company.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-[8px] border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                          >
                            <Trash2 className="size-3" />
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      ) : null}

      {mainTab === "companies" ? (
      <div
        className={cn(
          "grid grid-cols-1 items-stretch gap-5",
          // Event results take the whole width — the 7-column catalog table
          // needs the same room it gets on the Events page.
          !eventSearch && "xl:grid-cols-[360px_1fr] 2xl:grid-cols-[390px_1fr]"
        )}
      >
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="flex flex-col"
        >
          <div className="flex h-full flex-col rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                value={companySearch}
                onChange={(event) => {
                  setCompanySearch(event.target.value);
                  setSelectedCompanyId(null);
                  setIsDetailView(false);
                  setEventSearch(null);
                  resetCompanyPagination();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void runAsk(companySearch);
                  }
                }}
                placeholder="Search companies, or ask about events..."
                className="h-10 w-full rounded-[10px] border border-slate-200 bg-slate-50 pl-10 pr-9 text-[13px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white dark:placeholder:text-slate-500"
              />
              {isAsking ? (
                <Sparkles className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-pulse text-indigo-500" />
              ) : null}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
              Press Enter to ask — e.g. &ldquo;shows happening in London UK&rdquo;
            </p>
            {askUnavailable ? (
              <p className="mt-2 rounded-[8px] border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                Event search is unavailable — ANTHROPIC_API_KEY is not configured.
              </p>
            ) : null}

            <div className={cn("mt-4 flex flex-wrap items-center gap-2", eventSearch && "hidden")}>
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setSelectedEmployeeRange(null);
                  setSelectedLocation(null);
                  setSelectedCountry(null);
                  setSelectedCompanyId(null);
                  setIsDetailView(false);
                  setFilterOrder([]);
                  resetCompanyPagination();
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                  !selectedCategory && !selectedEmployeeRange && !selectedLocation && !selectedCountry
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-[#0B1220]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-slate-900 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-300 dark:hover:text-white"
                )}
              >
                All
              </button>
              {selectedCategory ? (
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                  {formatCategoryLabel(selectedCategory)}
                </span>
              ) : null}
              {selectedEmployeeRange ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-300">
                  {selectedEmployeeRange}
                </span>
              ) : null}
              {selectedLocation ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-300">
                  {selectedLocation}
                </span>
              ) : null}
              {selectedCountry ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-300">
                  {selectedCountry}
                </span>
              ) : null}
              {(selectedCategory || selectedEmployeeRange || selectedLocation || selectedCountry) ? (
                <button
                  onClick={() => {
                    const newOrder = [...filterOrder];
                    let cleared = false;
                    while (newOrder.length > 0 && !cleared) {
                      const last = newOrder.pop()!;
                      if (last === 'country' && selectedCountry) {
                        setSelectedCountry(null);
                        cleared = true;
                      } else if (last === 'location' && selectedLocation) {
                        setSelectedLocation(null);
                        cleared = true;
                      } else if (last === 'employeeRange' && selectedEmployeeRange) {
                        setSelectedEmployeeRange(null);
                        cleared = true;
                      } else if (last === 'category' && selectedCategory) {
                        setSelectedCategory(null);
                        cleared = true;
                      }
                    }
                    if (!cleared) {
                      if (selectedCountry) {
                        setSelectedCountry(null);
                      } else if (selectedLocation) {
                        setSelectedLocation(null);
                      } else if (selectedEmployeeRange) {
                        setSelectedEmployeeRange(null);
                      } else if (selectedCategory) {
                        setSelectedCategory(null);
                      }
                    }
                    setFilterOrder(newOrder);
                    setSelectedCompanyId(null);
                    setIsDetailView(false);
                    resetCompanyPagination();
                  }}
                  className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:border-white dark:bg-white dark:text-[#0B1220] dark:hover:bg-slate-100"
                >
                  <span className="flex items-center gap-1">
                    <X className="size-3" />
                    Clear
                  </span>
                </button>
              ) : null}
            </div>

            <div className={cn("mt-4 flex-1 space-y-1.5", eventSearch && "hidden")}>
              {FILTER_OPTIONS.map((option) => {
                const isOpen = openFilter === option.key;
                const activeValue =
                  option.key === "category" && selectedCategory
                    ? formatCategoryLabel(selectedCategory)
                    : option.key === "employee-headcount" && selectedEmployeeRange
                      ? selectedEmployeeRange
                      : option.key === "location" && selectedLocation
                        ? selectedLocation
                        : option.key === "country" && selectedCountry
                          ? selectedCountry
                          : null;

                return (
                  <div
                    key={option.key}
                    className={cn(
                      "rounded-[10px] border transition-colors",
                      isOpen
                        ? "border-indigo-300 bg-white shadow-sm dark:border-indigo-500/30 dark:bg-[#0E1830]"
                        : "border-slate-200 bg-slate-50 hover:border-indigo-200 dark:border-[#22304A] dark:bg-[#0B1220] dark:hover:border-indigo-500/30"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFilter(isOpen ? null : option.key)}
                      className="flex h-10 w-full items-center justify-between gap-2 px-3 text-[13px] font-medium text-slate-700 transition-colors [font-family:var(--font-inter),'Inter',sans-serif] dark:text-slate-200"
                    >
                      <span className="truncate">{option.label}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {activeValue ? (
                          <span className="max-w-[110px] truncate rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                            {activeValue}
                          </span>
                        ) : null}
                        <ChevronDown
                          className={cn(
                            "size-4 text-slate-400 transition-transform duration-200",
                            isOpen && "rotate-180 text-indigo-500"
                          )}
                        />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-slate-200 p-2 dark:border-[#22304A]">
                            {option.key === "category" ? (
                              <>
                                <div className="relative">
                                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                                  <input
                                    value={categorySearch}
                                    onChange={(event) => setCategorySearch(event.target.value)}
                                    placeholder="Search category..."
                                    className="h-9 w-full rounded-[9px] border border-slate-200 bg-slate-50 pl-9 pr-3 text-[12px] text-slate-900 outline-none focus:border-indigo-500 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white"
                                  />
                                </div>
                                <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                                  {filteredCategories.map((category) => (
                                    <button
                                      key={category}
                                      type="button"
                                      onClick={() => {
                                        setSelectedCategory(category);
                                        setOpenFilter(null);
                                        setSelectedCompanyId(null);
                                        setIsDetailView(false);
                                        resetCompanyPagination();
                                        setFilterOrder((prev) => [...prev.filter((f) => f !== 'category'), 'category']);
                                      }}
                                      className="flex w-full items-center justify-between rounded-[9px] px-3 py-2 text-left text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
                                    >
                                      <span>{formatCategoryLabel(category)}</span>
                                      {selectedCategory === category ? (
                                        <Check className="size-3.5 text-indigo-500" />
                                      ) : null}
                                    </button>
                                  ))}
                                </div>
                              </>
                            ) : option.key === "employee-headcount" ? (
                              <div className="space-y-1">
                                {COMPANY_EMPLOYEE_RANGES.map((range) => (
                                  <button
                                    key={range}
                                    type="button"
                                    onClick={() => {
                                      setSelectedEmployeeRange(range);
                                      setOpenFilter(null);
                                      setSelectedCompanyId(null);
                                      setIsDetailView(false);
                                      resetCompanyPagination();
                                      setFilterOrder((prev) => [...prev.filter((f) => f !== 'employeeRange'), 'employeeRange']);
                                    }}
                                    className="flex w-full items-center justify-between rounded-[9px] px-3 py-2 text-left text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
                                  >
                                    <span>{range}</span>
                                    {selectedEmployeeRange === range ? (
                                      <Check className="size-3.5 text-indigo-500" />
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            ) : option.key === "location" ? (
                              <div className="space-y-1">
                                {COMPANY_LOCATION_REGIONS.map((region) => (
                                  <button
                                    key={region}
                                    type="button"
                                    onClick={() => {
                                      setSelectedLocation(region);
                                      setOpenFilter(null);
                                      setSelectedCompanyId(null);
                                      setIsDetailView(false);
                                      resetCompanyPagination();
                                      setFilterOrder((prev) => [...prev.filter((f) => f !== 'location'), 'location']);
                                    }}
                                    className="flex w-full items-center justify-between rounded-[9px] px-3 py-2 text-left text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
                                  >
                                    <span>{region}</span>
                                    {selectedLocation === region ? (
                                      <Check className="size-3.5 text-indigo-500" />
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            ) : option.key === "country" ? (
                              <div className="max-h-52 space-y-1 overflow-y-auto">
                                {COMPANY_COUNTRIES.map((countryName) => (
                                  <button
                                    key={countryName}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCountry(countryName);
                                      setOpenFilter(null);
                                      setSelectedCompanyId(null);
                                      setIsDetailView(false);
                                      resetCompanyPagination();
                                      setFilterOrder((prev) => [...prev.filter((f) => f !== 'country'), 'country']);
                                    }}
                                    className="flex w-full items-center justify-between rounded-[9px] px-3 py-2 text-left text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
                                  >
                                    <span>{countryName}</span>
                                    {selectedCountry === countryName ? (
                                      <Check className="size-3.5 text-indigo-500" />
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="px-3 py-3 text-center text-[12px] text-slate-400 dark:text-slate-500">
                                Coming soon — this filter unlocks with a connected data source.
                              </p>
                            )}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className={cn("flex flex-col", !eventSearch && "min-h-[600px] xl:min-h-0 xl:relative")}
        >
          <div className={cn("flex h-full w-full flex-col", !eventSearch && "xl:absolute xl:inset-0")}>
          {!isDetailView && eventSearch ? (
            <div className="flex-1 overflow-y-auto pr-1">
              <EventCatalogPanel
                query={eventSearch.query}
                answer={eventSearch.answer}
                filters={eventSearch.filters}
                events={eventSearch.events}
                totalMatched={eventSearch.totalMatched}
                page={eventSearch.page}
                pageSize={eventSearch.pageSize}
                isLoading={isAsking}
                onPageChange={handleEventPageChange}
                onClear={() => {
                  setEventSearch(null);
                  setCompanySearch("");
                  resetCompanyPagination();
                }}
              />
            </div>
          ) : !isDetailView && !hasActiveCriteria ? (
            <EnrichedLeadsFinderPanel onQuery={handleLeadQuery} />
          ) : !isDetailView ? (
            <CompanyTable
              companies={filteredCompanies}
              page={tablePage}
              pageSize={tablePageSize}
              total={totalCompanies}
              hasNextPage={hasNextPage}
              onNextPage={handleNextCompanyPage}
              onPreviousPage={handlePreviousCompanyPage}
              onPageSizeChange={(s) => {
                setTablePageSize(s);
                resetCompanyPagination();
              }}
              onSelect={(id) => {
                setSelectedCompanyId(id);
                setIsDetailView(true);
              }}
            />
          ) : isDetailView && activeCompany ? (
            <div className="flex flex-1 flex-col space-y-2.5 overflow-y-auto pb-4 pr-1">
              <div className="rounded-[10px] border border-slate-200 bg-white p-3.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-3">
                    <CompanyAvatar name={activeCompany.name} domain={activeCompany.domain} className="size-14 rounded-[10px]" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[18px] font-bold tracking-tight text-slate-900 dark:text-white">
                          {activeCompany.name}
                        </h2>
                        {activeCompany.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-slate-600 dark:text-slate-300">
                        {activeCompany.description}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[12px] text-slate-600 dark:text-slate-300">
                        <CompanyWebsiteLink company={activeCompany} />
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="size-3.5 text-slate-400" />
                          {activeCompany.email}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="size-3.5 text-slate-400" />
                          {activeCompany.phone}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleAddToCrm(activeCompany)}
                      disabled={isCompanySaved(activeCompany.id)}
                      className={cn(
                        "h-8 rounded-[8px] px-3 text-[11px] font-medium shadow-sm transition-all",
                        isCompanySaved(activeCompany.id)
                          ? "border border-green-300 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400 cursor-default"
                          : justSavedId === activeCompany.id
                            ? "border border-green-300 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#16233A]"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {isCompanySaved(activeCompany.id) ? (
                          <><Check className="size-3.5" /> Saved to CRM</>
                        ) : justSavedId === activeCompany.id ? (
                          <><Check className="size-3.5" /> Added!</>
                        ) : (
                          <>Add to CRM</>
                        )}
                      </span>
                    </button>
                    <button className="h-8 rounded-[8px] border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#16233A]">
                      Create Deal
                    </button>
                    <button className="h-8 rounded-[8px] bg-indigo-600 px-3 text-[11px] font-semibold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500">
                      Start Sequence
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-[10px] border border-slate-200 bg-white p-2.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Domain
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-slate-900 dark:text-white truncate">
                    {activeCompany.domain}
                  </p>
                </div>
                <div className="rounded-[10px] border border-slate-200 bg-white p-2.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Founded
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-slate-900 dark:text-white">
                    {activeCompany.founded}
                  </p>
                </div>
                <div className="rounded-[10px] border border-slate-200 bg-white p-2.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Employee Range
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-slate-900 dark:text-white">
                    {activeCompany.employeeRange}
                  </p>
                </div>
                <div className="rounded-[10px] border border-slate-200 bg-white p-2.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    HQ
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-slate-900 dark:text-white truncate">
                    {activeCompany.headquarters}
                  </p>
                </div>
                <div className="rounded-[10px] border border-slate-200 bg-white p-2.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Engagement Score
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-slate-900 dark:text-white">
                    {activeCompany.engagementScore}/100
                  </p>
                </div>
                <div className="rounded-[10px] border border-slate-200 bg-white p-2.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Revenue Range
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-slate-900 dark:text-white truncate">
                    {activeCompany.revenueRange}
                  </p>
                </div>
              </div>

              <div className="rounded-[10px] border border-slate-200 bg-white p-2.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-900 dark:text-white">
                      AI Insights
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                      {activeCompany.insights[0] ?? "Strategic fit for IT services partnership."}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                      Trust signals: {activeCompany.trustSignals}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[10px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5 dark:border-[#22304A]">
                  {["Overview", "People", "Events", "Deals", "Activity"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                        activeTab === tab
                          ? "bg-slate-900 text-white dark:bg-white dark:text-[#0B1220]"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#16233A] dark:hover:text-white"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="p-3">
                  {activeTab === "Overview" ? (
                    <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                      <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-2.5 dark:border-[#22304A] dark:bg-[#0B1220]">
                        <div className="flex items-center gap-2">
                          <Building2 className="size-3.5 text-indigo-500" />
                          <h3 className="text-[12px] font-bold text-slate-900 dark:text-white">
                            Firmographics Highlights
                          </h3>
                        </div>
                        <div className="mt-3 space-y-2">
                          {activeCompany.highlights.map((item) => (
                            <div
                              key={item}
                              className="rounded-[8px] border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200"
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-2.5 dark:border-[#22304A] dark:bg-[#0B1220]">
                        <div className="flex items-center gap-2">
                          <Sparkles className="size-3.5 text-indigo-500" />
                          <h3 className="text-[12px] font-bold text-slate-900 dark:text-white">
                            AI Insights
                          </h3>
                        </div>
                        <div className="mt-3 space-y-2">
                          {activeCompany.insights.map((item) => (
                            <div
                              key={item}
                              className="rounded-[8px] border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200"
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "People" ? (
                    <div className="rounded-[12px] border border-dashed border-slate-300 py-10 text-center dark:border-[#22304A]">
                       <Users className="mx-auto size-10 text-slate-400" />
                       <p className="mt-4 text-slate-500">Contact data is currently loading...</p>
                    </div>
                  ) : null}

                  {/* Other tabs omitted for brevity or shown as empty placeholders as per user flow */}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[600px] flex-col items-center justify-center rounded-[14px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
              <Briefcase className="mx-auto size-12 text-slate-400 dark:text-slate-500" />
              <p className="mt-4 text-[18px] font-bold text-slate-900 dark:text-white">
                Select a Category to Start
              </p>
              <p className="mt-2 text-[14px] text-slate-500 dark:text-slate-400">
                Choose a filter on the left to see company intelligence matches.
              </p>
            </div>
          )}
          </div>
        </motion.div>
      </div>
      ) : null}
    </div>
  );
}
