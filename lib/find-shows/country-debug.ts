/**
 * Development-only report of how every Find Shows event got its country —
 * answers "why is this event still Unknown?" without reading the resolver.
 * Served by GET /api/find-shows/country-debug (404 in production). Kept out
 * of catalog.ts so client components importing the catalog don't bundle it.
 */
import findShowsSeed from '../../data/find-shows-seed.json';
import { resolveRecordLocation } from './catalog';
import type { CountryConfidence, CountrySource } from './country-resolution';
import type { FindShowSeedRecord } from '@/types/find-shows';

export type CountryDebugRow = {
  event: string;
  dates: string;
  seedCity: string;
  detectedCountry: string;
  detectedContinent: string;
  detectionSource: CountrySource;
  confidence: CountryConfidence;
  evidence: string;
};

export type CountryDebugFilters = {
  region?: string | null;
  country?: string | null;
  source?: string | null;
  confidence?: string | null;
};

const lower = (value: string | null | undefined) => value?.trim().toLowerCase() || null;

export function buildCountryDebugReport(filters: CountryDebugFilters = {}) {
  const region = lower(filters.region);
  const country = lower(filters.country);
  const source = lower(filters.source);
  const confidence = lower(filters.confidence);

  const rows: CountryDebugRow[] = (findShowsSeed as FindShowSeedRecord[]).map((record) => {
    const location = resolveRecordLocation(record);
    return {
      event: record.name,
      dates: record.dates,
      seedCity: record.city,
      detectedCountry: location.country,
      // Mirrors the catalog: a country the table lacks keeps the old Europe default.
      detectedContinent: location.region ?? 'Europe',
      detectionSource: location.source,
      confidence: location.confidence,
      evidence: location.evidence,
    };
  });

  const bySource: Record<string, number> = {};
  const byConfidence: Record<string, number> = {};
  const unknownByContinent: Record<string, number> = {};
  for (const row of rows) {
    bySource[row.detectionSource] = (bySource[row.detectionSource] ?? 0) + 1;
    byConfidence[row.confidence] = (byConfidence[row.confidence] ?? 0) + 1;
    if (row.detectedCountry === 'Unknown') {
      unknownByContinent[row.detectedContinent] = (unknownByContinent[row.detectedContinent] ?? 0) + 1;
    }
  }

  const matching = rows.filter(
    (row) =>
      (!region || row.detectedContinent.toLowerCase() === region) &&
      (!country || row.detectedCountry.toLowerCase() === country) &&
      (!source || row.detectionSource === source) &&
      (!confidence || row.confidence === confidence)
  );

  return {
    summary: { totalRecords: rows.length, bySource, byConfidence, unknownByContinent },
    count: matching.length,
    rows: matching,
  };
}
