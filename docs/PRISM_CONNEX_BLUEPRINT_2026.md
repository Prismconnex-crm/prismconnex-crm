# Prism Connex CRM: AI-Native Trade Show CRM Blueprint 2026

Prepared: 16 May 2026  
Audience: Founder, investor, product, engineering, and go-to-market team  
Positioning: Compliance-safe product strategy with current implementation status separated from roadmap intent

## 1. Executive Summary

Prism Connex is an AI-native, event-to-revenue CRM for the global trade show industry. The product should not be positioned as only another Apollo, HubSpot, or Pipedrive alternative. Its strongest wedge is narrower and more defensible: it turns trade show discovery into target accounts, contacts, outreach, meetings, deals, event ROI, and repeatable revenue operations.

The current project already has a serious foundation:

- Next.js 14 full-stack application with TypeScript, Tailwind, Radix UI, Framer Motion, Recharts, Prisma, AWS Cognito wiring, Mapbox usage, CSV tooling, and `next-intl`.
- A current 16-module CRM shell covering Dashboard, Events, Target Events, Companies, People, Leads, Deals, Sequence Studio, Automation, Analytics, AI Copilot, Integrations, Deliverability, Team, Settings, and Audit Log.
- Event intelligence catalog data from Eventseye import workflows, currently represented by a seed catalog of 9,771 trade show records.
- A large local company intelligence dataset in development, with 34,598,800 company rows in the local SQLite database and 21,000 static public company records.
- Backend foundations for multi-tenant workspaces, roles, leads, lead-to-deal conversion, import/export routes, audit logs, localization, and onboarding.

The product should now move from a polished demo-plus-foundation into a durable MVP with explicit boundaries:

- Keep live claims honest.
- Convert mock/demo screens into API-backed workflows.
- Use compliant enrichment providers and user-authorized imports instead of private scraping.
- Build a practical event-to-revenue workflow before expanding every persona feature.

## 2. Updated Product Mission

Build the operating system for trade show revenue teams.

Prism Connex helps exhibitors, organizers, service providers, attendees, and revenue teams answer five questions in one place:

1. Which trade shows should we target?
2. Which companies and people should we approach?
3. What message should we send before, during, and after the event?
4. Which leads converted into deals?
5. What was the profit, margin, and ROI from each event?

The core product loop is:

Event discovery -> target list -> company and people intelligence -> lead capture -> sequence -> meeting -> deal -> profit and ROI analytics.

## 3. Current Project Reality

This section should be used internally and in investor conversations. It prevents overclaiming while still showing that the project has real traction.

### Live or substantially implemented

- Next.js app shell and public marketing pages.
- Responsive CRM navigation with 16 modules.
- Localized routing and language files.
- Workspace preference storage for locale, timezone, currency, and UI preferences.
- AWS Cognito service wiring and local session fallback for MVP/demo authentication.
- Prisma schema with workspace-scoped SaaS entities.
- Companies API with pagination, filtering, and local database-backed search.
- Leads API, lead service, lead repository, and lead-to-deal conversion flow.
- Audit logging foundation.
- CSV import/export route structure.
- Eventseye import script and find-shows catalog.
- Public Find Shows pages and in-app Events/Target Events experience.

### Strong UI but still partially demo-backed

- People/contact intelligence.
- Sequence Studio.
- Automation.
- AI Copilot.
- Integrations.
- Deliverability.
- Team management.
- Deals economics UI.
- Analytics dashboards.
- Organizer, attendee, and service provider workflows.

### Planned or needs production wiring

- Production PostgreSQL deployment.
- Production Cognito-only authentication flow.
- Real email delivery through Resend, Mailgun, SES, or another provider.
- Sequence scheduler and queue worker.
- OpenAI API integration for actual AI Copilot responses and email drafts.
- Provider-based company/contact enrichment.
- Consent, source, suppression, and retention controls.
- Subscription billing.
- Production observability, monitoring, backups, and deployment runbooks.

## 4. The Four Personas

### Exhibitors

Primary commercial persona for MVP.

Key jobs:

- Discover relevant trade shows.
- Build target account lists by industry, location, size, and event.
- Find buyer contacts and company context.
- Launch compliant pre-event and post-event outreach.
- Capture booth leads.
- Convert qualified leads into deals.
- Track revenue, cost, margin, and ROI by event.

Priority modules:

- Events, Target Events, Companies, People, Leads, Deals, Sequence Studio, Analytics, AI Copilot.

### Organizers

Second major B2B persona.

Key jobs:

- Manage event profiles, exhibitors, sponsors, and attendee intelligence.
- Track exhibitor onboarding and sponsor deliverables.
- Understand attendee industries, companies, and locations.
- Provide better floor plan, ticket, and engagement workflows.

Priority modules:

- Event Dashboard, Exhibitor Portal, Venue Map Builder, Sponsor Management, Attendee Analytics.

### Service Providers

Marketplace-style persona for later phases.

Key jobs:

- Find upcoming events that need booth handling, logistics, electrical, AV, staffing, and installation support.
- Apply for jobs.
- Generate quotes and invoices.
- Build reviews and repeat work.

Priority modules:

- Event Calendar, Job Board, Client Directory, Invoice Generator, Review System.

### Attendees

Consumer-assisted and affiliate revenue persona for later phases.

Key jobs:

- Discover relevant events.
- Get tickets or partner offers.
- Plan hotels, food, transport, and nearby essentials.
- Track expenses.
- Network with exhibitors before and during events.

Priority modules:

- Discounted Tickets, Accommodation Finder, Event Schedule, Networking Tool, Expense Tracker.

## 5. Current 16 CRM Modules

| Module | Current role | Status |
|---|---|---|
| Dashboard | Executive KPIs, next actions, pipeline overview | UI strong, needs full live data |
| Events | Trade show catalog and event detail views | Catalog-backed, actions need persistence |
| Target Events | User-selected event shortlist | Local/client state, needs backend model |
| Companies | Apollo-style company intelligence | API-backed with large local dataset |
| People | Contact intelligence and profile workflow | Mostly UI/demo-backed |
| Leads | Lead workflow and conversion foundation | Backend-supported MVP foundation |
| Deals | Pipeline and profit economics | UI strong, backend needs expansion |
| Sequence Studio | Email sequence builder | UI/demo-backed, scheduler needed |
| Automation | Workflow orchestration | UI/demo-backed, engine needed |
| Analytics | KPI and funnel reporting | UI strong, needs live aggregation |
| AI Copilot | Ask, draft, and action assistant | UI/demo-backed, OpenAI route needed |
| Integrations | Calendar, video, Slack, webhooks, storage | UI/demo-backed |
| Deliverability | Domain and sender health | UI/demo-backed, provider webhooks needed |
| Team | Roles and permissions | UI strong, backend wiring partial |
| Settings | Preferences and localization | Partially backend-backed |
| Audit Log | Security and accountability | Backend foundation exists |

## 6. Recommended Product Architecture

### Frontend

Keep the current stack:

- Next.js 14 App Router.
- TypeScript.
- Tailwind CSS.
- Radix UI primitives and existing local UI components.
- Framer Motion for restrained workflow motion.
- Recharts for dashboards.
- TanStack Table can be added later for editable import/export grids if needed.
- `next-intl` for global language support.

### Backend

Keep the existing MVC-style direction:

- Models: Zod DTOs and validation.
- Repositories: Prisma access with mandatory `workspaceId` boundaries.
- Services: business logic, RBAC, audit logging, and side effects.
- Controllers: Next.js API routes.
- Views: React components only responsible for display and interaction.

### Database

Current development database:

- SQLite through Prisma at `DATABASE_URL="file:./dev.db"`.

Production target:

- PostgreSQL, either Supabase, Neon, RDS, or another managed provider.
- Migrations should be written against PostgreSQL compatibility before production launch.
- Every tenant-owned table must preserve `workspaceId` isolation.

### AI

Replace the old fixed "GPT-4o only" language with "OpenAI API model selected by workflow." The current official OpenAI pricing page lists newer GPT-5.4 and GPT-5.4 mini pricing. The product should use a model router:

- Cost-efficient model for classification, rewrite, translation, and simple chat.
- Stronger model for complex account strategy, target list reasoning, and executive summaries.
- Tool/action approval layer before AI writes or sends anything.

Source: https://openai.com/api/pricing/

### Email and sequencing

Production email should be provider-abstracted:

- Resend or Mailgun for early transactional and campaign sending.
- AWS SES is a later option if the team wants deeper AWS alignment and lower high-volume cost.
- Store sender identity, unsubscribe state, suppression list, sequence steps, enrollment state, and provider event webhooks.

Sources:

- https://resend.com/pricing
- https://www.mailgun.com/pricing/

### Enrichment

Use a provider adapter pattern instead of hardcoding one vendor:

- Apollo for sales intelligence where plan and API access allow it.
- Proxycurl/Nubela should be treated cautiously because the pricing page now states the service has moved/no longer operates in the same way.
- Alternative providers can be evaluated later.
- User-authorized CSV imports and CRM imports should remain a first-class path.

Sources:

- https://docs.apollo.io/docs/api-pricing
- https://nubela.co/proxycurl/pricing.html

### Maps, travel, and accommodation

Current project already includes Mapbox dependencies and map components. Keep Mapbox for venue context unless Google Maps is required for specific Places/transport coverage.

- Mapbox: venue maps and event map visuals.
- Google Maps Platform: optional later for Places, routes, and local business context.
- Booking.com or travel affiliate APIs: optional after attendee monetization is validated.

Sources:

- https://www.mapbox.com/pricing
- https://mapsplatform.google.com/pricing

## 7. Compliance-Safe Data Strategy

Do not market Prism Connex as a private LinkedIn scraper. That creates legal, platform, and reputational risk.

Use this language instead:

- Compliant company and contact enrichment.
- User-authorized imports.
- Public-source event intelligence.
- Provider-backed business data.
- Data provenance, confidence scoring, and refresh timestamps.
- Suppression and unsubscribe controls.
- GDPR-ready export, deletion, and retention workflows.

Required controls:

- Store `source`, `sourceUrl`, `fetchedAt`, `confidence`, and `licenseType` where possible.
- Track enrichment provider, request cost, and allowed use.
- Show confidence and source transparency in UI.
- Add suppression checks before any campaign launch.
- Add audit logs for imports, exports, enrichment, bulk actions, and AI actions.
- Add workspace-level data retention settings.

## 8. What To Create Next

### 1. Target List Builder

Create the strongest MVP workflow:

- Start from an event or target event.
- Filter companies by category, size, region, and engagement score.
- Select accounts.
- Deduplicate by domain.
- Save as a target list.
- Push selected accounts into leads, people search, sequence audience, or export.

Why it matters:

- This turns the event catalog and company database into a clear revenue workflow.

### 2. Event ROI Command Center

For each event, track:

- Booth cost.
- Travel and accommodation.
- Vendor/service cost.
- Leads captured.
- Meetings booked.
- Deals opened.
- Deals won.
- Revenue, net profit, margin, and ROI.

Why it matters:

- This is the cleanest competitive difference from generic CRMs.

### 3. AI Copilot Action Engine

Convert the current Copilot UI into controlled backend actions:

- Ask: query CRM records and summarize.
- Draft: generate email copy and meeting summaries.
- Do: propose actions, require confirmation, then execute.

Initial safe actions:

- Draft email.
- Summarize company.
- Build target list preview.
- Create task.
- Create lead.
- Export CSV preview.

### 4. Sequence Backend

Make Sequence Studio real:

- Save sequence templates and steps.
- Enroll contacts or leads.
- Schedule email events.
- Enforce send windows, daily limits, and unsubscribe rules.
- Receive delivery, open, click, bounce, unsubscribe, and reply webhooks where provider supports them.

### 5. Contact Intelligence Layer

Move People from demo to real:

- Create contact API and repository.
- Link contacts to companies, events, target lists, leads, and sequences.
- Add verification status and enrichment source.
- Add merge/dedupe workflow.

### 6. Organizer Portal

After exhibitor MVP is useful:

- Event profile management.
- Exhibitor onboarding.
- Booth assignment data model.
- Sponsor tiers and deliverables.
- Attendee analytics dashboard.

### 7. Service Provider Marketplace

Later marketplace expansion:

- Event service jobs.
- Provider profiles.
- Quote and invoice flow.
- Reviews and repeat-hire signals.

### 8. Attendee Travel And Ticket Module

Later affiliate expansion:

- Event ticket links and promo code management.
- Hotel and transport recommendations.
- Nearby restaurants and local essentials.
- Expense tracker.

## 9. Action Roadmap

### Phase 0: Stabilize The Foundation - 1 to 2 weeks

Actions:

- Update product docs to match the actual app and remove overclaims.
- Decide production database target: Supabase Postgres, Neon, RDS, or self-hosted Postgres.
- Fix environment docs so dev SQLite and production PostgreSQL are not confused.
- Create a module status system: live, beta, demo, planned.
- Run and repair the test suite where needed.
- Verify Cognito production flow versus local demo session flow.
- Add a simple seed/reset workflow for demo data.

Success criteria:

- A new engineer can run the app and understand what is real.
- Investors can see honest progress without technical contradictions.

### Phase 1: Revenue MVP - 4 weeks

Actions:

- Build Target List model and API.
- Persist Target Events server-side instead of only in local state.
- Wire Dashboard, Deals, and Analytics to real API aggregations.
- Expand Deals backend for stage, amount, cost, profit, margin, ROI, close date, and owner.
- Expand Contacts backend and link contacts to companies.
- Make CSV import create companies, contacts, and leads with import history.

Success criteria:

- A user can go from event discovery to target list to lead to deal with persisted data.

### Phase 2: Event Intelligence - 4 to 6 weeks

Actions:

- Convert event seed data into database-backed event records.
- Add source, confidence, fetched date, official website, venue, city, country, category, and organizer.
- Add event refresh/import jobs.
- Add event-to-company matching where source data supports it.
- Keep exhibitor scraping/import in a staging flow with review, source, and permission checks.

Success criteria:

- Events are not just static catalog entries; they become pipeline objects.

### Phase 3: AI And Email Automation - 4 to 6 weeks

Actions:

- Add OpenAI API route with workspace permissions and audit logging.
- Implement prompt templates for event targeting, company summaries, and email drafts.
- Build sequence persistence and enrollment.
- Integrate one email provider first, preferably Resend for early simplicity or Mailgun for larger campaign tooling.
- Add suppression, unsubscribe, rate limits, and send-window controls.

Success criteria:

- A user can generate a compliant event outreach sequence and send a controlled test campaign.

### Phase 4: Enrichment And Data Quality - 4 to 6 weeks

Actions:

- Add enrichment provider abstraction.
- Add provider usage/cost tracking.
- Add data provenance fields and refresh timestamps.
- Add duplicate detection for companies and contacts.
- Add workspace-level privacy and retention policies.

Success criteria:

- Enrichment is useful, traceable, and defensible.

### Phase 5: Monetization And Enterprise Readiness - 6 to 8 weeks

Actions:

- Add Stripe subscriptions and plan limits.
- Add workspace billing state.
- Add role-based feature gates.
- Add audit export.
- Add monitoring, error tracking, and deployment checklist.
- Add backup and recovery runbook.

Success criteria:

- Prism Connex can be sold to early customers without manual back-office work for every account.

## 10. Pricing And Resource Plan

Pricing was checked from official vendor pages on 16 May 2026. Treat all numbers as planning estimates, not fixed commitments.

| Service | Current official signal | MVP recommendation |
|---|---:|---|
| Vercel | Pro listed at USD 20/mo plus usage | Use for hosting until backend load requires split services |
| Supabase | Pro from USD 25/mo | Good PostgreSQL candidate, but do not claim Supabase Auth if using Cognito |
| AWS Cognito | 10,000 MAU free tier for user pools in Lite/Essentials | Keep if AWS auth remains the production path |
| OpenAI API | GPT-5.4 mini listed at USD 0.75 input / USD 4.50 output per 1M tokens | Use cost router; avoid hardcoding GPT-4o in new docs |
| Resend | Pro USD 20/mo with 50,000 emails/mo | Best early provider for simple product email and light campaigns |
| Mailgun | Foundation shown around EUR 32/mo for 50,000 emails/mo in official regional page | Consider when campaign deliverability tooling is priority |
| n8n | Starter 20 EUR/mo annually; Pro 50 EUR/mo annually | Optional; self-host or delay if custom automation engine is built |
| Apollo | API access depends on plan and credits | Use only after ICP and enrichment ROI are validated |
| Proxycurl/Nubela | Page states Proxycurl has moved/no longer operates as before | Do not make it a fixed dependency |
| Mapbox | Pay-as-you-go with meaningful free tiers by product | Keep for current map components |
| Stripe | Standard cards shown at 2.9% + 30c in US | Use for subscriptions and invoices |
| AWS S3 | Usage-based storage and request pricing | Use for attachments, exports, and imports later |

Official pricing sources:

- Vercel: https://vercel.com/pricing
- Supabase: https://supabase.com/pricing
- AWS Cognito: https://aws.amazon.com/cognito/pricing
- OpenAI: https://openai.com/api/pricing/
- Resend: https://resend.com/pricing
- Mailgun: https://www.mailgun.com/pricing/
- n8n: https://n8n.io/pricing/
- Apollo API: https://docs.apollo.io/docs/api-pricing
- Proxycurl/Nubela: https://nubela.co/proxycurl/pricing.html
- Mapbox: https://www.mapbox.com/pricing
- Stripe: https://stripe.com/pricing
- AWS S3: https://aws.amazon.com/s3/pricing

### Monthly cost estimate by stage

| Stage | Expected monthly range | Notes |
|---|---:|---|
| Bootstrap demo | USD 0 to 75 | Vercel free/pro, local SQLite, low email/AI usage |
| MVP pilot | USD 100 to 300 | Hosted Postgres, Vercel Pro, Resend/Mailgun, OpenAI usage |
| Growth beta | USD 300 to 900 | Enrichment credits, monitoring, storage, higher email volume |
| Scale | USD 1,000+ | Dedicated database, queue workers, higher AI/email/enrichment volume |

## 11. Monetization Strategy

Keep pricing simple until usage data proves otherwise.

| Plan | Price target | Best for | Limits |
|---|---:|---|---|
| Free | USD 0 | Demos and small trials | 50 contacts, 25 emails/mo, 1 user, limited event tracking |
| Starter | USD 29/mo | Solo exhibitor or small service team | 1,000 contacts, 500 emails/mo, 4 users |
| Professional | USD 79/mo | Exhibitor sales team | 10,000 contacts, 5,000 emails/mo, AI Copilot, event ROI |
| Business | USD 149 to 249/mo | Multi-user event revenue teams | Advanced sequences, enrichment credits, analytics |
| Enterprise | Custom | Organizers and large teams | SSO, custom limits, compliance, dedicated support |

Add-ons:

- Enrichment credits.
- Additional email volume.
- Extra workspace seats.
- Advanced analytics.
- Organizer portal.
- Service provider marketplace access.
- Attendee travel/ticket affiliate package.

## 12. Competitive Edge

Prism Connex should compete by being specialized, not by copying every general CRM feature.

| Capability | Prism Connex direction | Generic CRM weakness |
|---|---|---|
| Trade show database | Native event discovery and target events | Usually external spreadsheet or plugin |
| Event ROI | Revenue, cost, margin, and ROI by event | Often generic pipeline only |
| Pre-event targeting | Event-to-account workflows | Requires manual list building |
| Post-event follow-up | Sequences tied to event context | Generic automation lacks event context |
| Data transparency | Source, confidence, fetched date | Many tools hide provenance |
| Personas | Exhibitors, organizers, attendees, service providers | Usually sales-only |
| Compliance controls | Suppression, audit, approvals | Often scattered across tools |

## 13. Risks And Controls

| Risk | Control |
|---|---|
| Overclaiming AI or integrations | Use module status labels and honest roadmap language |
| Scraping or terms-of-service exposure | Use compliant enrichment, official APIs, user-authorized imports, and public-source rules |
| Email deliverability damage | Add domain authentication, rate limits, warmup guidance, suppression, unsubscribe, bounce handling |
| Data leakage across workspaces | Enforce `workspaceId` in repositories and tests |
| Large dataset performance | Add indexes, pagination, caching, and production database planning |
| AI taking unsafe actions | Require confirmation, permissions, and audit logs |
| Cost overrun | Track provider usage per workspace and cap enrichment/email/AI limits by plan |

## 14. 30-Day Execution Checklist

Week 1:

- Publish this blueprint and align the team.
- Add current/planned badges to modules.
- Choose production database path.
- Fix environment documentation.
- Confirm test status.

Week 2:

- Add Target List model and API.
- Persist Target Events server-side.
- Add basic deal economics API.
- Start replacing demo data in Dashboard and Deals.

Week 3:

- Add Contacts API and company-contact linking.
- Improve CSV import into actual records.
- Add source/confidence fields where missing.
- Add initial suppression list model.

Week 4:

- Add OpenAI draft endpoint behind a feature flag.
- Add sequence save/load backend.
- Add email provider spike with test sending only.
- Prepare first pilot demo: event -> target list -> sequence draft -> lead -> deal -> ROI.

## 15. Final Positioning Statement

Prism Connex is an AI-native event-to-revenue CRM for trade show teams. It helps users discover global events, build target company lists, manage contacts and leads, automate compliant outreach, convert opportunities into deals, and measure revenue, profit, and ROI by event. The product already has a strong full-stack foundation and polished workflow coverage; the next milestone is converting the highest-value demo modules into production-backed workflows for exhibitor revenue teams.

