# Architecture

Essential Invoice is a self-hosted invoicing application for Czech freelancers with a frontend/backend separation.

## Backend (`backend/src/`)

- **Express API** with JWT authentication and rate limiting
- **Entry point**: `index.ts` - Express app setup, middleware, route mounting
- **Routes**: `routes/` - REST endpoints for auth (register, login, forgot-password, reset-password, delete account), clients, invoices, expenses, payments, settings, ARES lookup, dashboard, AI
- **Services**: `services/` - Business logic:
  - `pdfGenerator.ts` - Invoice PDF generation using **pdfmake** library with Czech formatting, QR payment codes (SPAYD), and VAT/non-VAT payer support (hides DIČ and shows "Neplátce DPH" for non-VAT payers, hides DPH line when rate is 0%)
  - `emailSender.ts` - Per-user SMTP email sending for invoice delivery
  - `globalEmailSender.ts` - Global SMTP email sending for system emails (welcome, password reset), configured via env vars
  - `emailPoller.ts` - IMAP polling for bank payment notifications
  - `perplexityAI.ts` - Perplexity AI integration for tax advice and financial guidance
  - `bankParsers/` - Extensible bank email parsing (Air Bank implemented)
- **Utils**: `utils/validation.ts` - Czech IČO validation, IBAN conversion, SPAYD generation
- **Scripts**: `scripts/delete-user.ts` - Admin CLI script to delete a user by email
- **Seed**: `db/seed.ts` - Seeds test data (user, clients, invoices, expenses, payments) for development. Run with `bun run seed [email] [password]`
- **Middleware**: `middleware/auth.ts` - JWT authentication middleware
- **Database**: PostgreSQL with `pg` driver. Schema managed in `db/init.ts` using idempotent CREATE TABLE IF NOT EXISTS and inline ALTER TABLE migrations (no separate migration files). `db/migrate.ts` is the migration runner script. Users table includes `vat_payer` (BOOLEAN, default false) for VAT payer status, `onboarding_completed` (BOOLEAN, default false) to track new-user onboarding, and `pausalni_dan_enabled`/`pausalni_dan_tier`/`pausalni_dan_limit` for paušální daň settings. `password_reset_tokens` table stores hashed tokens for password reset flow.

## Frontend (`frontend/src/`)

- **React 18** with TypeScript, Vite, and TailwindCSS
- **Context**:
  - `context/AuthContext.tsx` - Authentication state management
  - `context/AIContext.tsx` - AI assistant state management
- **Components**: `components/` - Reusable UI:
  - `Layout.tsx` - Main layout wrapper with navigation
  - `AIAssistant.tsx` - AI assistant chat component
- **Pages**: `pages/` - Dashboard, Clients, ClientDetail, Invoices, InvoiceCreate, InvoiceDetail, Expenses, ExpenseCreate, ExpenseDetail, Payments, Settings, Profile, Calculator, Login, Register, Onboarding, ForgotPassword, ResetPassword
- **Utils**:
  - `utils/format.ts` - Date/currency formatting helpers
  - `utils/api.ts` - API client and request utilities
- **Path alias**: `@/*` maps to `src/*`

## Helm Chart (`helm-chart/`)

- **Chart.yaml**: Chart metadata (no external dependencies)
- **values.yaml**: All configurable values (backend, frontend, ingress, postgresql, secrets, security contexts, autoscaling, PDBs)
- **templates/**: Kubernetes manifests:
  - `serviceaccount.yaml` - ServiceAccount with configurable annotations (IRSA/Workload Identity)
  - `backend-deployment.yaml` / `frontend-deployment.yaml` - Deployments with security contexts, checksum annotations for auto-rollout, extraEnv/extraEnvFrom support
  - `backend-service.yaml` / `frontend-service.yaml` - Configurable service types
  - `ingress.yaml` - Ingress with configurable pathType and ingressClassName
  - `secret.yaml` - JWT and optional DB password secrets
  - `hpa.yaml` - HorizontalPodAutoscaler (optional, disabled by default)
  - `pdb.yaml` - PodDisruptionBudget (optional, disabled by default)
  - `frontend-configmap.yaml` - Nginx reverse-proxy config and main nginx.conf
  - `postgresql.yaml` - PostgreSQL StatefulSet, Service, and Secret (conditional)
- PostgreSQL deployed via built-in StatefulSet with PVC persistence; can be disabled in favor of external DB
- Ingress disabled by default; supports TLS via cert-manager annotations
- Secrets managed via k8s Secret or existing secret reference
- Security hardened: `runAsNonRoot`, `readOnlyRootFilesystem` (frontend), `drop ALL` capabilities

## Key Integrations

- **ARES API**: Czech company registry lookup by IČO (`routes/ares.ts`)
- **SPAYD**: Czech QR payment code standard for bank transfers
- **Air Bank**: Email notification parsing for automatic payment matching
- **Perplexity AI**: AI-powered Czech tax advisor, payment matching, and financial insights (`routes/ai.ts`, `services/perplexityAI.ts`)

## Security

- All API endpoints (except auth) require JWT authentication
- Passwords are hashed with bcrypt (12 rounds)
- Rate limiting on API endpoints (100 requests/15 min)
- HTTPS recommended for production (configure via reverse proxy)
- Environment-based configuration (no hardcoded secrets)
- Input validation on all endpoints

## Bank Support

Currently supported:
- **Air Bank** - Parses incoming payment notification emails

The bank parsing system is designed to be extensible. To add support for another bank:

1. Create a new parser in `backend/src/services/bankParsers/`
2. Implement the `ParsedPayment` interface
3. Register the parser in `bankParsers/index.ts`
