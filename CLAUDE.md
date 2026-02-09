# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Structure

This repository has comprehensive documentation in the `docs/` folder. **Always refer to the docs folder for detailed information:**

- **[docs/development.md](docs/development.md)** - Development setup, workflow, and commands
- **[docs/architecture.md](docs/architecture.md)** - Technical architecture and design decisions
- **[docs/api.md](docs/api.md)** - Complete API reference
- **[docs/configuration.md](docs/configuration.md)** - Configuration options and setup
- **[docs/usage.md](docs/usage.md)** - User guide and application usage
- **[docs/testing.md](docs/testing.md)** - Testing guidelines and how to run tests
- **[docs/troubleshooting.md](docs/troubleshooting.md)** - Common issues and solutions
- **[docs/backup.md](docs/backup.md)** - Backup and restore procedures
- **[docs/bank-support.md](docs/bank-support.md)** - Bank integration details
- **[docs/security.md](docs/security.md)** - Security features and best practices

## Quick Reference

## Build and Development Commands

### Backend (Express/TypeScript)
```bash
cd backend
pnpm install            # Install dependencies
pnpm run dev            # Start dev server with hot reload (tsx watch)
pnpm run build          # Compile TypeScript
pnpm run start          # Run production build
pnpm test               # Run tests
pnpm test:watch         # Run tests in watch mode
pnpm test:coverage      # Run tests with coverage
```

### Frontend (React/Vite/TypeScript)
```bash
cd frontend
pnpm install            # Install dependencies
pnpm run dev            # Start Vite dev server
pnpm run build          # TypeScript check + Vite build
pnpm test               # Run tests
pnpm test:watch         # Run tests in watch mode
pnpm test:coverage      # Run tests with coverage
```

### Docker
```bash
docker compose up -d           # Start all services (dev)
docker compose up -d db        # Start only database (for local dev)
docker compose logs backend    # View backend logs
# Production: docker compose -f docker-compose.production.yml up -d
```

### Database
```bash
cd backend
pnpm run migrate        # Run database migrations
```

## Architecture

This is a self-hosted invoicing application for Czech freelancers with frontend/backend separation.

### Backend (`backend/src/`)
- **Express API** with JWT authentication and rate limiting
- **Entry point**: `index.ts` - Express app setup, middleware, route mounting
- **Routes**: `routes/` - REST endpoints for auth, clients, invoices, expenses, payments, settings, ARES lookup, dashboard, AI
- **Services**: `services/` - Business logic:
  - `pdfGenerator.ts` - Invoice PDF generation using **pdfmake** library with Czech formatting, QR payment codes (SPAYD), and VAT/non-VAT payer support (hides DIČ and shows "Neplátce DPH" for non-VAT payers, hides DPH line when rate is 0%)
  - `emailSender.ts` - SMTP email sending for invoice delivery
  - `emailPoller.ts` - IMAP polling for bank payment notifications
  - `perplexityAI.ts` - Perplexity AI integration for tax advice and financial guidance
  - `bankParsers/` - Extensible bank email parsing (Air Bank implemented)
- **Utils**: `utils/validation.ts` - Czech IČO validation, IBAN conversion, SPAYD generation
- **Middleware**: `middleware/auth.ts` - JWT authentication middleware
- **Database**: PostgreSQL with `pg` driver. Schema managed in `db/init.ts` using idempotent CREATE TABLE IF NOT EXISTS and inline ALTER TABLE migrations (no separate migration files). `db/migrate.ts` is the migration runner script. Users table includes `vat_payer` (BOOLEAN, default false) for VAT payer status, `onboarding_completed` (BOOLEAN, default false) to track new-user onboarding, and `pausalni_dan_enabled`/`pausalni_dan_tier`/`pausalni_dan_limit` for paušální daň settings.

### Frontend (`frontend/src/`)
- **React 18** with TypeScript, Vite, and TailwindCSS
- **Context**:
  - `context/AuthContext.tsx` - Authentication state management
  - `context/AIContext.tsx` - AI assistant state management
- **Components**: `components/` - Reusable UI:
  - `Layout.tsx` - Main layout wrapper with navigation
  - `AIAssistant.tsx` - AI assistant chat component
- **Pages**: `pages/` - Dashboard, Clients, ClientDetail, Invoices, InvoiceCreate, InvoiceDetail, Expenses, ExpenseCreate, ExpenseDetail, Payments, Settings, Profile, Calculator, Login, Register, Onboarding
- **Utils**:
  - `utils/format.ts` - Date/currency formatting helpers
  - `utils/api.ts` - API client and request utilities
- **Path alias**: `@/*` maps to `src/*`

### Key Integrations
- **ARES API**: Czech company registry lookup by IČO (`routes/ares.ts`)
- **SPAYD**: Czech QR payment code standard for bank transfers
- **Air Bank**: Email notification parsing for automatic payment matching
- **Perplexity AI**: AI-powered Czech tax advisor, payment matching, and financial insights (`routes/ai.ts`, `services/perplexityAI.ts`)

## Testing

Both projects use Vitest. Tests are co-located with source files (`*.test.ts`).

Run a single test file:
```bash
cd backend && pnpm vitest run src/utils/validation.test.ts
cd frontend && pnpm vitest run src/utils/format.test.ts
```

**Important**: Before submitting any code changes:
1. Write comprehensive tests for new functionality
2. Run all tests in both frontend and backend to ensure no regressions:
   ```bash
   cd backend && pnpm test
   cd frontend && pnpm test
   ```

## Environment

Requires `.env` file in root (copy from `.env.example`). Key variables:
- `JWT_SECRET` - Required for authentication
- `DB_*` - PostgreSQL connection settings
- SMTP/IMAP configured in-app via Settings page


## Documentation Maintenance

**CRITICAL**: When making ANY changes to the codebase, you MUST update the relevant documentation files to reflect those changes. This ensures the documentation stays accurate and useful.

### When to Update Documentation

Update documentation immediately when you:

1. **Add new features or endpoints**:
   - Add to README.md "Features" section
   - Add to [docs/api.md](docs/api.md) "API Reference" section (with full endpoint details)
   - Update [docs/architecture.md](docs/architecture.md) with new routes/pages/services
   - Update [docs/development.md](docs/development.md) project structure if new directories/files are added

2. **Change existing functionality**:
   - Update descriptions in README.md and [docs/architecture.md](docs/architecture.md)
   - Update [docs/api.md](docs/api.md) if endpoint signatures change
   - Update [docs/usage.md](docs/usage.md) if behavior changes

3. **Add/change dependencies**:
   - If switching libraries (e.g., Puppeteer → pdfmake), update all mentions
   - Document new key dependencies in [docs/architecture.md](docs/architecture.md)

4. **Add new pages or routes**:
   - Update CLAUDE.md Frontend pages list
   - Update CLAUDE.md Backend routes list
   - Update [docs/development.md](docs/development.md) project structure tree

5. **Change configuration**:
   - Update .env.example with new environment variables
   - Document new config options in [docs/configuration.md](docs/configuration.md)
   - Update CLAUDE.md "Environment" section

6. **Remove features or files**:
   - Remove from all documentation
   - Remove broken references (e.g., links to deleted files)

### Files to Keep Updated

- **CLAUDE.md**: Technical quick reference, commands, testing instructions
- **README.md**: Project overview, quick start, technology stack
- **docs/*.md**: Detailed documentation for all aspects of the project
- **.env.example**: All environment variables with comments

### Documentation Update Checklist

Before completing any task that modifies code, ask yourself:

- [ ] Did I add/remove/change any API endpoints? → Update [docs/api.md](docs/api.md)
- [ ] Did I add/remove any frontend pages? → Update CLAUDE.md pages list
- [ ] Did I add/remove any backend routes? → Update CLAUDE.md routes list
- [ ] Did I change how a feature works? → Update [docs/usage.md](docs/usage.md)
- [ ] Did I switch or add major libraries? → Update [docs/architecture.md](docs/architecture.md)
- [ ] Did I add new environment variables? → Update .env.example and [docs/configuration.md](docs/configuration.md)
- [ ] Did I change the project structure? → Update [docs/development.md](docs/development.md)
- [ ] Did I add bank support? → Update [docs/bank-support.md](docs/bank-support.md)
- [ ] Did I change security features? → Update [docs/security.md](docs/security.md)

### Example: Adding a New Feature

If you add an "Expenses" feature:

1. Add route: `backend/src/routes/expenses.ts`
2. Mount in: `backend/src/index.ts`
3. Add pages: `frontend/src/pages/Expenses.tsx`, `ExpenseCreate.tsx`, `ExpenseDetail.tsx`
4. **Immediately update documentation**:
   - README.md: Add "Expense Tracking" to Features list
   - [docs/api.md](docs/api.md): Add Expenses API endpoints
   - [docs/development.md](docs/development.md): Update project structure to include expenses routes and pages
   - CLAUDE.md: Add `expenses` to Backend routes list
   - CLAUDE.md: Add expense pages to Frontend pages list
   - [docs/usage.md](docs/usage.md): Add section on managing expenses

**Remember**: Documentation is part of the deliverable. A feature is not complete until its documentation is updated.
