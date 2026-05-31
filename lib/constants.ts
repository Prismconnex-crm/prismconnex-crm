import type { Locale, WorkspacePreferences } from "@/types";
import { defaultLocale as localeDefault, locales as supportedLocales } from "@/lib/locale";
import {
  LayoutDashboard,
  Calendar,
  Building2,
  Users,
  Target,
  DollarSign,
  Mail,
  Zap,
  BarChart3,
  Bot,
  Cable,
  Shield,
  User,
  Settings,
  FileText,
} from "lucide-react";

export const defaultLocale: Locale = localeDefault;
export const locales: Locale[] = supportedLocales;

export const defaultPreferences: WorkspacePreferences = {
  locale: "en-US",
  autoDetectLanguage: true,
  translateCopilotReplies: false,
  timeZone: "America/New_York",
  currency: "USD",
  dateFormat: "MMM d, yyyy",
  timeFormat: "12h",
  showDualTime: true,
};

export const navItems = [
  { href: "/app/dashboard", slug: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/events", slug: "events", label: "Events", icon: Calendar },
  { href: "/app/target-events", slug: "target-events", label: "Target Events", icon: Target },
  { href: "/app/companies", slug: "companies", label: "Companies", icon: Building2 },
  { href: "/app/people", slug: "people", label: "People", icon: Users },
  { href: "/app/leads", slug: "leads", label: "Leads", icon: Target },
  { href: "/app/deals", slug: "deals", label: "Deals", icon: DollarSign },
  { href: "/app/sequences", slug: "sequences", label: "Sequence Studio", icon: Mail },
  { href: "/app/automation", slug: "automation", label: "Automation", icon: Zap },
  { href: "/app/analytics", slug: "analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/integrations", slug: "integrations", label: "Integrations", icon: Cable },
  { href: "/app/deliverability", slug: "deliverability", label: "Deliverability", icon: Shield },
  { href: "/app/team", slug: "team", label: "Team", icon: User },
  { href: "/app/settings", slug: "settings", label: "Settings", icon: Settings },
  { href: "/app/audit-log", slug: "audit-log", label: "Audit Log", icon: FileText },
] as const;

export const publicLinks = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
] as const;
