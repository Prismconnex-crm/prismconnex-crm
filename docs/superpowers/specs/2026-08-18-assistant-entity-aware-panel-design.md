# Entity-Aware AIChatPanel — Design

**Date:** 2026-08-18
**Status:** Approved, ready for planning
**Scope:** Spec 3a — the shared panel's handoff UX and URL-backed filter state,
with People and Events as its consumers.

**Depends on:** `2026-08-17-assistant-entity-router-design.md` (Spec 1, shipped),
`2026-08-17-assistant-shared-conversation-design.md` (Spec 2a, shipped),
`2026-08-17-assistant-events-migration-design.md` (Spec 2b, shipped).

**Followed by:** Spec 3b, the Companies migration. It supersedes the unshipped
Spec 2c and is the only thing that makes the panel identical on all three pages.

## Problem

Spec 2a and 2b put one panel and one conversation behind People and Events, and
the router already emits `navigate`, `confirm` and `answer_inline`. The client
honours almost none of that.

A `navigate` decision pushes the route immediately, with no warning and nothing
the user can stop. The `handoffMessage` the server sends to explain the jump is
parsed and then thrown away by the reducer. `PendingHandoff.sourceFilters` is
hardcoded `null`, so "Go back" returns to a page stripped of the filters it had.
`confirm` renders as a bare sentence with no way to answer it. Interpreted
filters are shown as read-only chips that cannot be applied to the page.

Underneath all of that is one structural fact: `components/crm/section-router.tsx`
renders sections conditionally by slug, so leaving `/app/companies` unmounts
`CompaniesSection` and destroys its filter state. Filters live nowhere that
survives a navigation, which is why `sourceFilters` could only ever have been
`null`.

## Goals

- A navigation the user sees coming, can cancel, and can reverse.
- Filter state on People and Events that survives navigation, browser back, and
  a page refresh.
- `answer_inline`, `navigate` and `confirm` each rendered as the router intends.
- One conversation identity (`conversationId`) that outlives the page.
- Every new decision expressed in a pure module a node test can reach.

## Non-goals

- **Companies.** It stays on `/api/companies/ask` with its inline trade-show
  pane. `hasBinding('companies')` remains false and continues to guard the
  navigation effect. Spec 3b migrates it.
- **URL filters on Companies.** This spec converts People and Events only.
  "URL is the source of truth on all three pages" is true at the end of 3b,
  not at the end of 3a.
- Deleting any legacy route. `/api/companies/ask` and `/api/events/search` both
  still have a caller until 3b.
- Server-side conversation memory. `conversationId` is accepted and logged; it
  changes no behaviour.
- Renaming the endpoint. `POST /api/assistant/chat` and its NDJSON stream stay
  exactly as they are.

## Decisions

### The panel is renamed, and two props are deleted rather than moved

`AssistantPanel` becomes `AIChatPanel` with `entity` in place of `currentPage`.

`activeFilters` and `onGoBack` are removed from its signature. Once the URL
holds filters the panel can read them itself, and "go back" is a route push
rather than a callback the page has to service. That deletes the ~15-line
`onGoBack` closure currently duplicated at `people-section.tsx:369` and at both
`event-list-view.tsx` mount sites, instead of duplicating it a fourth time in
3b.

### Filters are base64url, not base64

Plain base64 emits `+`, `/` and `=`, all of which are mangled or ambiguous in a
query string. `lib/assistant/filter-params.ts` encodes base64url with padding
stripped.

`decodeFilters` returns `null` for anything it cannot parse and never throws.
A filter param is attacker-controllable in the sense that any user can edit the
address bar, and a throw during render on the target page would be an unhandled
navigation failure rather than a bad filter.

Over 1500 encoded characters the param is omitted entirely and the handoff
falls back to the in-memory `presetFilters` the provider already carries. The
URL is an enhancement to the transport, never the transport itself.

### The URL hook avoids useSearchParams

`useSearchParams` in Next 14 forces the reading subtree into a Suspense
boundary. `components/auth/sign-in-form.tsx:46` already documents avoiding it
for exactly this reason.

`components/assistant/use-url-filters.ts` therefore reads `window.location.search`
on mount, holds the decoded value in state, writes through `router.replace` for
in-page filter edits and `router.push` for handoffs, and subscribes to
`popstate` so browser back and forward stay correct. Programmatic navigations
update the hook's own state directly, since `popstate` does not fire for them.

`replace` for edits is what keeps a filter change out of the history stack —
otherwise every keystroke-debounced facet toggle becomes a back-button step.

### sourceFilters is supplied at send time

The reducer has no router and no page access, which is why the field was stubbed.
The `send` action now carries the page's current filters, the user turn records
them, and `pendingHandoff` inherits a real value. The panel is the only thing
that knows them and it is already the thing that dispatches `send`.

### Cancel and failure re-ask rather than showing nothing

Spec 1 guarantees a `navigate` turn carries no rows — that guarantee is what
makes a wrong-entity answer unrepresentable, and it is not being weakened.

So there is no inline answer sitting in the turn to fall back to. Cancelling the
countdown, a route that fails to load, and a filter param that will not decode
all take the same path: re-send the question with `forceEntity` set to the
**target** entity and navigation suppressed. The target entity's adapter answers,
its binding renders the rows, and the result appears in the panel the user is
already looking at under a warning banner with an `[Open Events]` escape hatch.

The rows are still the target entity's, produced by the target entity's adapter.
Nothing crosses.

### A target with no binding shows the offer and stops there

Until 3b there is no `companies` binding, so a `navigate` decision aimed at
Companies has no client-side way to render rows even though the server-side
companies adapter can answer.

That case does not run a countdown, does not navigate, and does not re-ask. The
thread shows the entity badge and `handoffMessage` as an assistant bubble and
stops — an explanation of where the answer lives, with no false promise that
pressing something will fetch it. `hasBinding` remains the guard, exactly as it
guards the navigation effect today.

This is the one route the spec deliberately leaves incomplete, and 3b closes it
by registering the binding. Nothing else about the flow changes when it does.

### The countdown timer lives in the provider

The 1.5s delay before `router.push` is a `setTimeout` held in a ref inside the
provider's navigation effect, not inside the countdown component. Cancellation
and supersession are then reducer-and-ref operations rather than component
lifecycle, and the decision itself is a pure `supersede(state)` in `handoff.ts`
that a node test can drive.

A new `send` clears that ref and dispatches `cancel_handoff` before starting,
which is how rapid consecutive cross-entity questions cancel a pending
navigation instead of racing it.

## Architecture

### New modules

| Module | Purpose | Tested |
| --- | --- | --- |
| `lib/assistant/filter-params.ts` | `encodeFilters` / `decodeFilters`, base64url, size cap | yes |
| `components/assistant/use-url-filters.ts` | URL-backed filter state, `popstate`, replace vs push | no (React) |
| `components/assistant/handoff-countdown.tsx` | The 1.5s card with entity badge and Cancel | no (React) |
| `components/assistant/scroll-store.ts` | Thread scroll offset keyed by conversation and entity | yes |

### Changed modules

`components/assistant/ai-chat-panel.tsx` (renamed from `assistant-panel.tsx`)
- `entity` prop; `activeFilters` and `onGoBack` removed
- Back chip when `?from=` is present
- Warning banner slot for the cancel/failure path
- Scroll offset saved on scroll, restored in `useLayoutEffect`

`components/assistant/conversation-reducer.ts`
- Stores `handoffMessage`, which is currently parsed and dropped
- `send` accepts `sourceFilters`; `pendingHandoff.sourceFilters` becomes real
- `pendingHandoff.status`: `counting_down`, `navigating` or `cancelled`
- New actions `cancel_handoff` and `handoff_failed`

`components/assistant/handoff.ts`
- `supersede(state)` — what a new send does to a pending navigation
- `cancelToPhaseTwo(handoff)` — the in-place re-ask request
- `handoffUrl(handoff, cid)` — builds the target route with `q`, `filters`,
  `from` and `cid`
- `backUrl(handoff, cid)` — the source route with its restored filters

`components/assistant/assistant-provider.tsx`
- Owns `conversationId`, mirrored to the `cid` param and to sessionStorage
  under it
- Navigation effect gains the timer ref and the failure path

`components/assistant/assistant-message.tsx`
- `[Apply filters]` on the chip row, shown only when the turn's filters differ
  from what is live
- `confirm` renders `handoffMessage` as a question with buttons for
  `targetEntity` and `currentPage`; it creates no `pendingHandoff`, so nothing
  can navigate
- `navigate` renders the entity badge and the handoff bubble

`components/assistant/session-mirror.ts`
- Keyed by `conversationId` so a refresh or a pasted link rejoins its own thread
  rather than starting a fourth one

`components/search/query-store.ts`
- `SavedQuery.targetEntity`, inferred from `type` when absent so existing
  history keeps working (`lead_query` to companies, `event_query` to events,
  `people_query` to people)
- "View" opens that entity's route with the saved payload as `filters`

`app/api/assistant/chat/route.ts`
- Accepts `conversationId`: string, 64 characters or fewer, logged only

### The handoff URL

```
/app/events?q=<question>&filters=<base64url json>&from=people&cid=<id>
```

`from=companies` only becomes reachable in 3b. Until then the two live handoff
directions are People to Events and Events to People.

### Data flow, cancelled handoff

```
People page, user asks a trade-show question
  -> POST /api/assistant/chat
  -> route event: action=navigate, targetEntity=events, handoffMessage
  -> reducer opens pendingHandoff, status=counting_down, sourceFilters set
  -> panel renders the Events badge, the message, "Opening Events..." + Cancel
  -> provider arms setTimeout(1500)

[Cancel pressed, or the route/decode fails]
  -> timer cleared, dispatch cancel_handoff
  -> POST /api/assistant/chat with forceEntity=events and presetFilters,
     navigation suppressed
  -> events adapter answers; events binding renders the rows
  -> panel shows the warning banner and an "Open Events" button
```

## Error handling

| Failure | Behaviour |
| --- | --- |
| `filters` param will not decode | Treated as absent; page loads with its own filters; warning banner |
| `filters` param exceeds the cap | Never written; in-memory `presetFilters` carries the handoff |
| Target route fails to load | Stay put, re-ask in place, warning banner |
| New question during countdown | Timer cleared, `cancel_handoff`, new turn starts |
| Target entity has no binding (companies, until 3b) | Badge and `handoffMessage` only; no countdown, no navigation, no re-ask |
| sessionStorage full or blocked | Thread stays in memory; scroll offsets silently lost |
| `cid` present but no stored thread | Fresh thread under that id |

## Testing

Node/vitest only — the repo has no jsdom, RTL or Playwright, and this spec does
not add any. React components stay thin and untested, which is the reason every
decision above was pushed into a pure module.

- `filter-params` — round-trip, base64url alphabet, garbage returns null,
  oversize is omitted
- `handoff` — `supersede`, `cancelToPhaseTwo`, `handoffUrl`, `backUrl`
- `conversation-reducer` — `handoffMessage` retained, `sourceFilters` populated,
  `cancel_handoff`, `handoff_failed`, status transitions
- `scroll-store` — key isolation across entity and conversation
- `query-store` — `targetEntity` inference for pre-existing entries

### Known coverage gap

The countdown's timing, the `popstate` subscription and the scroll restoration
are React and browser behaviour with no test harness here. Their pure inputs are
covered; their wiring is not. This is the same gap Spec 2a accepted.

## Follow-on work

Spec 3b — Companies migration: the `companies` binding, consolidating the four
loose filter `useState`s into one `CompanyQueryState`, deleting `runAsk`,
`eventSearch`, `askUnavailable`, `handleEventPageChange` and the inline
trade-show pane, then removing `/api/companies/ask` and `/api/events/search`
once provably unreferenced. `models/ai-event-query.ts`, `models/event-query.ts`
and `lib/find-shows/filter-events.ts` are believed to exist only for that page;
3b verifies zero callers before deleting rather than assuming it.
