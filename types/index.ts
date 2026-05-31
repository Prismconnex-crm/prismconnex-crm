export type Locale = "en-US" | "en-GB" | "de" | "fr" | "es" | "pt" | "ja" | "zh-CN";

export type WorkspacePreferences = {
  locale: Locale;
  autoDetectLanguage: boolean;
  translateCopilotReplies: boolean;
  timeZone: "Europe/Berlin" | "Europe/London" | "America/New_York" | "Asia/Kolkata";
  currency: "USD" | "EUR" | "GBP" | "INR";
  dateFormat: "MMM d, yyyy" | "dd.MM.yyyy" | "dd/MM/yyyy";
  timeFormat: "12h" | "24h";
  showDualTime: boolean;
};

export type Role = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";

export type EventRecord = {
  id: string;
  name: string;
  city: string;
  country: string;
  start: string;
  end: string;
  source: string;
  fetchedAt: string;
  confidence: number;
  exhibitors: number;
};
