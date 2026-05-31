# Prism Connex Guiding Document

Prepared from the current Prism Connex codebase on March 15, 2026.

This document is written so it can be pasted into Word and exported as a PDF for sales, onboarding, investor, and social media marketing use.

## 1. What Prism Connex Is

Prism Connex is an AI-native, multi-tenant, full stack CRM web application designed for the trade show, events, outreach, ticketing, attendee travel, and revenue operations ecosystem. It is built to help exhibitors, organizers, attendees, service providers, and global sales teams move from event discovery to lead generation, outreach, meetings, deals, analytics, and ROI tracking inside one platform.

In simple terms, Prism Connex is not only a CRM. It is an event-to-revenue operating system.

It combines:

- Event intelligence
- Company and people discovery
- Lead and deal tracking
- AI-assisted outreach
- Email sequencing
- Workflow automation
- Deliverability monitoring
- Team and role management
- Audit logging and compliance visibility
- Ticketing and travel support for attendee journeys
- Localization for global operations

## 2. Why Prism Connex Exists

Traditional CRMs are strong at storing records, but they are weak at handling the real trade show workflow. Trade show teams usually need to work across event lists, exhibitors, attendees, target accounts, contacts, follow-up sequences, meetings, travel planning, and ROI reporting. That workflow is fragmented across spreadsheets, email tools, calendars, messaging apps, and ticketing systems.

Prism Connex is built to solve that fragmentation.

Its purpose is to help teams answer these business questions in one place:

- Which event should we target next?
- Which exhibitors, attendees, sponsors, or service buyers match our ICP?
- Who should we contact first?
- What message should we send?
- How do we automate outreach without harming deliverability?
- Which leads converted into revenue?
- What was the profit, margin, and ROI from a specific event?

## 3. Who Prism Connex Serves

Prism Connex supports four major persona groups in the current product and marketing structure:

- Service Providers: teams handling jobs, quotes, reviews, repeat clients, and service delivery.
- Attendees: users who want event discovery, ticket access, travel planning, nearby essentials, and localized event support.
- Exhibitors: teams that need event discovery, target list building, sequences, meetings, deals, and ROI tracking.
- Organizers: teams that manage event operations, exhibitor onboarding, sponsor management, and attendee guidance.

From a business development angle, Prism Connex is especially suited for:

- B2B sales teams
- Event growth teams
- Corporate exhibitors
- Organizers and sponsor teams
- Partnership teams
- Revenue operations teams
- Support and admin teams

## 4. Where Prism Connex Operates

Prism Connex is built for global use.

The current project already reflects international orientation through:

- Six languages: English, German, French, Spanish, Portuguese, and Japanese
- Multiple time zones: America/New_York, Europe/London, Europe/Berlin, Asia/Kolkata
- Multiple currencies: USD, EUR, GBP, INR
- Global sample event coverage including Germany, UK, USA, and India
- Localization-aware onboarding and route handling

This means Prism Connex is positioned for:

- European markets
- United States markets
- India
- Worldwide trade show and event operations

Important note: the current released language set is 6 languages, but it does not yet include Hindi. If India-focused expansion is a goal, Hindi can be added as a future localization track.

## 5. How Prism Connex Works End to End

The core Prism Connex business flow is:

1. A user signs in or signs up.
2. The user completes onboarding and creates a workspace.
3. The workspace stores locale, time zone, currency, and traveler preferences.
4. The user enters the main CRM workspace.
5. The platform helps the user discover events and review source confidence.
6. From events, the user can identify exhibitors, companies, and contacts.
7. Those records feed into leads and target lists.
8. Leads can be nurtured through sequences, tasks, follow-ups, and AI recommendations.
9. Qualified leads can be converted into deals.
10. Deals track stage, amount, economics, margin, and ROI.
11. Analytics measure pipeline, outreach, and event performance.
12. Deliverability, audit logs, and RBAC keep the system secure and enterprise-ready.

That is the business story of Prism Connex: event -> target -> lead -> sequence -> meeting -> deal -> analytics -> ROI.

## 6. Core Product Services

From a product perspective, Prism Connex provides these major services:

- Event Intelligence Service
- Company Intelligence Service
- People and Contact Intelligence Service
- Lead Management Service
- Deal and Revenue Tracking Service
- Sequence and Email Outreach Service
- Workflow Automation Service
- AI Copilot Service
- Deliverability and Compliance Service
- Team, Roles, and Audit Service
- Ticketing and Travel Experience Service
- Localization and Preference Service

From the code architecture perspective, the currently implemented service layer includes:

- `AuthService`: handles sign-up, verification, and sign-in through AWS Cognito.
- `LeadService`: handles lead listing, creation, updating, and lead-to-deal conversion.
- `AuditService`: writes audit records for key actions.
- `resolveTenant`: resolves the current tenant workspace context.
- `authorize`: enforces RBAC by role.
- `preferences-store`: persists workspace localization preferences.

## 7. Full Stack Tech Stack

The current Prism Connex codebase uses the following stack:

- Frontend framework: Next.js 14 App Router
- UI runtime: React 18
- Language: TypeScript
- Styling: Tailwind CSS
- Component primitives: Radix UI
- Theme engine: `next-themes`
- Internationalization: `next-intl`
- Motion and transitions: Framer Motion
- Charts and analytics visuals: Recharts
- Forms and validation: React Hook Form and Zod
- Database ORM: Prisma
- Database: PostgreSQL
- Auth: AWS Cognito plus local session fallback for MVP/demo flows
- JWT/session utilities: `jose`, `aws-jwt-verify`
- CSV import/export support: PapaParse plus API export routes
- Cloud SDKs in project: AWS Cognito Identity Provider client and AWS S3 client
- Testing: Vitest and Playwright

## 8. Architecture and Backend Design

Prism Connex follows a structured MVC-style architecture adapted to Next.js App Router.

- Models: Zod schemas and DTOs in `/models`
- Repositories: Prisma query access in `/repositories`
- Services: business logic in `/services`
- Controllers: Next.js API routes in `/app/api`
- Views: React components in `/components`

This is important because it means Prism Connex is not only a visual frontend. It has a proper backend structure for growth, maintainability, and enterprise-level control.

### Multi-tenancy

Prism Connex is a multi-tenant SaaS application. Every major record is workspace scoped.

Entities currently designed with `workspaceId` boundaries include:

- Event
- Company
- Contact
- Lead
- Deal
- Sequence
- Task
- ImportJob
- ExportJob
- SequenceEnrollment
- EmailEvent
- AuditLog

This prevents cross-workspace data leakage and supports enterprise SaaS scaling.

### RBAC

The backend enforces role-based access control with these current backend roles:

- ADMIN
- SALES_REP
- SUPPORT
- VIEWER

The product UI also presents team-facing role labels such as Admin, Sales Rep, Support, and Viewer.

### Data Transparency

A defining Prism Connex product idea is record transparency. Several modules visibly present:

- Data source
- Fetched date
- Confidence score

This makes the system stronger for enterprise users who care about trust, compliance, and decision quality.

## 9. Database Model Snapshot

The current Prisma schema contains the main business entities required for a modern trade show CRM:

- User
- Workspace
- Membership
- WorkspaceSettings
- AuditLog
- Event
- Company
- Contact
- Lead
- Deal
- Sequence
- SequenceStep
- Task
- ImportJob
- ExportJob
- SequenceEnrollment
- EmailEvent

This schema is already suitable for a real SaaS CRM backbone.

## 10. Prism Connex App Tabs: Full 15-Module Explanation

The current in-app sidebar contains 15 modules, not 14.

### 1. Dashboard

The Dashboard is the executive control center. It shows an event-to-revenue overview with cards for new leads, replies, meetings booked, and forecast profit. It also includes upcoming events, AI next best actions, sequence performance, and a visual deal pipeline. For management teams, this is the fastest way to understand current business momentum.

### 2. Events

The Events module is the event intelligence engine. Users can browse event lists, filter by country, city, industry, and date, and inspect confidence scores. The event detail view includes exhibitor data, source transparency, venue context, summary panels, and CRM actions such as Add Event to CRM, Build Target List, and Create Campaign. This module is the top of the pipeline for trade show-driven revenue.

### 3. Companies

The Companies module acts like an Apollo-style company intelligence workspace. It supports company search, filters, source transparency, confidence scoring, company profile inspection, employee view, and actions such as Add to CRM, Create Deal, Start Sequence, and Add to List. It is designed to turn company records into pipeline-ready accounts.

### 4. People

The People module is the contact intelligence layer. It displays individual contacts with verification state, source, confidence score, country, role, and email. Users can perform bulk actions such as Verify Emails, Add to Sequence, Add to List, and Merge Duplicates. The right-side profile view also includes AI recommendations and data source metadata.

### 5. Leads

The Leads module tracks prospects coming from events, imports, and datasets. It includes KPI cards, lead pipeline stages, lead list management, confidence filtering, source filtering, and a detailed lead profile. Most importantly, it includes the lead-to-deal conversion flow, which is one of the strongest backend-supported workflows in the current MVP.

### 6. Deals

The Deals module is the commercial pipeline engine. It tracks deal stages such as Prospecting, Proposal, Negotiation, and Won. It also includes deal economics, revenue, booth cost, travel, accommodation, vendor services, net profit, margin, and ROI. This is where Prism Connex differentiates itself from many CRMs by connecting event activity directly to profitability.

### 7. Sequence Studio

Sequence Studio is the email sequencing workspace. Users can build multi-step outreach flows using emails, waits, and tasks. The editor includes subject tokens, personalization variables, smart actions such as AI Rewrite and Translate, sending settings, compliance controls, readiness scoring, and launch controls. This module is central to outbound follow-up and event-based outreach.

### 8. Automation

The Automation module provides workflow orchestration. It includes visual workflows like lead intake to owner assignment, reply received to stop sequence, deal won to ROI update, and import completed to deduplication. It also includes dry run mode, approval requirements, rate limits, run history, and safety controls. This gives Prism Connex operational scale.

### 9. Analytics

The Analytics module provides KPI monitoring with charts for pipeline trends and sequence funnel performance. It visualizes pipeline value, active leads, event volume, average deal size, and engagement metrics. This module helps leadership understand not just activity, but business outcome.

### 10. AI Copilot

AI Copilot is the conversational intelligence layer. It supports Ask, Draft, and Do style interactions. Users can ask for target lists, summaries, sequence drafts, and recommended next actions. The UI also includes proposed actions that require confirmation, permission checks, audit preview, and bulk-action safeguards. This is a powerful positioning feature for an AI-native CRM.

### 11. Integrations

The Integrations module manages external connectivity. Current UI coverage includes Calendar Sync, Video Meetings, Team Notifications, Webhooks, CRM Forms, and File Storage. It also has configuration, permissions, last sync activity, and connection state. This section positions Prism Connex as an ecosystem-ready platform rather than an isolated tool.

### 12. Deliverability

Deliverability monitors the health of email operations. It surfaces domain health, bounce rate, complaint rate, unsubscribe rate, SPF, DKIM, and DMARC status. It also includes sender identities, compliance settings, suppression controls, and recent deliverability events. For outbound teams, this is critical because it protects sending reputation and inbox placement.

### 13. Team

The Team module manages workspace members and permissions. It includes member search, role changes, status, last active data, and a permissions matrix for Admin, Sales Rep, Support, and Viewer. It also includes AI security insights that highlight permission and governance risk. This is especially valuable for larger teams and enterprise buyers.

### 14. Settings

The Settings module manages workspace preferences such as theme mode, accent color, UI preferences, localization, email sending, privacy, and data retention. It supports light, dark, and system theme modes as well as accessibility-style toggles like reduce motion and high contrast.

### 15. Audit Log

The Audit Log is the admin accountability layer. It shows creates, updates, deletes, login events, and settings changes with actor identity and timestamps. This supports compliance, security visibility, internal governance, and enterprise trust.

## 11. Email Sequencing: How It Works

Email sequencing is one of Prism Connex's most strategic modules.

In the current product design, email sequencing works like this:

1. A user identifies target companies or contacts from Events, Companies, People, or Leads.
2. The user adds those records into a list or sequence audience.
3. In Sequence Studio, the user creates steps such as:
- Email
- Wait
- Task
4. The user defines subject lines and body copy with personalization tokens like first name, company, event name, and city.
5. AI tools can help rewrite, shorten, add CTA language, or translate copy.
6. Sending settings define local time windows, daily limits, throttling, and stop conditions.
7. Compliance checks verify unsubscribe and suppression readiness.
8. Deliverability checks review domain health and auth readiness.
9. The user sends a test or launches the sequence.
10. Replies, meetings, and performance flow into analytics and next actions.

In the database design, sequences are represented by:

- `Sequence`
- `SequenceStep`
- `SequenceEnrollment`
- `EmailEvent`

Important architecture note: actual AWS SES event-driven execution is still described as a later phase in the MVP scope. Right now, email event handling is represented as stored scheduled tasks in the database rather than a full AWS SES production pipeline.

## 12. Automation: How It Works

Automation in Prism Connex is meant to reduce manual CRM work.

Examples visible in the current UI:

- New lead -> assign owner -> create task -> optional sequence
- Reply received -> stop sequence -> create follow-up task
- Deal stage changes -> trigger checklist steps
- Deal won -> compute profit and update ROI views
- Import completed -> deduplicate and suggest merges

The important design principle is safe automation, not blind automation. The UI includes:

- Dry run mode
- Approval requirements
- Action limits
- Run history
- Audit visibility

This makes the product enterprise-friendly and reduces operational risk.

## 13. AI Copilot: How It Works

AI Copilot is designed to act as an assistant, not an uncontrolled agent.

It currently supports:

- Asking business questions
- Drafting messages
- Suggesting next actions
- Proposing CRM actions
- Requiring user confirmation for sensitive actions
- Showing permission and audit context before execution

That means Prism Connex can market its AI capability as useful, explainable, and controlled.

## 14. Ticket System and Discount Offering

Prism Connex includes a clear attendee-facing ticket and travel concept in the marketing and onboarding experience.

Current ticketing and travel position:

- Users can discover events
- Ticket purchases happen through partner/provider offers
- Promo codes or discount offers are available only for paid users
- Nearby essentials include hotels, airport, and railway context
- Traveler mode supports global event movement and local formatting
- Checkout happens on the provider site, not directly inside Prism Connex

This is important because the product can target not only B2B revenue teams, but also attendee and travel workflows around events.

## 15. Onboarding Experience

The onboarding flow is already a strong part of the product story.

Current onboarding steps:

1. Personal Role
2. Workspace
3. Sending
4. Import
5. Traveler

The onboarding flow captures:

- Role-based setup
- Workspace name
- User details
- Language
- Time zone
- Currency
- Traveler mode
- Dual time preference
- Sending identity preference
- Import preference
- Map provider preference

This gives Prism Connex a professional first-use experience for global teams.

## 16. Authentication and Session Flow

Prism Connex currently supports:

- Sign-up
- Verify email
- Sign-in
- Cognito URL redirect support
- Callback route
- Local session signing for MVP/demo flow

The architecture already includes AWS Cognito integration, but the current sign-in route still uses a local session shortcut for the MVP/demo path. This means the system is moving toward a stronger Cognito-backed production model while still supporting development and demo workflows.

## 17. Localization, Theme, Responsiveness, and UX Motion

### Multi-language support

Prism Connex currently supports 6 languages:

- English
- German
- French
- Spanish
- Portuguese
- Japanese

Language persistence is handled through locale routing, cookies, and preferences storage.

### Theme support

Theme support exists in both public marketing pages and the app workspace.

Supported modes:

- Light
- Dark
- System

### Responsiveness

The application is built with Tailwind responsive breakpoints and mobile-aware layout logic. The CRM shell uses a mobile sidebar overlay, responsive paddings, hidden/show breakpoints, and adaptive grid layouts. The public pages also use responsive sections for desktop, tablet, and mobile.

### Animations and hover effects

Prism Connex includes meaningful visual motion, not static screens.

Current animation patterns include:

- Framer Motion page reveals
- Staggered card entrances
- Hover lift and scale on marketing cards
- Accent-colored hover glow
- Sheen overlays and tint overlays
- Floating icon motion
- Sparkline activity graphics
- Animated launch/readiness effects
- A fluid cursor canvas effect in the codebase

This is valuable for product marketing because the UI feels premium, modern, and interactive.

## 18. Public Marketing Pages

Prism Connex currently includes three major public marketing pages plus the landing page.

### Home page

The landing page positions Prism Connex as an AI-powered trade show CRM. It includes:

- Hero section
- Stats strip
- Persona workflows
- Features grid
- Tickets and travel section
- Security strip
- Final CTA

### Product page

The Product page presents feature categories and core solutions such as:

- Events Intelligence
- Company and People Directory
- Lead Capture and Deal Flow
- Sequence Studio
- AI Copilot
- ROI and Profit Analytics
- Integrations
- Deliverability and Security
- Automations
- Attendee Travel Mode
- B2B Exhibitors Database
- B2B Email Marketing
- B2B Chat Support

### Pricing page

The Pricing page currently presents four plan tiers:

- Free
- Starter
- Pro
- Enterprise

It also includes:

- 14-day free trial messaging
- Feature highlight row
- Add-ons
- FAQ
- Ticket and travel mode notes
- Promo code note for paid plans only

### Security page

The Security page positions Prism Connex around:

- SOC 2 readiness
- GDPR-ready controls
- AWS infrastructure
- SLA-ready architecture
- Tenant isolation
- RBAC
- Audit logging
- Encryption
- Email compliance
- Data lineage and transparency

## 19. AWS and Cloud Service Positioning

Prism Connex already has AWS-aligned architecture in the codebase and product story.

### Currently active or clearly wired in code

- AWS Cognito for user authentication flows
- AWS region configuration
- AWS SDK usage in dependencies
- AWS S3 configuration support for attachments or file storage
- Cognito token verification helpers
- Cognito-hosted UI URL generation

### Present in product/security positioning

- AWS infrastructure messaging on marketing and security pages
- Managed-security cloud positioning

### Planned or later-phase architecture noted in docs

- AWS SES event-driven email execution
- SQS and Lambda job offloading
- More complete Cognito production exchange flow

This means Prism Connex can be marketed honestly as AWS-aligned and cloud-ready, while still making it clear that some deeper production integrations remain future-phase work.

## 20. Current Implementation Status: What Is Real Today vs What Is Demo-Ready

This distinction is important for honest marketing and internal clarity.

### Solid backend/MVP foundations already present

- Next.js full stack app architecture
- PostgreSQL and Prisma data model
- Workspace multi-tenancy
- RBAC rules
- Sign-up, verify, sign-in flows
- Localization preferences
- Onboarding flow
- Leads API
- Lead-to-deal conversion
- Audit logging foundation
- Import/export route structure

### Strong UI and workflow coverage, but still partially mock/demo-backed

- Events intelligence screens
- Companies and people directories
- Several analytics and deliverability panels
- Many AI Copilot panels
- Several integration screens
- Multiple admin/automation screens

### Later-phase or placeholder items explicitly documented

- Real third-party scraping implementation
- Full AWS SES execution pipeline
- SQS/Lambda job architecture
- Some external provider actions
- Some import and export flows still use placeholders or mock data

This does not reduce the value of Prism Connex. It simply means the product is already strong as an MVP/platform foundation, while some modules are visually mature ahead of complete backend wiring.

## 21. Current Testing Snapshot

The codebase contains:

- Vitest configuration
- Integration tests for RBAC and tenancy
- Playwright E2E test intent for auth flow

Current status from test execution on March 15, 2026:

- The test runner starts
- The suite fails immediately because `tests/setup.ts` is referenced by `vitest.config.ts` but is missing
- Because of that, the tests do not currently execute actual assertions

So the correct statement is:

Prism Connex has a testing structure in place, but the suite needs repair before it can be presented as fully passing automated coverage.

## 22. Why Prism Connex Is Marketable

Prism Connex has a strong marketing story because it combines technical seriousness with business clarity.

Key differentiators:

- AI-native CRM for trade show and event workflows
- Event-to-revenue positioning
- Source transparency and confidence scoring
- Multi-language and multi-region readiness
- Deliverability and compliance visibility
- ROI and profit-based deal economics
- Ticketing and attendee travel support
- Enterprise controls through RBAC and audit logs
- Premium motion-driven modern UI

This is a strong base for brand storytelling on Instagram, Facebook, YouTube, and LinkedIn.

## 23. Weekly Social Media Posting Strategy

Recommended posting frequency:

- 2 to 3 posts per week

Recommended weekly structure:

- Post 1: Product education
- Post 2: Workflow outcome or case-style story
- Post 3: Social proof, feature spotlight, or short demo clip

### Instagram

Best for:

- Product cards
- Carousels
- Motion clips
- Before/after workflow storytelling

Recommended post ideas:

- "From event list to closed deal"
- "How AI Copilot saves sales time"
- "Why deliverability matters in B2B outreach"

### Facebook

Best for:

- Broader awareness
- Event audience education
- Community-style feature announcements

Recommended post ideas:

- "How exhibitors can manage leads after a trade show"
- "How attendee travel mode simplifies event planning"

### LinkedIn

Best for:

- B2B lead generation
- Corporate growth
- Decision-maker positioning
- Partnerships and investor-style thought leadership

Recommended post ideas:

- "Why trade show ROI should be tracked like a revenue funnel"
- "The future of AI-native CRM for event-driven businesses"
- "How transparency, compliance, and automation create trust"

### YouTube

Best for:

- Product walkthroughs
- Feature explainer videos
- Demo flows
- Founder or product vision content

Recommended post ideas:

- "Prism Connex demo: event to deal pipeline"
- "How email sequencing works in Prism Connex"
- "How AI Copilot and audit logging work together"

## 24. Suggested 4-Week Content Plan

### Week 1

- Post 1: Introduction to Prism Connex and its event-to-revenue vision
- Post 2: Event Intelligence and how it finds high-confidence opportunities
- Post 3: Sequence Studio and compliant outreach

### Week 2

- Post 1: AI Copilot feature spotlight
- Post 2: Leads to Deals conversion story
- Post 3: Analytics, profit, margin, and ROI dashboard focus

### Week 3

- Post 1: Deliverability and compliance education
- Post 2: Team roles, RBAC, and Audit Log for enterprises
- Post 3: Tickets and Travel Mode for attendees

### Week 4

- Post 1: Multi-language and global trade show readiness
- Post 2: Integrations and automation workflow showcase
- Post 3: Pricing page or feature bundle CTA for lead capture

## 25. Short Marketing Summary for PDF or Website

Prism Connex is a responsive, AI-native, full stack trade show CRM built for exhibitors, organizers, attendees, service providers, and modern revenue teams. It transforms event discovery into qualified leads, compliant outreach, meetings, deals, and measurable ROI through event intelligence, multi-language support, automation, AI Copilot, deliverability monitoring, and enterprise-grade governance features such as RBAC and audit logging.

## 26. Best Honest Positioning Statement

Prism Connex is already strong enough to present as a premium event-to-revenue CRM platform with real full stack foundations, global UX readiness, and polished workflow coverage. The safest and strongest message is to market it as a modern AI-native CRM platform with live backend foundations and expanding enterprise integrations, rather than claiming every external integration is already fully production-wired.

## 27. Suggested PDF Title

Prism Connex: The AI-Native Event-to-Revenue CRM Platform

## 28. Suggested PDF Subtitle

Full Product Guide, Workflow Overview, Module Breakdown, Tech Stack, Global Readiness, and Marketing Positioning
