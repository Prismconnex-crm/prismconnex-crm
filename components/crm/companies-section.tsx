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
  MapPin,
  Phone,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMPANY_CATEGORIES,
  COMPANY_EMPLOYEE_RANGES,
  COMPANY_LOCATION_REGIONS,
} from "@/lib/company-classification";

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

function CompanyAvatar({ name, logo }: { name: string; logo?: string }) {
  if (logo) {
    return (
      <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-[#22304A] dark:bg-[#0B1220]">
        <img 
          src={logo} 
          alt={name} 
          className="size-8 object-contain" 
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f0f7ff&color=4f46e5&bold=true`;
          }}
        />
      </div>
    );
  }
  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] border border-indigo-200 bg-indigo-50 text-[13px] font-bold tracking-wide text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
      {initialsForCompany(name)}
    </div>
  );
}

function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString();
}

function CompanyTable({
  companies,
  onSelect,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  companies: Company[];
  onSelect: (id: string) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const [showPageSizeDropdown, setShowPageSizeDropdown] = useState(false);
  const pageSizeOptions = [30, 50, 100];
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

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
                  <CompanyAvatar name={company.name} logo={`https://logo.clearbit.com/${company.domain}`} />
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
          onClick={() => onPageChange(page - 1)}
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
              {page}
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
            onClick={() => onPageChange(page + 1)}
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
            {rangeStart} - {rangeEnd} of {formatCompactNumber(total)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function CompaniesSection() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const [totalCompanies, setTotalCompanies] = useState(0);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(30);

  const [mainTab, setMainTab] = useState<"companies" | "saved">("companies");
  const [savedCompanies, setSavedCompanies] = useState<Company[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("prismconnex_saved_companies");
        return stored ? JSON.parse(stored) : [];
      } catch { return []; }
    }
    return [];
  });
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("prismconnex_saved_companies", JSON.stringify(savedCompanies));
    }
  }, [savedCompanies]);

  const handleAddToCrm = useCallback((company: Company) => {
    setSavedCompanies((prev) => {
      if (prev.some((c) => c.id === company.id)) return prev;
      return [...prev, company];
    });
    setJustSavedId(company.id);
    setTimeout(() => setJustSavedId(null), 2000);
  }, []);

  const handleRemoveFromCrm = useCallback((companyId: string) => {
    setSavedCompanies((prev) => prev.filter((c) => c.id !== companyId));
  }, []);

  const isCompanySaved = useCallback((companyId: string) => {
    return savedCompanies.some((c) => c.id === companyId);
  }, [savedCompanies]);

  const [isDetailView, setIsDetailView] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [companySearch, setCompanySearch] = useState("");
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showEmployeeFilter, setShowEmployeeFilter] = useState(false);
  const [selectedEmployeeRange, setSelectedEmployeeRange] = useState<string | null>(null);
  const [showLocationFilter, setShowLocationFilter] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [filterOrder, setFilterOrder] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCompanies() {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(tablePage));
      params.set('limit', String(tablePageSize));
      if (companySearch) params.set('search', companySearch);
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedEmployeeRange) params.set('employeeRange', selectedEmployeeRange);
      if (selectedLocation) params.set('location', selectedLocation);

      try {
        const response = await fetch(`/api/companies?${params.toString()}`, {
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error ?? `Companies request failed with ${response.status}`);
        }

        setCompanies(Array.isArray(data.companies) ? data.companies : []);
        setTotalCompanies(typeof data.total === "number" ? data.total : 0);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }

        console.error('Failed to load companies:', err);
        setCompanies([]);
        setTotalCompanies(0);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadCompanies();

    return () => {
      controller.abort();
    };
  }, [companySearch, selectedCategory, selectedEmployeeRange, selectedLocation, tablePage, tablePageSize]);

  // Reset page when filters change
  useEffect(() => {
    setTablePage(1);
  }, [companySearch, selectedCategory, selectedEmployeeRange, selectedLocation]);

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) {
      return COMPANY_CATEGORIES;
    }

    return COMPANY_CATEGORIES.filter((category) => category.includes(query));
  }, [categorySearch]);

  const filteredCompanies = companies;

  const activeCompany =
    filteredCompanies.find((company) => company.id === selectedCompanyId) ??
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
          <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-white">
            Companies
          </h1>
          <p className="text-[13px] text-slate-600 dark:text-slate-400">
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
                      <tr key={company.id} className="group transition-colors hover:bg-slate-50 dark:hover:bg-[#16233A]">
                        <td className="px-4 py-3" style={{width: '60px'}}>
                          <CompanyAvatar name={company.name} logo={`https://logo.clearbit.com/${company.domain}`} />
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
                            onClick={() => handleRemoveFromCrm(company.id)}
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
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[360px_1fr] 2xl:grid-cols-[390px_1fr]">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="flex flex-col space-y-4"
        >
          <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                value={companySearch}
                onChange={(event) => setCompanySearch(event.target.value)}
                placeholder="Search company, domain, location..."
                className="h-10 w-full rounded-[10px] border border-slate-200 bg-slate-50 pl-10 pr-3 text-[13px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white dark:placeholder:text-slate-500"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setSelectedEmployeeRange(null);
                  setSelectedLocation(null);
                  setSelectedCompanyId(null);
                  setIsDetailView(false);
                  setFilterOrder([]);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                  !selectedCategory && !selectedEmployeeRange && !selectedLocation
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
              {(selectedCategory || selectedEmployeeRange || selectedLocation) ? (
                <button
                  onClick={() => {
                    const newOrder = [...filterOrder];
                    let cleared = false;
                    while (newOrder.length > 0 && !cleared) {
                      const last = newOrder.pop()!;
                      if (last === 'location' && selectedLocation) {
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
                      if (selectedLocation) {
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

            <div className="mt-4 space-y-3">
              <div className="relative">
                <button
                  onClick={() => {
                    setShowCategoryFilter((value) => !value);
                    setShowEmployeeFilter(false);
                    setShowLocationFilter(false);
                  }}
                  className="flex h-10 w-full items-center justify-between rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#16233A]"
                >
                  <span className="truncate">
                    {selectedCategory ? formatCategoryLabel(selectedCategory) : "Category"}
                  </span>
                  <ChevronDown className="size-4 text-slate-400" />
                </button>
                <AnimatePresence>
                  {showCategoryFilter ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute z-20 mt-2 w-full rounded-[12px] border border-slate-200 bg-white p-3 shadow-xl dark:border-[#22304A] dark:bg-[#111B2E]"
                    >
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          value={categorySearch}
                          onChange={(event) => setCategorySearch(event.target.value)}
                          placeholder="Search category..."
                          className="h-9 w-full rounded-[9px] border border-slate-200 bg-slate-50 pl-9 pr-3 text-[12px] text-slate-900 outline-none focus:border-indigo-500 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white"
                        />
                      </div>
                      <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
                        {filteredCategories.map((category) => (
                          <button
                            key={category}
                            onClick={() => {
                              setSelectedCategory(category);
                              setShowCategoryFilter(false);
                              setSelectedCompanyId(null);
                              setIsDetailView(false);
                              setFilterOrder((prev) => [...prev.filter((f) => f !== 'category'), 'category']);
                            }}
                            className="flex w-full items-center justify-between rounded-[9px] px-3 py-2 text-left text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
                          >
                            <span>{formatCategoryLabel(category)}</span>
                            {selectedCategory === category ? (
                              <span className="text-[11px] text-indigo-600 dark:text-indigo-300">
                                Selected
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="relative">
                <button
                  onClick={() => {
                    setShowEmployeeFilter((value) => !value);
                    setShowCategoryFilter(false);
                    setShowLocationFilter(false);
                  }}
                  className="flex h-10 w-full items-center justify-between rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#16233A]"
                >
                  <span>{selectedEmployeeRange ?? "Employee Range"}</span>
                  <ChevronDown className="size-4 text-slate-400" />
                </button>
                <AnimatePresence>
                  {showEmployeeFilter ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute z-20 mt-2 w-full rounded-[12px] border border-slate-200 bg-white p-2 shadow-xl dark:border-[#22304A] dark:bg-[#111B2E]"
                    >
                      {COMPANY_EMPLOYEE_RANGES.map((range) => (
                        <button
                          key={range}
                          onClick={() => {
                            setSelectedEmployeeRange(range);
                            setShowEmployeeFilter(false);
                            setSelectedCompanyId(null);
                            setIsDetailView(false);
                            setFilterOrder((prev) => [...prev.filter((f) => f !== 'employeeRange'), 'employeeRange']);
                          }}
                          className="flex w-full rounded-[9px] px-3 py-2 text-left text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
                        >
                          {range}
                        </button>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="relative">
                <button
                  onClick={() => {
                    setShowLocationFilter((value) => !value);
                    setShowCategoryFilter(false);
                    setShowEmployeeFilter(false);
                  }}
                  className="flex h-10 w-full items-center justify-between rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#16233A]"
                >
                  <span>{selectedLocation ?? "Location"}</span>
                  <ChevronDown className="size-4 text-slate-400" />
                </button>
                <AnimatePresence>
                  {showLocationFilter ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute z-20 mt-2 w-full rounded-[12px] border border-slate-200 bg-white p-2 shadow-xl dark:border-[#22304A] dark:bg-[#111B2E]"
                    >
                      {COMPANY_LOCATION_REGIONS.map((region) => (
                        <button
                          key={region}
                          onClick={() => {
                            setSelectedLocation(region);
                            setShowLocationFilter(false);
                            setSelectedCompanyId(null);
                            setIsDetailView(false);
                            setFilterOrder((prev) => [...prev.filter((f) => f !== 'location'), 'location']);
                          }}
                          className="flex w-full rounded-[9px] px-3 py-2 text-left text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
                        >
                          {region}
                        </button>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-[#22304A]">
              <div>
                <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">Results</h2>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Company matches based on the current filters
                </p>
              </div>
            </div>

            <div className="max-h-[720px] overflow-y-auto p-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-10 text-slate-500">
                  <div className="size-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 mb-4" />
                  <p className="text-[13px] font-semibold">Loading Companies...</p>
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="rounded-[12px] border border-dashed border-slate-300 px-4 py-10 text-center dark:border-[#22304A]">
                  <p className="text-[14px] font-semibold text-slate-900 dark:text-white">
                    No companies found
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                    Adjust the filters to view companies again.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCompanies.map((company) => {
                    const isActive = company.id === activeCompany?.id;

                    return (
                      <button
                        key={company.id}
                        onClick={() => {
                          setSelectedCompanyId(company.id);
                          setIsDetailView(true);
                          setActiveTab("Overview");
                        }}
                        className={cn(
                          "w-full rounded-[12px] border p-3 text-left transition-all",
                          isActive
                            ? "border-indigo-300 bg-indigo-50/80 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-500/10"
                            : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:hover:bg-[#16233A]"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <CompanyAvatar name={company.name} logo={`https://logo.clearbit.com/${company.domain}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[14px] font-semibold text-slate-900 dark:text-white">
                                  {company.name}
                                </p>
                                <p className="mt-1 truncate text-[12px] text-slate-500 dark:text-slate-400">
                                  {company.domain}
                                </p>
                              </div>
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-300">
                                {company.engagementScore}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="size-3.5" />
                                {company.headquarters}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Users className="size-3.5" />
                                {company.employeeRange}
                              </span>
                            </div>
                            <p className="mt-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              {formatCategoryLabel(company.category)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 px-4 py-3 text-[12px] text-slate-500 dark:border-[#22304A] dark:text-slate-400">
              Showing {filteredCompanies.length} of {totalCompanies >= 1000000 ? (totalCompanies / 1000000).toFixed(2) + "M" : totalCompanies.toLocaleString()} companies
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="flex flex-col min-h-[600px] xl:min-h-0 xl:relative"
        >
          <div className="flex h-full w-full flex-col xl:absolute xl:inset-0">
          {!isDetailView ? (
            <CompanyTable 
              companies={filteredCompanies}
              page={tablePage}
              pageSize={tablePageSize}
              total={totalCompanies}
              onPageChange={(p) => setTablePage(p)}
              onPageSizeChange={(s) => { setTablePageSize(s); setTablePage(1); }}
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
                    <CompanyAvatar name={activeCompany.name} logo={`https://logo.clearbit.com/${activeCompany.domain}`} className="size-14 rounded-[10px]" />
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
                        <a
                          href={`https://${activeCompany.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          <Globe className="size-3.5" />
                          {activeCompany.domain}
                          <ExternalLink className="size-3" />
                        </a>
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
