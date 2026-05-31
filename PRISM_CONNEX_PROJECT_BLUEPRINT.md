# Prism Connex CRM - Complete Project Blueprint

Prepared on: 16 May 2026  
Project folder: `C:\Users\DELL\OneDrive\Documents\Desktop\Prismconnex CRM`

## 1. Simple Explanation

Prism Connex CRM is an AI-powered trade show CRM platform.

The main idea is simple:

> A user should be able to find trade shows, find companies attending those shows, find people inside those companies, contact them through email sequences, capture leads, convert leads into deals, and calculate profit from each event.

This makes Prism Connex different from normal CRMs. Normal CRMs mostly manage contacts and deals. Prism Connex should manage the full trade show business workflow:

Event discovery -> target companies -> contacts -> outreach -> leads -> deals -> revenue -> profit and ROI.

## 2. Best Product Positioning

The best positioning is:

> Prism Connex is an AI-native event-to-revenue CRM for exhibitors, organizers, attendees, and trade show service providers.

Do not describe it only as an Apollo, HubSpot, or Pipedrive clone. Those tools are broad CRMs or sales databases. Prism Connex should win by focusing deeply on the trade show industry.

## 3. Who Will Use Prism Connex

| User type | What they need | Important features |
|---|---|---|
| Exhibitors | Find events, contact buyers, capture booth leads, close deals | Events, Companies, People, Leads, Deals, Sequences, ROI Calculator |
| Organizers | Manage events, exhibitors, sponsors, and attendees | Event Dashboard, Exhibitor Portal, Sponsor Management, Venue Map |
| Service Providers | Find trade show jobs and clients | Job Board, Client Directory, Invoice Generator, Reviews |
| Attendees | Plan event visits and connect with exhibitors | Tickets, Hotels, Event Schedule, Networking, Expense Tracker |

The first commercial focus should be Exhibitors because they have the clearest business value and will pay faster.

## 4. What Already Exists In The Project

The current project is already a real Next.js CRM application. It is not only an idea document.

Important existing project facts:

- The project uses Next.js 14, React 18, TypeScript, Tailwind CSS, Radix UI, Framer Motion, Recharts, Prisma, AWS Cognito wiring, Mapbox, and `next-intl`.
- The app has public pages for home, product, pricing, security, and find-shows.
- The CRM dashboard has 16 main app sections.
- The project has a Prisma database schema with users, workspaces, companies, contacts, leads, deals, events, sequences, tasks, imports, exports, email events, and audit logs.
- The local development database uses SQLite.
- The production target should be PostgreSQL.
- The project already has Eventseye import tooling and a trade show catalog.
- The current seed event catalog contains 9,771 trade show records.
- The local company database contains 34,598,800 company records.
- There is also a static company JSON file with 21,000 company records.

## 5. Current 16 CRM Dashboard Tabs

| No. | Tab | What it should do | Current status |
|---:|---|---|---|
| 1 | Dashboard | Show KPIs, pipeline, revenue, and next actions | UI exists, needs more live data |
| 2 | Events | Browse global trade shows | Catalog exists |
| 3 | Target Events | Save important events to focus on | UI exists, needs backend saving |
| 4 | Companies | Search company database like Apollo | API-backed with local database |
| 5 | People | View employee/contact details | Mostly demo UI |
| 6 | Leads | Manage leads and lead stages | Backend foundation exists |
| 7 | Deals | Track deals and profit | UI exists, backend needs expansion |
| 8 | Sequence Studio | Build email drip campaigns | UI exists, sending backend needed |
| 9 | Automation | Automate workflows | Demo UI |
| 10 | Analytics | Show revenue, conversion, and ROI charts | UI exists, needs live calculations |
| 11 | AI Copilot | Ask AI, draft emails, suggest actions | Demo UI, OpenAI API needed |
| 12 | Integrations | Connect calendar, video, Slack, storage | Demo UI |
| 13 | Deliverability | Check email domain and sender health | Demo UI |
| 14 | Team | Manage team members and roles | UI exists, backend partial |
| 15 | Settings | Manage language, currency, timezone, theme | Partly working |
| 16 | Audit Log | Track important user actions | Backend foundation exists |

## 6. What Is Real And What Is Still Planned

### Real or mostly real today

- CRM app shell.
- Public marketing pages.
- Multi-language routing and language files.
- Workspace preference structure.
- Companies API with pagination and filters.
- Large local company database.
- Event catalog and Eventseye import script.
- Lead API and lead-to-deal conversion logic.
- Prisma schema for CRM data.
- Audit log foundation.
- CSV import/export route structure.
- AWS Cognito-related auth service files.

### Good UI but not fully connected yet

- AI Copilot.
- Sequence Studio.
- Automation.
- Deliverability.
- Integrations.
- People/contact intelligence.
- Deals profit analytics.
- Team permissions UI.
- Organizer, attendee, and service provider workflows.

### Must be built for production

- PostgreSQL production database.
- Proper production authentication flow.
- Real email sending provider.
- Real sequence scheduler.
- OpenAI API integration.
- Contact enrichment provider integration.
- Subscription billing.
- Monitoring, backups, and error tracking.
- Data privacy and compliance controls.

## 7. Recommended Product Strategy

Do not try to build every feature at once.

The best first product should focus on this workflow:

1. User finds a trade show.
2. User saves it as a Target Event.
3. User finds companies related to that event or industry.
4. User creates a Target List.
5. User finds or imports contacts.
6. User writes an AI-assisted email sequence.
7. User sends or exports outreach.
8. Replies become leads.
9. Leads become deals.
10. Deals calculate revenue, cost, profit, margin, and ROI.

This is the strongest MVP because it clearly connects trade shows to revenue.

## 8. Most Important Features To Create Next

### 1. Target List Builder

Create a real backend feature where users can save selected companies into a list.

Actions to perform:

- Create `TargetList` and `TargetListItem` database models.
- Add API routes for creating, updating, deleting, and viewing target lists.
- Allow users to create a target list from Events, Target Events, and Companies.
- Add deduplication by company domain.
- Add export to CSV.

Why it matters:

This connects the event database and company database into one useful sales workflow.

### 2. Target Events Backend

Currently target events are mainly UI/local behavior. They should be saved in the database.

Actions to perform:

- Create a `SavedEvent` or `TargetEvent` model.
- Save event slug, workspace ID, user ID, notes, priority, and status.
- Add filters for upcoming, active, completed, and high-priority events.

Why it matters:

Users need a serious event planning workspace, not only a temporary UI selection.

### 3. Event ROI Command Center

Create an event-level profit calculator.

Actions to perform:

- Track booth cost.
- Track travel cost.
- Track hotel cost.
- Track service provider cost.
- Track leads captured.
- Track meetings booked.
- Track deals opened.
- Track won revenue.
- Calculate net profit, margin, and ROI.

Why it matters:

This is one of the strongest differentiators against normal CRMs.

### 4. Contacts And People Backend

The People tab should become real.

Actions to perform:

- Add contact list API.
- Link contacts to companies.
- Add contact source, confidence score, email status, phone, title, LinkedIn URL if user provides or provider legally supplies it.
- Add duplicate detection.
- Add "Add to Sequence" and "Add to Lead" actions.

Important:

Do not market this as illegal LinkedIn scraping. Use compliant enrichment, approved APIs, and user-authorized imports.

### 5. AI Copilot Backend

The AI Copilot should become a controlled assistant.

Actions to perform:

- Add OpenAI API route.
- Add prompts for company summary, target list suggestion, email draft, follow-up email, and meeting summary.
- Add permission checks before AI performs actions.
- Add confirmation before AI creates records, exports data, or starts campaigns.
- Log AI actions in Audit Log.

Why it matters:

AI should help users work faster, but it should not perform risky actions without approval.

### 6. Email Sequence Backend

Sequence Studio should become a working outreach system.

Actions to perform:

- Save sequence templates.
- Save sequence steps.
- Enroll contacts.
- Schedule email events.
- Add unsubscribe and suppression checks.
- Add sending provider integration.
- Track sent, opened, clicked, bounced, replied, and unsubscribed events.

Recommended early provider:

- Resend for simpler early sending.
- Mailgun if campaign and deliverability tooling becomes more important.
- AWS SES later if cost and AWS infrastructure alignment become priorities.

### 7. Deals And Profit Backend

The Deals tab should calculate business outcome clearly.

Actions to perform:

- Add deal stages: Prospecting, Contacted, Qualified, Proposal, Negotiation, Won, Lost.
- Add amount, cost, expected profit, actual profit, margin, and ROI.
- Link deals to event, company, contact, lead, owner, and source.
- Show expected versus actual profit.

### 8. Organizer Portal

This should be Phase 2 or Phase 3 after exhibitor workflow works.

Actions to perform:

- Create organizer event dashboard.
- Add exhibitor onboarding.
- Add sponsor management.
- Add booth location assignment.
- Add attendee analytics.

### 9. Service Provider Marketplace

This should be later because it needs marketplace liquidity.

Actions to perform:

- Add service provider profiles.
- Add job board.
- Add quote and invoice generator.
- Add review system.
- Link jobs to events and organizers.

### 10. Attendee Travel And Tickets

This should be later because it depends on partnerships and affiliate integrations.

Actions to perform:

- Add ticket partner links.
- Add promo code system.
- Add hotel and travel recommendations.
- Add expense tracker.
- Add networking with exhibitors.

## 9. Compliance And Safety Rules

Prism Connex must avoid risky data claims.

Use these words:

- Compliant enrichment.
- Public event intelligence.
- User-authorized imports.
- Approved data providers.
- Source transparency.
- Confidence score.
- Audit logging.
- Suppression list.
- GDPR-ready controls.

Avoid these words in marketing:

- Illegal scraping.
- Private LinkedIn scraping.
- Guaranteed personal email for everyone.
- Fully automated bulk sending without approval.

Required safety features:

- Store data source.
- Store fetched date.
- Store confidence score.
- Add unsubscribe links.
- Add suppression list.
- Add export/delete controls.
- Add role-based permissions.
- Add audit logs for import, export, enrichment, AI actions, and bulk email.

## 10. Updated Tech Stack

| Area | Recommended stack |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS |
| UI Components | Radix UI and local UI components |
| Animation | Framer Motion |
| Charts | Recharts |
| Tables | Current tables now; TanStack Table later for editable imports |
| Database ORM | Prisma |
| Current dev database | SQLite |
| Production database | PostgreSQL |
| Authentication | AWS Cognito or another production auth provider |
| AI | OpenAI API |
| Email | Resend, Mailgun, or AWS SES |
| Maps | Mapbox now; Google Maps optional later |
| Storage | AWS S3 or equivalent |
| Automation | Custom backend first; n8n optional |
| Billing | Stripe |
| Hosting | Vercel or AWS deployment |

## 11. Pricing And Monthly Cost Estimate

Pricing changes over time. The following is a planning estimate based on official vendor pricing pages checked on 16 May 2026.

| Stage | Estimated monthly cost | What it includes |
|---|---:|---|
| Local development | USD 0 to 30 | Local SQLite, local app, limited API usage |
| Bootstrap demo | USD 30 to 100 | Vercel, low AI usage, basic email testing |
| MVP pilot | USD 100 to 300 | Hosted PostgreSQL, email provider, OpenAI, hosting |
| Growth beta | USD 300 to 900 | More email volume, enrichment credits, monitoring, storage |
| Scale | USD 1,000+ | Dedicated database, queue workers, high email/AI/enrichment usage |

Important vendor notes:

- Vercel Pro is listed at USD 20/month plus usage.
- Supabase Pro is listed from USD 25/month.
- OpenAI API cost depends on selected model and token usage.
- Resend Pro is listed at USD 20/month for 50,000 emails/month.
- Mailgun pricing depends on region and plan.
- n8n Cloud can be used later, but custom automation may be better for product control.
- Proxycurl/Nubela should not be treated as a fixed dependency because the public page now says Proxycurl has moved/no longer operates as before.

Official pricing references:

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

## 12. Suggested Subscription Plans

| Plan | Price | Best for | Suggested limits |
|---|---:|---|---|
| Free | USD 0 | Trial users | 50 contacts, 25 emails/month, 1 user |
| Starter | USD 29/month | Small exhibitor team | 1,000 contacts, 500 emails/month, 4 users |
| Professional | USD 79/month | Sales teams | 10,000 contacts, 5,000 emails/month, AI Copilot |
| Business | USD 149 to 249/month | Growing event revenue teams | Advanced analytics, team workflow, larger email limit |
| Enterprise | Custom | Organizers and large companies | Custom limits, compliance, onboarding, support |

Possible add-ons:

- Extra email volume.
- Extra enrichment credits.
- Extra users.
- Organizer portal.
- Attendee travel and ticket module.
- Service provider marketplace access.

## 13. Recommended Roadmap

### Phase 1: Stabilize and clarify - 1 to 2 weeks

Actions:

- Make documentation clear.
- Fix environment documentation.
- Confirm current app run process.
- Repair tests if failing.
- Add status badges: Live, Beta, Demo, Planned.
- Confirm production database choice.

Result:

The team understands exactly what exists and what still needs work.

### Phase 2: Revenue MVP - 4 weeks

Actions:

- Build Target Events backend.
- Build Target List Builder.
- Build Contacts API.
- Expand Deals backend.
- Connect Dashboard and Analytics to real records.
- Improve CSV import/export.

Result:

User can move from event discovery to target list to lead to deal.

### Phase 3: Email and AI - 4 to 6 weeks

Actions:

- Add OpenAI API backend.
- Add AI email draft.
- Add AI company summary.
- Save sequence templates.
- Add sequence enrollment.
- Add email provider test sending.
- Add unsubscribe and suppression controls.

Result:

User can create and test compliant outreach campaigns.

### Phase 4: Event Intelligence - 4 to 6 weeks

Actions:

- Store event catalog in database.
- Add event import refresh jobs.
- Add event source and confidence tracking.
- Add event-to-company matching where legal and available.
- Add exhibitor import review workflow.

Result:

Events become real CRM objects instead of only catalog records.

### Phase 5: Monetization and production - 6 to 8 weeks

Actions:

- Add Stripe billing.
- Add plan limits.
- Add production database.
- Add monitoring.
- Add backups.
- Add security review.
- Add deployment runbook.

Result:

The product becomes ready for pilot customers.

## 14. 30-Day Action Checklist

### Week 1

- Finalize project blueprint.
- Decide production database.
- Add feature status labels.
- Clean docs and setup instructions.
- Run tests and list failures.

### Week 2

- Build Target Events database saving.
- Build Target List database models.
- Add Target List API.
- Add company selection to target list.

### Week 3

- Build Contacts API.
- Link contacts to companies.
- Add CSV import into contacts and leads.
- Add basic duplicate detection.

### Week 4

- Add Deal profit fields.
- Add event ROI screen.
- Add AI draft endpoint behind a feature flag.
- Create first demo flow:
  Event -> Target List -> Contacts -> AI Email Draft -> Lead -> Deal -> ROI.

## 15. Best Demo Story

Use this story when explaining Prism Connex:

1. A company plans to exhibit at a trade show.
2. They open Prism Connex and search for relevant upcoming events.
3. They save 5 target events.
4. They open one event and build a target list of companies.
5. They find contacts from those companies.
6. AI Copilot writes a pre-event outreach email.
7. The team launches a controlled sequence.
8. Replies become leads.
9. Leads become deals.
10. The system calculates revenue, cost, profit, and event ROI.

This is the simplest way to show the full value of Prism Connex.

## 16. Final Clear Vision

Prism Connex should become the CRM built specifically for trade show revenue.

The product should help users:

- Find the right events.
- Find the right companies.
- Contact the right people.
- Capture and qualify leads.
- Convert leads into deals.
- Measure event profit.
- Use AI safely and practically.

The most important next action is to build the event-to-target-list-to-lead-to-deal workflow completely. After that, AI, email automation, organizer tools, attendee travel, and service provider marketplace features can be added with much stronger business value.

