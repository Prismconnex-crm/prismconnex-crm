# Video Meetings Integrations Implementation Plan

> **Execution:** Native inline implementation in this session, as requested by the user.

**Goal:** Show Zoom, Google Meet, and Microsoft Teams directly in the Integrations Meetings area, connect provider accounts securely, and create real meeting links.

**Architecture:** Reuse existing tenant-scoped calendar OAuth/token refresh for Google and Microsoft, adding the Microsoft online-meeting scope. Add a Zoom OAuth connection using existing encrypted `IntegrationConnection` storage. Server endpoints create links through Google Calendar, Microsoft Graph, or Zoom and the Integrations UI displays provider status and the returned join URL.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, existing AES-GCM token helper, provider REST APIs, React client components.

**Spec:** `docs/superpowers/specs/2026-10-01-video-meetings-integration-design.md`

## Global Constraints

- OAuth passwords are entered only on the provider's own site; PrismConnex never collects them.
- Secrets and access/refresh tokens stay server-side; tokens at rest use `INTEGRATIONS_ENCRYPTION_KEY`.
- Connection reads and writes must be scoped by both `workspaceId` and `userId`.
- Microsoft Teams creation uses work/school accounts and delegated `OnlineMeetings.ReadWrite`; personal Microsoft accounts are unsupported.
- Do not install dependencies, run builds, seeds, benchmarks, or database optimizations.
- Do not add or run tests unless the user asks; inspect the running dev page for the requested visible output.

## Review Focus

- Missing provider credentials: show exactly which environment variable names are missing and disable only that provider's Connect action.
- Invalid or expired tokens: refresh once when possible; otherwise show a reconnect message without leaking provider responses or tokens.
- Google conference creation is asynchronous: do not show a success URL while the conference request is still pending or failed.
- Microsoft personal Outlook accounts cannot create online meetings: explain the work/school account requirement.
- Zoom's host `start_url` is private: expose only the participant `join_url`.

## File Map

- `components/crm/integrations-section.tsx` — visible provider rows, status, connection actions, meeting form, and result UI.
- `lib/integrations/calendar/providers.ts` — add the Teams delegated scope to the existing Microsoft OAuth request.
- `lib/integrations/calendar/api.ts` and `services/calendar-integration.service.ts` — Google Meet event creation and Teams online-meeting creation with the existing token refresh and audit pattern.
- `lib/integrations/meetings/providers.ts` — meeting provider metadata and Zoom configuration/URL helpers.
- `lib/integrations/meetings/zoom.ts` — Zoom OAuth code exchange, refresh, identity lookup, and meeting creation.
- `app/api/integrations/meetings/route.ts` — tenant-scoped provider status.
- `app/api/integrations/meetings/zoom/connect/route.ts` and `app/api/integrations/meetings/zoom/callback/route.ts` — Zoom OAuth with encrypted state and server-side token persistence.
- `app/api/integrations/meetings/[provider]/route.ts` — validate and create provider meeting links.
- `.env.example` — document Zoom credentials and callback URL.

## Implementation Steps

### 1. Provider contract and status

- Define `MeetingProvider = "zoom" | "google_meet" | "microsoft_teams"` and provider metadata with the account type each provider supports.
- Implement `GET /api/integrations/meetings`: resolve the tenant; report configuration, connection state, and missing variable names for Zoom, Google, and Microsoft. Use existing calendar connections for Google and Microsoft and the `video` category row for Zoom.
- Keep all response types safe for the browser: omit client secrets, tokens, and provider error bodies.

### 2. OAuth connections

- Add Zoom client ID, client secret, callback URI, authorization URL, token endpoint, and meeting scope helpers.
- Add a short-lived, HTTP-only encrypted state cookie bound to the initiating user/workspace; exchange the code server-side and save the Zoom tokens encrypted as category `video`, provider `zoom`.
- Reuse existing Google Calendar OAuth for Google Meet and existing Microsoft 365 OAuth for Teams. Add `OnlineMeetings.ReadWrite` to Microsoft scopes and keep provider-hosted sign-in/consent.
- Give missing credentials and cancelled consent a safe redirect back to Integrations with provider-specific status text.

### 3. Meeting creation API

- Add `POST /api/integrations/meetings/[provider]` with a shared Zod schema: non-empty title (max 160 chars), future ISO start time, duration from 15 to 180 minutes, and a valid IANA time zone.
- Use existing `CalendarIntegrationService` token refresh for Google Meet and Teams. Google inserts a primary-calendar event with a fresh conference request ID, `conferenceDataVersion=1`, no guests, and returns only a successfully generated video entry point. Teams posts to Graph `/me/onlineMeetings` and returns `joinWebUrl`.
- For Zoom, load the tenant's `zoom` row, refresh its token once when expired, call the user's meetings endpoint, and return only `join_url`.
- Return a normalized `{ provider, title, joinUrl, startAt, durationMinutes }` result; map provider failures to safe actionable messages.

### 4. Integrations UI and configuration

- Replace the Video Meetings placeholder with visible Zoom, Google Meet, and Microsoft Teams rows inside the Meetings category. Each row shows Not configured, Not connected, or Connected and an appropriate Connect/Reconnect action.
- Provide a Create meeting link form for connected providers with title, date/time, duration, time zone, and connected-provider selection.
- Show the resulting join link with Copy and Open actions. Keep the Zoom host URL server-only.
- Handle callback outcomes and API errors in the existing Integrations banner; refresh provider status after each connection or creation.
- Document `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, and `ZOOM_VIDEO_REDIRECT_URI` in `.env.example`, plus the exact local callback URI and Zoom scope.

### 5. Browser preview

- Let the existing Next dev server recompile the changed route and component.
- Open `/app/integrations`, select Meetings, and confirm the three provider names are visible with honest setup/connection states. Do not attempt provider sign-in without the user's credentials and configured provider apps.
