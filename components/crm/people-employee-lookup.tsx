"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Filter,
    Download,
    Check,
    Loader2,
    X,
    ChevronDown,
    ArrowUp,
    Bookmark,
    Clock,
    Sparkles,
    Wand2,
    Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Placeholder filter rail definition — mirrors the Companies-page accordion rail.
// Wiring these to a real people API is a later task; the UI contract exists now.
const FILTER_OPTIONS: { key: string; label: string; options: string[]; searchable?: boolean }[] = [
    { key: "people", label: "People", options: ["All people", "Net new", "Saved contacts", "Recently viewed"] },
    { key: "job-title", label: "Job Title", options: ["Founder / CEO", "VP Marketing", "Head of Growth", "Sales Director", "Procurement Lead", "CTO / Engineering"], searchable: true },
    { key: "company", label: "Company", options: ["Any company", "Saved companies", "From my workspace", "Exhibitors at my events"], searchable: true },
    { key: "location", label: "Location", options: ["Americas", "Europe", "Africa & Middle East", "Asia-Pacific"] },
    { key: "contact-details", label: "Contact Details", options: ["Has work email", "Has phone number", "Verified only", "Has LinkedIn"] },
    { key: "keywords", label: "Keywords", options: ["SaaS", "AI", "Fintech", "Manufacturing", "Healthcare", "Events"], searchable: true },
    // Mirrors the Companies-tab Category dropdown (same 20 categories, searchable)
    { key: "industry", label: "Industry", options: [
        "Information Technology & Services",
        "Construction",
        "Marketing And Advertising",
        "Real Estate",
        "Health, Wellness & Fitness",
        "Management Consulting",
        "Computer Software",
        "Internet",
        "Retail",
        "Financial Services",
        "Consumer Services",
        "Hospital & Health Care",
        "Automotive",
        "Restaurants",
        "Education Management",
        "Agriculture",
        "Design",
        "Hospitality",
        "Accounting",
        "Trade Show Events",
    ], searchable: true },
    // Bands match the discovery dataset (see lib/company-classification.ts)
    { key: "employee-headcount", label: "Employee Headcount", options: ["1-10", "11-20", "21-50", "51-200", "201-500", "501-1000", "1001-5000", "1001+"] },
    { key: "founded-year", label: "Founded Year", options: ["Before 1980", "1980-1990", "1991-2000", "2001-2010", "2011-2015", "2016-2020", "2021 or later"] },
    { key: "time-in-current-role", label: "Time in Current Role", options: ["Less than 1 year", "1-2 years", "3-5 years", "6-10 years", "More than 10 years"] },
    { key: "time-in-current-company", label: "Time in Current Company", options: ["Less than 1 year", "1-2 years", "3-5 years", "6-10 years", "More than 10 years"] },
    { key: "total-years-of-experience", label: "Total Years of Experience", options: ["0-2 years", "3-5 years", "6-10 years", "11-15 years", "16-20 years", "More than 20 years"] },
    { key: "company-email-provider", label: "Company Email Provider", options: ["Google Workspace", "Microsoft 365 / Outlook", "Zoho Mail", "GoDaddy", "Self-hosted / Other"] },
];

const FINDER_TABS = [
    { key: "recent", label: "Recent Searches" },
    { key: "saved", label: "Saved Searches" },
] as const;

type FinderTabKey = (typeof FINDER_TABS)[number]["key"];

// Rows come from the shared discovery dataset (/api/companies -> Supabase
// DiscoveryCompany). That dataset is company-level: it carries the company
// email/phone/location/headcount, but has no per-person records, so the
// person columns (Name / Title / Position) have no source data yet and render
// as em-dashes until a people dataset is wired up.
type PeopleRow = {
    rowCursor: number;
    id: string;
    name: string;
    category: string;
    domain: string;
    email: string;
    phone: string;
    headquarters: string;
    employeeRange: string;
};

const PAGE_SIZE = 50;

// Employee rows for the clicked company, fetched on demand from
// /api/people/enrich. Currently unwired: the People page renders the discovery
// explorer in people-section.tsx, so this view is kept for re-wiring rather
// than deleted (same treatment as the exhibitor and ticket-booking views).
// (ContactOut People Search, proxied server-side).
type Employee = {
    name: string;
    title: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
};

function formatCategoryLabel(value: string) {
    if (!value) return "";
    return value
        .split(" ")
        .map((word) => (word.length > 2 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
        .join(" ");
}

function initialsForCompany(name: string) {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("");
}

// Same logo strategy as the Companies page: generated seed domains carry a long
// numeric suffix and have no live site, so only real domains are resolved.
function isRealDomain(domain: string | undefined): boolean {
    if (!domain) return false;
    return !/\d{4,}/.test(domain);
}

// Official favicon straight from the company's live website via Google's
// favicon resolver. 404s on dead domains, which triggers the initials fallback.
function companyLogoUrl(domain: string) {
    return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`;
}

function CompanyAvatar({ name, domain }: { name: string; domain?: string }) {
    const [failedDomain, setFailedDomain] = useState<string | null>(null);
    const useLogo = domain && isRealDomain(domain) && failedDomain !== domain;

    if (useLogo) {
        return (
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#0B1220]">
                <img
                    src={companyLogoUrl(domain)}
                    alt={name}
                    loading="lazy"
                    className="size-6 object-contain"
                    onError={() => setFailedDomain(domain)}
                />
            </div>
        );
    }
    return (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-indigo-200 bg-indigo-50 text-[11px] font-bold tracking-wide text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
            {initialsForCompany(name)}
        </div>
    );
}

export function PeopleEmployeeLookup() {
    const [mainTab, setMainTab] = useState<"people" | "saved">("people");
    const [openFilter, setOpenFilter] = useState<string | null>(null);
    const [filterSearch, setFilterSearch] = useState("");
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [activeTab, setActiveTab] = useState<FinderTabKey>("recent");

    // Selected values for the filters that map onto real dataset columns.
    const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
    const [selectedHeadcount, setSelectedHeadcount] = useState<string | null>(null);
    const [peopleSearch, setPeopleSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [rows, setRows] = useState<PeopleRow[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestIdRef = useRef(0);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(peopleSearch.trim()), 400);
        return () => clearTimeout(timer);
    }, [peopleSearch]);

    const hasActiveFilter = Boolean(
        selectedIndustry || selectedLocation || selectedHeadcount || debouncedSearch
    );

    const buildParams = useCallback(
        (nextCursor?: string | null) => {
            const params = new URLSearchParams();
            params.set("limit", String(PAGE_SIZE));
            if (nextCursor) params.set("cursor", nextCursor);
            if (debouncedSearch) params.set("search", debouncedSearch);
            // Industry options are Title Case for display; dataset categories are lowercase.
            if (selectedIndustry) params.set("category", selectedIndustry.toLowerCase());
            if (selectedLocation) params.set("location", selectedLocation);
            if (selectedHeadcount) params.set("employeeRange", selectedHeadcount);
            return params;
        },
        [debouncedSearch, selectedIndustry, selectedLocation, selectedHeadcount]
    );

    // Initial / filter-change load
    useEffect(() => {
        if (!hasActiveFilter) {
            setRows([]);
            setCursor(null);
            setHasNextPage(false);
            setError(null);
            return;
        }
        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        setError(null);
        fetch(`/api/companies?${buildParams().toString()}`)
            .then((res) => res.json())
            .then((data) => {
                if (requestId !== requestIdRef.current) return;
                if (data?.error) throw new Error(data.error);
                setRows(data.companies ?? []);
                setCursor(data.nextCursor ?? null);
                setHasNextPage(Boolean(data.hasNextPage));
            })
            .catch((err) => {
                if (requestId !== requestIdRef.current) return;
                setError(err instanceof Error ? err.message : "Failed to load results");
                setRows([]);
            })
            .finally(() => {
                if (requestId === requestIdRef.current) setIsLoading(false);
            });
    }, [hasActiveFilter, buildParams]);

    // Infinite scroll: fetch the next cursor page when the list nears its end.
    const loadMore = useCallback(() => {
        if (!cursor || !hasNextPage || isLoadingMore || isLoading) return;
        const requestId = requestIdRef.current;
        setIsLoadingMore(true);
        fetch(`/api/companies?${buildParams(cursor).toString()}`)
            .then((res) => res.json())
            .then((data) => {
                if (requestId !== requestIdRef.current) return;
                if (data?.error) throw new Error(data.error);
                setRows((prev) => [...prev, ...(data.companies ?? [])]);
                setCursor(data.nextCursor ?? null);
                setHasNextPage(Boolean(data.hasNextPage));
            })
            .catch(() => {
                /* keep already-loaded rows on a failed page fetch */
            })
            .finally(() => {
                if (requestId === requestIdRef.current) setIsLoadingMore(false);
            });
    }, [cursor, hasNextPage, isLoadingMore, isLoading, buildParams]);

    // ── Employee detail panel (opens when a company row is clicked) ──
    const [selectedCompany, setSelectedCompany] = useState<PeopleRow | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [employeesError, setEmployeesError] = useState<string | null>(null);
    const [contactOutConfigured, setContactOutConfigured] = useState(true);
    const employeeRequestRef = useRef(0);

    useEffect(() => {
        if (!selectedCompany) {
            setEmployees([]);
            setEmployeesError(null);
            return;
        }
        const requestId = ++employeeRequestRef.current;
        setEmployeesLoading(true);
        setEmployeesError(null);
        const params = new URLSearchParams({ company: selectedCompany.name, companyId: selectedCompany.id });
        if (selectedCompany.domain) params.set("domain", selectedCompany.domain);
        fetch(`/api/people/enrich?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                if (requestId !== employeeRequestRef.current) return;
                setContactOutConfigured(data.configured !== false);
                if (data.error) throw new Error(data.error);
                setEmployees(data.employees ?? []);
            })
            .catch((err) => {
                if (requestId !== employeeRequestRef.current) return;
                setEmployees([]);
                setEmployeesError(err instanceof Error ? err.message : "Failed to load employees");
            })
            .finally(() => {
                if (requestId === employeeRequestRef.current) setEmployeesLoading(false);
            });
    }, [selectedCompany]);

    const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
        const el = event.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) loadMore();
    };

    const clearFilters = () => {
        setSelectedIndustry(null);
        setSelectedLocation(null);
        setSelectedHeadcount(null);
        setPeopleSearch("");
    };

    const activeValueFor = (key: string) =>
        key === "industry"
            ? selectedIndustry
            : key === "location"
                ? selectedLocation
                : key === "employee-headcount"
                    ? selectedHeadcount
                    : null;

    const selectFilterValue = (key: string, value: string) => {
        if (key === "industry") setSelectedIndustry((prev) => (prev === value ? null : value));
        else if (key === "location") setSelectedLocation((prev) => (prev === value ? null : value));
        else if (key === "employee-headcount") setSelectedHeadcount((prev) => (prev === value ? null : value));
        else return;
        setOpenFilter(null);
        setFilterSearch("");
    };

    return (
        <div className="mx-auto max-w-[1600px] space-y-5 pb-8">
            {/* Page Header */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-start justify-between gap-4 py-2 sm:flex-row sm:items-center"
            >
                <div>
                    <h1 className="mb-1 text-[24px] font-bold tracking-tight text-slate-900 dark:text-white">
                        People
                    </h1>
                    <p className="text-[13px] text-slate-900 dark:text-slate-400">
                        Discover people and prospects, map them to companies and workspaces, and enrich leads from trade shows and events.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowMobileFilters((prev) => !prev)}
                        className={cn(
                            "inline-flex h-9 items-center gap-2 rounded-[10px] border px-4 text-[13px] font-medium shadow-sm transition-colors xl:hidden",
                            showMobileFilters
                                ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]"
                        )}
                    >
                        <Filter className="size-4" />
                        Filters
                    </button>
                    <button className="hidden h-9 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A] xl:inline-flex">
                        <Filter className="size-4" />
                        Filters
                    </button>
                    <button className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]">
                        <Download className="size-4" />
                        Export
                    </button>
                </div>
            </motion.div>

            {/* Main Tab Switcher: People / Saved People (mirrors Companies page) */}
            <div className="flex w-fit items-center gap-1 rounded-[12px] border border-slate-200 bg-white p-1 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                <button
                    onClick={() => setMainTab("people")}
                    className={cn(
                        "inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-all",
                        mainTab === "people"
                            ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-[#0B1220]"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#16233A] dark:hover:text-white"
                    )}
                >
                    <Users className="size-4" />
                    People
                </button>
                <button
                    onClick={() => setMainTab("saved")}
                    className={cn(
                        "inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-all",
                        mainTab === "saved"
                            ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-[#0B1220]"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#16233A] dark:hover:text-white"
                    )}
                >
                    <Bookmark className="size-4" />
                    Saved People
                </button>
            </div>

            {mainTab === "saved" ? (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex h-[500px] flex-col items-center justify-center rounded-[14px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]"
                >
                    <Bookmark className="mx-auto size-12 text-slate-400 dark:text-slate-500" />
                    <p className="mt-4 text-[18px] font-bold text-slate-900 dark:text-white">
                        No Saved People Yet
                    </p>
                    <p className="mt-2 max-w-md text-[14px] text-slate-500 dark:text-slate-400">
                        Find people and save them here for quick access.
                    </p>
                    <button
                        onClick={() => setMainTab("people")}
                        className="mt-6 inline-flex h-9 items-center gap-2 rounded-[10px] bg-indigo-600 px-5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500"
                    >
                        <Search className="size-4" />
                        Browse People
                    </button>
                </motion.div>
            ) : null}

            {/* Main Split Layout: filter rail left, finder panel right */}
            <div className={cn("grid-cols-1 items-stretch gap-5 xl:grid-cols-[360px_1fr] 2xl:grid-cols-[390px_1fr]", mainTab === "people" ? "grid" : "hidden")}>
                {/* LEFT: Filter Rail (drawer-style on <xl via Filters button) */}
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.05 }}
                    className={cn("flex-col", showMobileFilters ? "flex" : "hidden xl:flex")}
                >
                    <div className="flex h-full flex-col rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input
                                value={peopleSearch}
                                onChange={(event) => setPeopleSearch(event.target.value)}
                                placeholder="Search company name..."
                                className="h-10 w-full rounded-[10px] border border-slate-200 bg-slate-50 pl-10 pr-3 text-[13px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white dark:placeholder:text-slate-500"
                            />
                        </div>

                        {/* Active filter chips */}
                        {hasActiveFilter ? (
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                {[selectedIndustry, selectedLocation, selectedHeadcount]
                                    .filter(Boolean)
                                    .map((value) => (
                                        <span
                                            key={value as string}
                                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-300"
                                        >
                                            {value}
                                        </span>
                                    ))}
                                <button
                                    onClick={clearFilters}
                                    className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:border-white dark:bg-white dark:text-[#0B1220] dark:hover:bg-slate-100"
                                >
                                    Clear
                                </button>
                            </div>
                        ) : null}

                        <div className="mt-4 flex-1 space-y-1.5">
                            {FILTER_OPTIONS.map((option) => {
                                const isOpen = openFilter === option.key;
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
                                            onClick={() => {
                                                setOpenFilter(isOpen ? null : option.key);
                                                setFilterSearch("");
                                            }}
                                            className="flex h-10 w-full items-center justify-between gap-2 px-3 text-[13px] font-medium text-slate-700 transition-colors [font-family:var(--font-inter),'Inter',sans-serif] dark:text-slate-200"
                                        >
                                            <span className="truncate">{option.label}</span>
                                            <span className="flex shrink-0 items-center gap-1.5">
                                                {activeValueFor(option.key) ? (
                                                    <span className="max-w-[110px] truncate rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                                                        {activeValueFor(option.key)}
                                                    </span>
                                                ) : null}
                                                <ChevronDown
                                                    className={cn(
                                                        "size-4 shrink-0 text-slate-400 transition-transform duration-200",
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
                                                        {option.searchable ? (
                                                            <div className="relative mb-2">
                                                                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                                                                <input
                                                                    value={filterSearch}
                                                                    onChange={(event) => setFilterSearch(event.target.value)}
                                                                    placeholder={`Search ${option.label.toLowerCase()}...`}
                                                                    className="h-9 w-full rounded-[9px] border border-slate-200 bg-slate-50 pl-9 pr-3 text-[12px] text-slate-900 outline-none focus:border-indigo-500 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white"
                                                                />
                                                            </div>
                                                        ) : null}
                                                        <div className="max-h-52 space-y-1 overflow-y-auto">
                                                            {option.options
                                                                .filter((value) =>
                                                                    !option.searchable || !filterSearch.trim()
                                                                        ? true
                                                                        : value.toLowerCase().includes(filterSearch.trim().toLowerCase())
                                                                )
                                                                .map((value) => (
                                                                    <button
                                                                        key={value}
                                                                        type="button"
                                                                        onClick={() => selectFilterValue(option.key, value)}
                                                                        className="flex w-full items-center justify-between rounded-[9px] px-3 py-2 text-left text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
                                                                    >
                                                                        <span>{value}</span>
                                                                        {activeValueFor(option.key) === value ? (
                                                                            <Check className="size-3.5 text-indigo-500" />
                                                                        ) : null}
                                                                    </button>
                                                                ))}
                                                        </div>
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

                {/* RIGHT: results table once a filter is applied, otherwise the finder hero */}
                {hasActiveFilter ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex h-full min-h-[560px] flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]"
                    >
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-[#22304A]">
                            <div>
                                <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">Results</h2>
                                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                                    {isLoading
                                        ? "Loading..."
                                        : `${rows.length.toLocaleString()} loaded${hasNextPage ? " • scroll for more" : ""}`}
                                </p>
                            </div>
                        </div>

                        {/* Employee detail card — opens above the results on company-name click */}
                        <AnimatePresence>
                            {selectedCompany ? (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.25, ease: "easeOut" }}
                                    className="overflow-hidden border-b border-slate-200 dark:border-[#22304A]"
                                >
                                    <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3 dark:bg-[#0B1220]">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <CompanyAvatar name={selectedCompany.name} domain={selectedCompany.domain} />
                                            <div className="min-w-0">
                                                <p className="truncate text-[14px] font-bold text-slate-900 dark:text-white">
                                                    {selectedCompany.name}
                                                </p>
                                                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                                                    Employee details
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedCompany(null)}
                                            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]"
                                        >
                                            <X className="size-3.5" />
                                            Close
                                        </button>
                                    </div>

                                    {/* Columns always render; employee fields stay empty until
                                        CONTACTOUT_API_KEY is set (see app/api/people/enrich/route.ts). */}
                                    <div className="max-h-[320px] overflow-auto">
                                        <table className="w-full min-w-[1000px] text-left text-[13px]">
                                            <thead className="sticky top-0 z-10 bg-white dark:bg-[#111B2E]">
                                                <tr className="border-b border-slate-200 text-slate-500 dark:border-[#22304A] dark:text-slate-400">
                                                    <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Company Name</th>
                                                    <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Name</th>
                                                    <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Title</th>
                                                    <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Email</th>
                                                    <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Mobile Number</th>
                                                    <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Location</th>
                                                    <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Employee Count</th>
                                                    <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Category</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-[#1A2740]">
                                                {(employees.length > 0
                                                    ? employees
                                                    : [{ name: "", title: "", email: "", phone: "", location: "", linkedin: "" } as Employee]
                                                ).map((employee, index) => (
                                                    <tr
                                                        key={`${employee.email || employee.name || "placeholder"}-${index}`}
                                                        className="transition-colors hover:bg-slate-50 dark:hover:bg-[#16233A]"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <CompanyAvatar name={selectedCompany.name} domain={selectedCompany.domain} />
                                                                <p className="font-semibold text-slate-900 dark:text-white">
                                                                    {selectedCompany.name}
                                                                </p>
                                                            </div>
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900 dark:text-white">
                                                            {employee.name || "—"}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                            {employee.title || "—"}
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">
                                                            {employee.email || "—"}
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">
                                                            {employee.phone || "—"}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                            {employee.location || "—"}
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-3">
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                <Users className="size-3" />
                                                                {selectedCompany.employeeRange || "—"}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                                                                {formatCategoryLabel(selectedCompany.category)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Status strip under the columns */}
                                    <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-2.5 text-[12px] text-slate-500 dark:border-[#22304A] dark:text-slate-400">
                                        {employeesLoading ? (
                                            <>
                                                <Loader2 className="size-3.5 animate-spin" />
                                                Loading employee details...
                                            </>
                                        ) : !contactOutConfigured ? (
                                            <>
                                                <span className="size-1.5 rounded-full bg-amber-500" />
                                                ContactOut not connected — add{" "}
                                                <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-[#0B1220]">CONTACTOUT_API_KEY</code>{" "}
                                                to .env to fill these columns.
                                            </>
                                        ) : employeesError ? (
                                            <>
                                                <span className="size-1.5 rounded-full bg-red-500" />
                                                {employeesError}
                                            </>
                                        ) : employees.length === 0 ? (
                                            <>
                                                <span className="size-1.5 rounded-full bg-slate-400" />
                                                No employee profiles returned for this company.
                                            </>
                                        ) : (
                                            <>
                                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                                {employees.length} employee{employees.length === 1 ? "" : "s"} found.
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            ) : null}
                        </AnimatePresence>

                        <div
                            onScroll={handleScroll}
                            className="relative max-h-[640px] flex-1 overflow-auto"
                        >
                            {isLoading ? (
                                <div className="flex h-[400px] items-center justify-center gap-2 text-[13px] text-slate-500 dark:text-slate-400">
                                    <Loader2 className="size-4 animate-spin" />
                                    Loading results...
                                </div>
                            ) : error ? (
                                <div className="flex h-[400px] flex-col items-center justify-center px-6 text-center">
                                    <p className="text-[14px] font-semibold text-slate-900 dark:text-white">
                                        Could not load results
                                    </p>
                                    <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{error}</p>
                                </div>
                            ) : rows.length === 0 ? (
                                <div className="flex h-[400px] flex-col items-center justify-center px-6 text-center">
                                    <Search className="size-8 text-slate-400 dark:text-slate-500" />
                                    <p className="mt-3 text-[14px] font-semibold text-slate-900 dark:text-white">
                                        No results found
                                    </p>
                                    <p className="mt-1 max-w-sm text-[12px] text-slate-500 dark:text-slate-400">
                                        Try a different industry, location, or headcount.
                                    </p>
                                </div>
                            ) : (
                                <table className="w-full min-w-[900px] text-left text-[13px]">
                                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#0B1220]">
                                        <tr className="border-b border-slate-200 text-slate-500 dark:border-[#22304A] dark:text-slate-400">
                                            <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Company Name</th>
                                            <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Email</th>
                                            <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Mobile Number</th>
                                            <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Location</th>
                                            <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Employee Count</th>
                                            <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">Category</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-[#1A2740]">
                                        {rows.map((row) => (
                                            <tr
                                                key={row.id}
                                                onClick={() => setSelectedCompany(row)}
                                                className={cn(
                                                    "cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-[#16233A]",
                                                    selectedCompany?.id === row.id && "bg-indigo-50/60 dark:bg-[#16233A]"
                                                )}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <CompanyAvatar name={row.name} domain={row.domain} />
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-300">{row.name}</p>
                                                            {row.domain ? (
                                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">{row.domain}</p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">
                                                    {row.email || "—"}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">
                                                    {row.phone || "—"}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                    {row.headquarters || "—"}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3">
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                        <Users className="size-3" />
                                                        {row.employeeRange || "—"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                                                        {formatCategoryLabel(row.category)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {isLoadingMore ? (
                                <div className="flex items-center justify-center gap-2 py-4 text-[12px] text-slate-500 dark:text-slate-400">
                                    <Loader2 className="size-3.5 animate-spin" />
                                    Loading more...
                                </div>
                            ) : null}
                        </div>

                    </motion.div>
                ) : (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                    className="relative flex h-full min-h-[560px] flex-col overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-sm dark:border-transparent dark:bg-transparent"
                >
                    {/* gradient border + glass base (dark) */}
                    <div className="pointer-events-none absolute inset-0 hidden rounded-[16px] bg-gradient-to-br from-cyan-500/40 via-indigo-500/20 to-fuchsia-500/40 p-px dark:block">
                        <div className="h-full w-full rounded-[15px] bg-[#0B1220]/90 backdrop-blur-2xl" />
                    </div>
                    {/* ambient glow blobs */}
                    <div className="pointer-events-none absolute -top-24 left-1/2 hidden h-48 w-96 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl dark:block" />
                    <div className="pointer-events-none absolute -bottom-32 right-0 hidden h-56 w-72 rounded-full bg-cyan-500/10 blur-3xl dark:block" />

                    <div className="relative flex h-full flex-col overflow-y-auto p-5 sm:p-7">
                        {/* Hero */}
                        <div className="mx-auto w-full max-w-2xl pt-2 text-center">
                            <div className="mx-auto flex size-11 items-center justify-center rounded-[14px] border border-indigo-200 bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30 dark:border-indigo-400/20">
                                <Wand2 className="size-5 text-white" />
                            </div>
                            <h2 className="mt-4 bg-gradient-to-r from-slate-900 via-indigo-700 to-slate-900 bg-clip-text text-[26px] font-bold tracking-tight text-transparent dark:from-white dark:via-indigo-200 dark:to-white">
                                Find the right peoples
                            </h2>
                            <p className="mt-1.5 text-[13px] text-slate-900 dark:text-slate-400">
                                Describe the people, leads, or prospects you need — from trade shows and events to target accounts — and we&apos;ll map them to companies and your workspace with instant discovery and enrichment.
                            </p>
                        </div>

                        {/* Prompt box */}
                        <div className="mx-auto mt-6 w-full max-w-2xl">
                            <div className="group relative rounded-[16px] bg-gradient-to-r from-cyan-500/50 via-indigo-500/50 to-fuchsia-500/50 p-px shadow-lg shadow-indigo-500/10 transition-shadow focus-within:shadow-indigo-500/30">
                                <div className="relative flex items-start gap-3 rounded-[15px] bg-white p-4 dark:bg-[#0D1526]">
                                    <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
                                    <textarea
                                        value={prompt}
                                        onChange={(event) => setPrompt(event.target.value)}
                                        rows={2}
                                        placeholder="e.g., Marketing heads attending trade shows in Dubai from SaaS companies with 200+ employees..."
                                        className="min-h-[48px] w-full resize-none bg-transparent pr-10 text-[13px] leading-6 text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
                                    />
                                    <button
                                        type="button"
                                        aria-label="Generate people search"
                                        className={cn(
                                            "absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full transition-all",
                                            prompt.trim()
                                                ? "bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/40 hover:scale-105"
                                                : "bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500"
                                        )}
                                    >
                                        <ArrowUp className="size-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Recent / Saved Searches tabs */}
                        <div className="mx-auto mt-8 w-full max-w-2xl">
                            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-white/[0.08]">
                                {FINDER_TABS.map((tab) => {
                                    const isActive = activeTab === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setActiveTab(tab.key)}
                                            className={cn(
                                                "relative flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold transition-colors",
                                                isActive
                                                    ? "text-indigo-600 dark:text-indigo-300"
                                                    : "text-slate-800 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-200"
                                            )}
                                        >
                                            {tab.key === "saved" ? <Bookmark className="size-3.5" /> : <Clock className="size-3.5" />}
                                            {tab.label}
                                            {isActive ? (
                                                <motion.span
                                                    layoutId="people-finder-tab-underline"
                                                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                                                />
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Empty states (no searches yet) */}
                            <div className="mt-4 pb-4">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeTab}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center dark:border-white/[0.08] dark:bg-white/[0.02]"
                                    >
                                        {activeTab === "saved" ? (
                                            <Bookmark className="size-8 text-slate-400 dark:text-slate-500" />
                                        ) : (
                                            <Clock className="size-8 text-slate-400 dark:text-slate-500" />
                                        )}
                                        <p className="mt-3 text-[14px] font-semibold text-slate-900 dark:text-white">
                                            {activeTab === "saved" ? "No saved searches found" : "No recent searches found"}
                                        </p>
                                        <p className="mt-1 max-w-sm text-[12px] text-slate-500 dark:text-slate-400">
                                            {activeTab === "saved"
                                                ? "Save a people search to pin it here for quick reuse."
                                                : "Run a people search above and it will show up here."}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* subtle footer hint */}
                        <div className="mx-auto mt-auto flex w-full max-w-2xl items-center justify-center gap-1.5 pt-4 text-[11px] text-slate-400 dark:text-slate-500">
                            <Users className="size-3.5" />
                            People discovery works alongside Companies — filters on the left refine your search.
                        </div>
                    </div>
                </motion.div>
                )}
            </div>
        </div>
    );
}
