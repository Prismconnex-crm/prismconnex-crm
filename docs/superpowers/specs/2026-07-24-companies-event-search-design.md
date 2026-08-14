# Natural-language event search in the Companies tab

**Date:** 2026-07-24

## Goal

Typing an event question into the Companies search box — "list of shows happening in
London UK" — returns matching trade shows instead of companies. Company searches keep
working exactly as before.

## Approach

Upgrade the **existing** search input (`components/crm/companies-section.tsx`) rather than
adding a separate chat panel. Enter submits the raw query to Claude, which classifies it
and extracts filters; the filters are applied locally to the trade-show catalog.

## Flow

```
search box (Enter)
  → POST /api/companies/ask { q }
  → claude-opus-4-8, forced tool_choice over two tools
  → filter_events { city, country, region, category, keyword,
                    monthFrom, monthTo, year, limit }
  → filterEvents() against findShowEvents (9,771 records, in memory)
  → { intent: "events", answer, filters, events[], totalMatched }
```

## Key decisions

| Decision | Rationale |
|---|---|
| Claude returns **filters only**, never events | Matching runs in TypeScript against the real catalog, so a result can never be hallucinated. |
| Two tools + `tool_choice: {type:"any"}` | Forces a classification; no free-text intent string to parse. `disable_parallel_tool_use` caps it at one tool per response. |
| Zod validation of `tool_use.input` | Chosen over `strict: true`, which the docs flag as incompatible with forced `tool_choice`. Same guarantee, no 400 risk. |
| Submit on **Enter**, not per keystroke | One model call per character is untenable. |
| No thinking, `effort: "low"` | Extraction, not reasoning. Keeps latency acceptable behind a search box. |
| Missing `ANTHROPIC_API_KEY` → 503 | UI silently falls back to prefix search; the feature goes dormant instead of breaking. Matches the all-optional pattern in `lib/env.ts`. |
| Route is **not** tenant-scoped | Same rationale as `/api/companies`: the show catalog is shared discovery data, not workspace data. |
| `filterEvents` split into `lib/find-shows/filter-events.ts` | Keeps the pure matching logic free of the SDK import so it stays unit-testable. |

## Files

| File | Role |
|---|---|
| `models/event-query.ts` | Zod schemas, DTOs, and the JSON Schema tool definitions |
| `lib/find-shows/filter-events.ts` | Pure catalog matching + result prose (no SDK dependency) |
| `services/event-query.service.ts` | The Claude call and tool-result handling |
| `app/api/companies/ask/route.ts` | Controller: `validateBody` → service → `jsonOk`/`jsonError` |
| `components/crm/event-results-panel.tsx` | Renders matched shows |
| `tests/integration/event-query-filter.test.ts` | 13 tests over the pure filtering logic |

## Country normalisation

The seed stores locations as `"London (UK - United Kingdom)"`. `catalog.ts` already
normalises these to `city: "London"`, `country: "United Kingdom"` (likewise `USA` →
`United States`, `UAE - …` → `United Arab Emirates`). The system prompt instructs Claude
to expand the same abbreviations, so extracted filters line up with catalog values.
City/country matching is substring-based and accent-insensitive so "Munchen" matches
"München".

## Not done

Requires `npm install @anthropic-ai/sdk` — deferred per the CLAUDE.md rule against
installing dependencies unattended.
