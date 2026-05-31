# MVP Scope

## Included Features
- Custom AWS Cognito authentication (Sign-in, Sign-up, Verification) to avoid Hosted UI constraints and allow custom styling.
- Secure Tenant Onboarding Wizard flow mapping to Users to Workspaces and Settings.
- Centralized Data Isolation and RBAC (MVC backend).
- Leads module end-to-end implementation (CRUD models, Pipeline Views, API).
- Convert Lead to Deal logic involving dynamic transactions and Audit logging.
- Automated unit/integration tests covering Authorization, Tenancy Isolation, and Playwright smoke testing configs.

## Excluded for Later Phases
- Actual third-party data scraping implementation (ToS concerns).
- Event-driven AWS SES integrations are stubbed as stored `EmailEvent` scheduled tasks in DB.
- SQS/Lambda job offloading architecture.
