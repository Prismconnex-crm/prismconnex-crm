"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING IS CURRENTLY DISABLED (kept intentionally for future use).
// Sign-in now sends users straight to /app/dashboard, and middleware redirects
// any direct visit to /onboarding over to the dashboard, so this page is
// unreachable at runtime. Nothing here has been deleted.
//
// TO RE-ENABLE:
//   1. lib/auth/routing.ts  — remove the isOnboarding redirect, uncomment the
//      `session && !onboarded && isAppRoute` block.
//   2. app/(auth)/auth/sign-in/page.tsx — restore the '/onboarding' router.push.
//
// The "Validation failed" bug on Complete Setup is fixed below (required
// workspaceName + draft that survives the locale remount), so the flow is ready
// to work the moment it is switched back on.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState, useTransition, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  Loader2,
  Check,
  ArrowRight,
  ArrowLeft,
  Globe,
  Mail,
  Upload,
  Clock,
  User,
  Briefcase,
  CalendarCheck,
  Ticket,
  Target,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { localizePathname, localeDetails } from "@/lib/locale";
import type { Locale } from "@/types";

const stepIcons = [User, Globe, Mail, Upload] as const;

/** Step index that owns the fields POST /api/onboarding validates. */
const WORKSPACE_STEP = 1;
/** Mirrors `workspaceName: z.string().trim().min(2)` in app/api/onboarding/route.ts. */
const MIN_WORKSPACE_NAME_LENGTH = 2;

/**
 * Changing the language navigates /en-US/onboarding -> /de/onboarding. That is a
 * different value for the [locale] dynamic segment, so React unmounts this page
 * and mounts a fresh copy — every useState below resets to its initial value.
 * The draft keeps the answers alive across that remount; without it the form
 * silently blanks and "Complete Setup" posts an empty workspaceName.
 */
const DRAFT_STORAGE_KEY = "pcx:onboarding-draft";

type OnboardingDraft = {
  currentStep: number;
  selectedRole: string | null;
  workspaceName: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  phoneNumber: string;
  timeZone: string;
  currency: string;
  dualTimeToggle: boolean;
};

const roleDefinitions = {
  "service-providers": { icon: Briefcase, accent: "indigo" },
  attendees: { icon: Ticket, accent: "emerald" },
  exhibitors: { icon: Target, accent: "violet" },
  organizers: { icon: CalendarCheck, accent: "amber" },
} as const;

const accentColors: Record<string, { border: string; bg: string; text: string; glow: string; chip: string; chipText: string }> = {
  indigo: { border: "border-indigo-500", bg: "bg-indigo-500/10", text: "text-indigo-400", glow: "shadow-[0_0_24px_rgba(99,102,241,0.25)]", chip: "bg-indigo-500/15", chipText: "text-indigo-300" },
  emerald: { border: "border-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-400", glow: "shadow-[0_0_24px_rgba(52,211,153,0.25)]", chip: "bg-emerald-500/15", chipText: "text-emerald-300" },
  violet: { border: "border-violet-500", bg: "bg-violet-500/10", text: "text-violet-400", glow: "shadow-[0_0_24px_rgba(139,92,246,0.25)]", chip: "bg-violet-500/15", chipText: "text-violet-300" },
  amber: { border: "border-amber-500", bg: "bg-amber-500/10", text: "text-amber-400", glow: "shadow-[0_0_24px_rgba(245,158,11,0.25)]", chip: "bg-amber-500/15", chipText: "text-amber-300" },
};

const intlLocaleMap: Record<Locale, string> = {
  "en-US": "en-US",
  "en-GB": "en-GB",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  pt: "pt-PT",
  ja: "ja-JP",
  "zh-CN": "zh-CN",
};

/** Pulls the first message out of a Zod `error.format()` payload. */
function firstFieldError(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (key === "_errors") continue;
    const messages = (value as { _errors?: string[] } | null)?._errors;
    if (messages?.length) return messages[0];
  }
  return null;
}

function getTimePreview(timeZone: string, locale: Locale, currency: string) {
  try {
    const now = new Date();
    const formatLocale = intlLocaleMap[locale];
    const time = now.toLocaleTimeString(formatLocale, {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const date = now.toLocaleDateString(formatLocale, {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const amount = new Intl.NumberFormat(formatLocale, { style: "currency", currency }).format(1234.56);
    return { time, date, amount };
  } catch {
    return { time: "--:--", date: "---", amount: "---" };
  }
}

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigatingLocale, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [language, setLanguage] = useState<Locale>(locale);
  const [timeZone, setTimeZone] = useState("America/New_York");
  const [currency, setCurrency] = useState("USD");
  const [dualTimeToggle, setDualTimeToggle] = useState(true);
  const [workspaceNameError, setWorkspaceNameError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftHydrated = useRef(false);

  // Restore anything typed before a language switch remounted the page.
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const draft = JSON.parse(stored) as Partial<OnboardingDraft>;
        if (typeof draft.currentStep === "number") setCurrentStep(draft.currentStep);
        if (draft.selectedRole !== undefined) setSelectedRole(draft.selectedRole);
        if (typeof draft.workspaceName === "string") setWorkspaceName(draft.workspaceName);
        if (typeof draft.firstName === "string") setFirstName(draft.firstName);
        if (typeof draft.lastName === "string") setLastName(draft.lastName);
        if (typeof draft.workEmail === "string") setWorkEmail(draft.workEmail);
        if (typeof draft.phoneNumber === "string") setPhoneNumber(draft.phoneNumber);
        if (typeof draft.timeZone === "string") setTimeZone(draft.timeZone);
        if (typeof draft.currency === "string") setCurrency(draft.currency);
        if (typeof draft.dualTimeToggle === "boolean") setDualTimeToggle(draft.dualTimeToggle);
      }
    } catch {
      // A corrupt draft must never block onboarding — fall back to a blank form.
    } finally {
      draftHydrated.current = true;
    }
  }, []);

  // `language` is intentionally absent: the [locale] route segment owns it.
  useEffect(() => {
    if (!draftHydrated.current) return;
    const draft: OnboardingDraft = {
      currentStep,
      selectedRole,
      workspaceName,
      firstName,
      lastName,
      workEmail,
      phoneNumber,
      timeZone,
      currency,
      dualTimeToggle,
    };
    try {
      window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Private-mode / quota failures are not worth interrupting onboarding for.
    }
  }, [currentStep, currency, dualTimeToggle, firstName, lastName, phoneNumber, selectedRole, timeZone, workEmail, workspaceName]);

  const steps = t.raw("steps") as Array<{ label: string }>;
  const roles = (t.raw("roles") as Array<{ id: keyof typeof roleDefinitions; name: string; chips: string[]; recommended: string }>).map((role) => ({
    ...role,
    ...roleDefinitions[role.id],
  }));
  const languageOptions = localeDetails;
  const timeZoneOptions = t.raw("workspace.timeZones") as Array<{ value: string; label: string }>;
  const currencyOptions = t.raw("workspace.currencies") as Array<{ value: string; label: string }>;
  const preview = useMemo(() => getTimePreview(timeZone, language, currency), [currency, language, timeZone]);

  async function persistLocale(nextLocale: Locale) {
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale, timeZone, currency }),
      });
    } catch {
      // Locale routing still proceeds even if persistence fails.
    }
  }

  async function handleLanguageChange(nextLocale: Locale) {
    setLanguage(nextLocale);
    await persistLocale(nextLocale);
    startTransition(() => {
      router.replace(localizePathname(pathname, nextLocale));
      router.refresh();
    });
  }

  /**
   * The workspace name is the only field POST /api/onboarding requires, and it
   * lives two steps behind "Complete Setup". Checking it here means the user is
   * told which field is wrong, on the step that owns it, instead of getting a
   * bare "Validation failed" from the server after the last step.
   */
  const validateWorkspaceStep = () => {
    if (workspaceName.trim().length < MIN_WORKSPACE_NAME_LENGTH) {
      setWorkspaceNameError(t("errors.workspaceName"));
      setCurrentStep(WORKSPACE_STEP);
      return false;
    }
    setWorkspaceNameError("");
    return true;
  };

  const handleContinue = async () => {
    if (currentStep === WORKSPACE_STEP && !validateWorkspaceStep()) {
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep((step) => step + 1);
      return;
    }

    if (!validateWorkspaceStep()) {
      setError(t("errors.workspaceName"));
      return;
    }

    setLoading(true);
    setError("");
    try {
      await persistLocale(language);

      // Creates the CRM User, Workspace, Membership and WorkspaceSettings for
      // the SIGNED-IN user. This previously called /api/auth/mock-sign-in,
      // which replaced the real session with the demo identity
      // (owner@prismconnex.demo) and created no workspace at all — so
      // resolveTenant() found no membership and every tenant-scoped API failed.
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: workspaceName.trim(),
          locale: language,
          timeZone,
          currency,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        // jsonError() returns the Zod issues in error.details keyed by field;
        // showing the first one beats repeating the generic "Validation failed".
        throw new Error(
          firstFieldError(data?.error?.details) || data?.error?.message || t("errors.complete"),
        );
      }

      // Sets pcx_onboarded server-side. The previous document.cookie write
      // could mark a user onboarded even when no workspace had been created.
      await fetch("/api/onboarding/complete", { method: "POST" });

      try {
        window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // Nothing to recover from — the workspace already exists.
      }

      router.push("/app/dashboard");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t("errors.complete"));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:placeholder-slate-500";
  const selectCls = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-white";
  const labelCls = "text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 transition-colors dark:bg-[#0a0e1a]">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl backdrop-blur-sm transition-colors dark:border-slate-800 dark:bg-slate-900/90 sm:p-8">
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm dark:shadow-md">
                  <Image src="/prismconnex-logo.jpeg" alt="Prismconnex" width={36} height={36} style={{ width: "auto", height: "auto" }} className="object-contain" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[14px] font-bold tracking-tight text-slate-900 dark:text-white">Prism<span className="text-gradient">connex</span></span>
                </div>
              </div>
              <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
              <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{t("header.title")}</h1>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
              <Clock className="size-3" />
              {t("header.badge")}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{t("header.description")}</p>
        </div>

        <div className="mb-8">
          <div className="hidden items-center justify-between sm:flex">
            {steps.map((step, index) => {
              const StepIcon = stepIcons[index];
              return (
                <div key={step.label} className="flex items-center gap-0">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${index < currentStep ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : index === currentStep ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500"}`}>
                      {index < currentStep ? <Check className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                    </div>
                    <span className={`text-sm font-medium transition-colors ${index <= currentStep ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}>{step.label}</span>
                  </div>
                  {index < steps.length - 1 ? <div className={`mx-3 h-px min-w-[40px] flex-1 transition-colors ${index < currentStep ? "bg-emerald-500/50" : "bg-slate-200 dark:bg-slate-800"}`} /> : null}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-2 sm:hidden">
            {steps.map((step, index) => (
              <div key={step.label} className={`h-2 rounded-full transition-all duration-300 ${index === currentStep ? "w-6 bg-indigo-500" : index < currentStep ? "w-2 bg-emerald-500" : "w-2 bg-slate-300 dark:bg-slate-700"}`} />
            ))}
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{error}</div> : null}

        <div className="min-h-[280px]">
          {currentStep === 0 ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("role.title")}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("role.description")}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {roles.map((role) => {
                  const isSelected = selectedRole === role.id;
                  const accent = accentColors[role.accent];
                  const RoleIcon = role.icon;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRole(role.id)}
                      className={`group relative rounded-2xl border p-5 text-left transition-all duration-250 ease-out hover:-translate-y-1 hover:scale-[1.01] ${isSelected ? `${accent.border} ${accent.bg} ${accent.glow}` : "border-slate-200 bg-slate-50 hover:border-indigo-500/30 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/5"}`}
                    >
                      {isSelected ? <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" /></div> : null}
                      <div className="mb-3 flex items-center gap-3">
                        <div className={`flex size-10 items-center justify-center rounded-xl transition-all duration-300 ${isSelected ? `bg-gradient-to-br ${role.accent === "indigo" ? "from-indigo-500 to-purple-600" : role.accent === "emerald" ? "from-emerald-500 to-teal-600" : role.accent === "violet" ? "from-violet-500 to-fuchsia-600" : "from-amber-500 to-orange-600"} shadow-lg` : "bg-slate-200 dark:bg-slate-700"}`}>
                          <RoleIcon className={`size-5 ${isSelected ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
                        </div>
                        <span className={`text-sm font-bold ${isSelected ? "text-slate-900 dark:text-white" : "text-slate-900 dark:text-slate-300"}`}>{role.name}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {role.chips.map((chip, index) => (
                          <span key={chip} className="flex items-center gap-1">
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${isSelected ? `${accent.chip} ${accent.chipText}` : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"}`}>{chip}</span>
                            {index < role.chips.length - 1 ? <ArrowRight className="h-2.5 w-2.5 text-slate-400 dark:text-slate-600" /> : null}
                          </span>
                        ))}
                      </div>
                      {isSelected ? <p className="mt-2.5 text-[10px] font-medium text-emerald-500 dark:text-emerald-400">{role.recommended}</p> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("workspace.title")}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("workspace.description")}</p>
              </div>

              <div className="flex flex-col gap-6 lg:flex-row">
                <div className="flex-1 space-y-4">
                  <div className="space-y-1.5">
                    <label className={labelCls}>{t("workspace.fields.workEmail")}</label>
                    <input value={workEmail} onChange={(event) => setWorkEmail(event.target.value)} placeholder={t("workspace.placeholders.workEmail")} type="email" className={inputCls} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className={labelCls}>{t("workspace.fields.firstName")}</label>
                      <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder={t("workspace.placeholders.firstName")} className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>{t("workspace.fields.lastName")}</label>
                      <input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder={t("workspace.placeholders.lastName")} className={inputCls} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelCls} htmlFor="workspaceName">
                      {t("workspace.fields.workspaceName")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="workspaceName"
                      name="workspaceName"
                      required
                      value={workspaceName}
                      onChange={(event) => {
                        setWorkspaceName(event.target.value);
                        if (workspaceNameError) setWorkspaceNameError("");
                      }}
                      placeholder={t("workspace.placeholders.workspaceName")}
                      aria-invalid={workspaceNameError ? true : undefined}
                      aria-describedby={workspaceNameError ? "workspaceName-error" : undefined}
                      className={`${inputCls} ${workspaceNameError ? "border-red-500 dark:border-red-500" : ""}`}
                    />
                    {workspaceNameError ? (
                      <p id="workspaceName-error" className="text-xs text-red-600 dark:text-red-400">
                        {workspaceNameError}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelCls}>{t("workspace.fields.phoneNumber")}</label>
                    <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder={t("workspace.placeholders.phoneNumber")} type="tel" className={inputCls} />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className={labelCls}>{t("workspace.fields.language")}</label>
                      <select value={language} onChange={(event) => handleLanguageChange(event.target.value as Locale)} className={selectCls} disabled={isNavigatingLocale}>
                        {languageOptions.map((option) => (
                          <option key={option.code} value={option.code}>{option.nativeLabel}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>{t("workspace.fields.timeZone")}</label>
                      <select value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className={selectCls}>
                        {timeZoneOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>{t("workspace.fields.currency")}</label>
                      <select value={currency} onChange={(event) => setCurrency(event.target.value)} className={selectCls}>
                        {currencyOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-all hover:border-indigo-500/30 dark:border-slate-700 dark:bg-slate-800/40">
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-white">{t("workspace.toggles.dualTime")}</span>
                      </div>
                      <button type="button" onClick={() => setDualTimeToggle((value) => !value)} className={`relative h-6 w-11 rounded-full transition-colors ${dualTimeToggle ? "bg-cyan-500" : "bg-slate-300 dark:bg-slate-700"}`}>
                        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${dualTimeToggle ? "translate-x-5" : ""}`} />
                      </button>
                    </label>
                  </div>
                </div>

                <div className="shrink-0 lg:w-56">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t("workspace.preview.title")}</p>
                    <div className="space-y-3">
                      <div>
                        <p className="mb-0.5 text-[10px] text-slate-400 dark:text-slate-500">{t("workspace.preview.time")}</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{preview.time}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] text-slate-400 dark:text-slate-500">{t("workspace.preview.date")}</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{preview.date}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] text-slate-400 dark:text-slate-500">{t("workspace.preview.currency")}</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{preview.amount}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] text-slate-400 dark:text-slate-500">{t("workspace.preview.timezone")}</p>
                        <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">{timeZone}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("sending.title")}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("sending.description")}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-left transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5 dark:border-slate-700 dark:bg-slate-800/40">
                  <div className="mb-2 flex items-center gap-3">
                    <Mail className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{t("sending.primary.title")}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("sending.primary.description")}</p>
                </button>
                <button className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-left transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5 dark:border-slate-700 dark:bg-slate-800/40">
                  <div className="mb-2 flex items-center gap-3">
                    <ArrowRight className="h-5 w-5 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{t("sending.secondary.title")}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("sending.secondary.description")}</p>
                </button>
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("import.title")}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("import.description")}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx" />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5 dark:border-slate-700 dark:bg-slate-800/30"
                >
                  <Upload className="mx-auto mb-2 h-8 w-8 text-slate-400 dark:text-slate-500" />
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{t("import.primary.title")}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("import.primary.description")}</p>
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5 dark:border-slate-700 dark:bg-slate-800/40"
                >
                  <ArrowRight className="mx-auto mb-2 h-8 w-8 text-slate-400 dark:text-slate-500" />
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{t("import.secondary.title")}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("import.secondary.description")}</p>
                </button>
              </div>
            </div>
          ) : null}

        </div>

        <div className="mt-8 flex items-center gap-3">
          {currentStep > 0 ? (
            <button onClick={() => setCurrentStep((step) => step - 1)} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> {t("buttons.back")}
            </button>
          ) : (
            <button disabled className="flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-300 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-600">
              <ArrowLeft className="h-3.5 w-3.5" /> {t("buttons.back")}
            </button>
          )}
          <button onClick={handleContinue} disabled={loading || isNavigatingLocale} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 disabled:opacity-50">
            {loading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : currentStep === steps.length - 1 ? (
              <>
                {t("buttons.complete")} <Check className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                {t("buttons.continue")} <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
