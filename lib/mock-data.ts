import type { EventRecord } from "@/types";

export const kpis = [
  { label: "Open Pipeline", value: "$1.82M", delta: "+14.5%" },
  { label: "Qualified Leads", value: "428", delta: "+9.2%" },
  { label: "Meetings Set", value: "71", delta: "+6.0%" },
  { label: "Avg ROI", value: "3.4x", delta: "+0.4x" },
];

export const events: EventRecord[] = [
  {
    id: "ev-berlin-tech-week",
    name: "Berlin Tech Week",
    city: "Berlin",
    country: "Germany",
    start: "2026-03-18T09:00:00+01:00",
    end: "2026-03-20T18:00:00+01:00",
    source: "Official organizer feed",
    fetchedAt: "2026-02-17T21:00:00Z",
    confidence: 96,
    exhibitors: 480,
  },
  {
    id: "ev-london-retail-summit",
    name: "London Retail Summit",
    city: "London",
    country: "United Kingdom",
    start: "2026-04-06T10:00:00+01:00",
    end: "2026-04-08T17:00:00+01:00",
    source: "Partner data cooperative",
    fetchedAt: "2026-02-18T05:00:00Z",
    confidence: 91,
    exhibitors: 320,
  },
  {
    id: "ev-ny-health-expo",
    name: "NY Health Expo",
    city: "New York",
    country: "United States",
    start: "2026-05-12T09:30:00-04:00",
    end: "2026-05-14T18:00:00-04:00",
    source: "Public registry + enrichment",
    fetchedAt: "2026-02-17T12:30:00Z",
    confidence: 88,
    exhibitors: 560,
  },
  {
    id: "ev-india-manufacturing-forum",
    name: "India Manufacturing Forum",
    city: "Mumbai",
    country: "India",
    start: "2026-06-03T10:00:00+05:30",
    end: "2026-06-05T17:30:00+05:30",
    source: "Verified listing partner",
    fetchedAt: "2026-02-15T06:10:00Z",
    confidence: 93,
    exhibitors: 410,
  },
];

export const companies = [
  { name: "HelioGrid", industry: "Energy", score: 92, stage: "Customer", owner: "A. Reed" },
  { name: "Veridian Labs", industry: "Biotech", score: 86, stage: "Prospect", owner: "N. Iqbal" },
  { name: "Atlas Circuitry", industry: "Hardware", score: 89, stage: "Lead", owner: "M. Park" },
  { name: "Nova Retail Tech", industry: "Retail", score: 78, stage: "Prospect", owner: "D. Shah" },
];

export const people = [
  { name: "Sofia Laurent", title: "Revenue Ops Lead", company: "HelioGrid", verified: true },
  { name: "Aidan Murphy", title: "Partnerships Director", company: "Nova Retail Tech", verified: true },
  { name: "Leila Khan", title: "Procurement Manager", company: "Atlas Circuitry", verified: false },
  { name: "Marta Novak", title: "CMO", company: "Veridian Labs", verified: true },
];

export const deals = [
  { name: "HelioGrid Booth Build", stage: "Proposal", amount: 74000, margin: 29, roi: 2.7 },
  { name: "Veridian Expo Bundle", stage: "Negotiation", amount: 118000, margin: 34, roi: 3.9 },
  { name: "Atlas Sponsorship", stage: "Won", amount: 204000, margin: 41, roi: 4.8 },
  { name: "Global IoT Expo Package", stage: "Discovery", amount: 56000, margin: 22, roi: 1.9 },
];

export const sequenceSteps = [
  { label: "Intro email", delay: "Day 0", status: "Sent" },
  { label: "LinkedIn touch", delay: "Day 2", status: "Sent" },
  { label: "Follow-up with event angle", delay: "Day 4", status: "Scheduled" },
  { label: "Meeting ask", delay: "Day 7", status: "Draft" },
];
