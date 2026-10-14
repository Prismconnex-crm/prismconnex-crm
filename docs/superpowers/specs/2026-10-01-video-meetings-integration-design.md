# Video Meetings Integrations — Design

**Date:** 2026-10-01  
**Status:** Approved for implementation  
**Scope:** Working meeting-link creation for Zoom, Google Meet, and Microsoft Teams from Integrations.

## Problem

The Integrations page has a Video Meetings tile with a non-functional Connect button. Users cannot choose a provider, authorize an account, or create a real meeting link.

## Goals

- Let a user connect Zoom, Google Meet, or Microsoft Teams through the provider's own OAuth sign-in and consent page.
- Create a real meeting with a title, start date/time, duration, and time zone.
- Return the join URL with Copy and Open actions.
- Keep provider tokens encrypted and scoped to the signed-in user and workspace.
- Show connection state and understandable setup, authorization, and API errors.

## Non-goals

- Collecting or storing Google, Microsoft, or Zoom passwords in PrismConnex.
- Sending calendar invitations or adding attendees in this first version.
- Storing a meeting history in PrismConnex; the first version returns the created meeting link to the user without adding a meeting-record table.
- Recording, joining, transcribing, or managing live meetings.

## Decisions

### Provider sign-in stays on the provider

The Connect action starts OAuth and redirects the browser to the chosen provider. Password entry and consent happen on that provider's domain. The app receives an authorization code, exchanges it server-side, and stores only encrypted tokens. Provider passwords never pass through PrismConnex.

### Google Meet uses the connected Google Calendar account

Google Meet links are created by inserting an event on the user's primary Google Calendar with a unique `conferenceData.createRequest` and `conferenceDataVersion=1`. Google creates conference details asynchronously, so the service must handle a pending conference request before reporting a usable join URL. The event is created without invitees in this release.

Use the existing Google OAuth client and encrypted `google` calendar connection. If there is no Google connection, Connect Google Meet starts the existing Google Calendar OAuth flow. The resulting account is shared with Calendar Sync because both features use the same Google Calendar permission. [Google Calendar create-events guide](https://developers.google.com/workspace/calendar/api/guides/create-events?authuser=5)

### Teams uses Microsoft work or school accounts

Use Microsoft Graph `POST /me/onlineMeetings` with delegated `OnlineMeetings.ReadWrite`. Personal Microsoft accounts are not supported for this endpoint. The existing Microsoft OAuth client and encrypted `microsoft365` calendar connection are reused; connecting Teams requests the additional delegated scope and replaces the stored token after consent. The Teams connection therefore shares account identity with Calendar Sync. [Microsoft Graph create onlineMeeting](https://learn.microsoft.com/en-us/graph/api/application-post-onlinemeetings?view=graph-rest-1.0)

### Zoom uses its own OAuth connection

Add an OAuth callback for Zoom and store its token in the existing `IntegrationConnection` table under category `video` and provider `zoom`. Request only the meeting-creation scope, `meeting:write:meeting`. Create a scheduled meeting through Zoom's meeting API and return its participant join URL. Never return or display Zoom's host-only start URL. [Zoom OAuth scopes](https://developers.zoom.us/docs/integrations/oauth-scopes-granular/) · [Zoom Meetings API](https://developers.zoom.us/docs/api/meetings/)

### Meeting creation flow

1. The Meetings category shows Zoom, Google Meet, and Microsoft Teams directly in the Video Meetings area, each with its configuration and connection state. Provider choices are visible without opening another picker.
2. Clicking Connect starts that provider's OAuth flow. After at least one provider is connected, the area offers Create meeting link. The form requires a title, start time, duration, and time zone.
3. The server validates the request, refreshes the provider token if needed, creates the meeting using that provider's API, and returns the join URL.
4. The result shows provider, title, and join URL with Copy and Open actions. A failed provider call shows an actionable error and does not claim a link was created.

For Google Meet, surface the conference URL only after the conference request succeeds. For Zoom, surface only the participant `join_url`. For Teams, use the returned `joinWebUrl`.

### Storage and tenant isolation

Use the existing `IntegrationConnection` persistence and token encryption. Google and Microsoft use their existing `calendar` category rows; Zoom uses a `video` category row. Every lookup and mutation remains scoped by both `workspaceId` and `userId`. No database migration is expected because the existing model stores category and provider as strings and Zoom has no existing provider row.

### Configuration requirements

- Reuse `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `INTEGRATIONS_ENCRYPTION_KEY` for Google Meet. The Google Cloud project must have the Calendar API enabled and the existing Google OAuth consent configured.
- Reuse `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and `INTEGRATIONS_ENCRYPTION_KEY` for Teams. Add delegated `OnlineMeetings.ReadWrite` to the Entra app and register the meeting callback URI if a dedicated callback is used.
- Add server-only `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, and optional `ZOOM_VIDEO_REDIRECT_URI`. Register the matching callback URL and grant the Zoom meeting-creation scope in the Zoom app.

If required provider credentials are absent, show their variable names inline in the Meetings area and keep Connect disabled. Secrets are never sent to the browser.

## Acceptance criteria

- The Meetings category visibly lists Zoom, Google Meet, and Microsoft Teams without requiring the user to open a separate provider picker.
- Each configured provider can complete its provider-hosted OAuth flow and returns to Integrations with its connection state updated.
- Each connected provider can create a real scheduled meeting and return a provider-valid join URL.
- Copy and Open operate on the participant join URL, never a host-only URL.
- Missing configuration, cancelled consent, expired tokens, unsupported Microsoft personal accounts, and provider API errors are shown without leaking tokens or provider secrets.
- All token storage and API access remain tenant-scoped and server-side.
