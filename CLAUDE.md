# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
docker-compose up -d           # Start all services
docker-compose up -d db        # Start only database (for local dev)
docker-compose logs backend    # View backend logs
```

### Database
```bash
cd backend
pnpm run migrate        # Run database migrations
pnpm run seed           # Seed database
```

## Architecture

This is a self-hosted invoicing application for Czech freelancers with frontend/backend separation.

### Backend (`backend/src/`)
- **Express API** with JWT authentication and rate limiting
- **Routes**: `routes/` - REST endpoints for auth, clients, invoices, payments, settings, ARES lookup, dashboard
- **Services**: `services/` - Business logic:
  - `pdfGenerator.ts` - Invoice PDF generation using Puppeteer with Czech formatting and QR payment codes (SPAYD)
  - `emailSender.ts` - SMTP email sending for invoice delivery
  - `emailPoller.ts` - IMAP polling for bank payment notifications
  - `bankParsers/` - Extensible bank email parsing (Air Bank implemented)
- **Utils**: `utils/validation.ts` - Czech IČO validation, IBAN conversion, SPAYD generation
- **Middleware**: `middleware/auth.ts` - JWT authentication middleware
- **Database**: PostgreSQL with `pg` driver, migrations in `db/`

### Frontend (`frontend/src/`)
- **React 18** with TypeScript, Vite, and TailwindCSS
- **Context**: `context/AuthContext.tsx` - Authentication state management
- **Pages**: `pages/` - Dashboard, Clients, Invoices, Payments, Settings, Profile, Login, Register
- **Utils**: `utils/format.ts` - Date/currency formatting helpers
- **Path alias**: `@/*` maps to `src/*`

### Key Integrations
- **ARES API**: Czech company registry lookup by IČO (`routes/ares.ts`)
- **SPAYD**: Czech QR payment code standard for bank transfers
- **Air Bank**: Email notification parsing for automatic payment matching

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
