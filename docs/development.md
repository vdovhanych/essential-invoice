# Development

## Prerequisites

- [Bun](https://bun.sh/) runtime
- Docker and Docker Compose (for PostgreSQL)

## Local Development Setup

**Important:** For local development, the frontend runs on port 5173 (Vite default).
Make sure your `.env` file has: `CORS_ORIGIN=http://localhost:5173`

1. Start database:
```bash
docker compose up -d db
```

2. Backend:
```bash
cd backend
bun install
cp ../.env.example .env
# Edit .env - ensure CORS_ORIGIN=http://localhost:5173 for local dev
bun run dev
```

3. Frontend:
```bash
cd frontend
bun install
bun run dev
```

## Running Tests

Both backend and frontend include test suites using Vitest. Tests are co-located with source files (`*.test.ts`).

**Backend tests:**
```bash
cd backend
bun run test              # Run all tests
bun run test:watch        # Watch mode
bun run test:coverage     # With coverage report
```

**Frontend tests:**
```bash
cd frontend
bun run test              # Run all tests
bun run test:watch        # Watch mode
bun run test:coverage     # With coverage report
```

Run a single test file:
```bash
cd backend && bun vitest run src/utils/validation.test.ts
cd frontend && bun vitest run src/utils/format.test.ts
```

**Test coverage includes:**
- Air Bank email parsing (incoming payment detection, field extraction)
- Bank parser factory (bank detection, payment parsing)
- Validation utilities (IČO checksum, email, currency formatting, SPAYD)
- API routes (authentication, authorization, validation)
- Frontend utilities (date/currency formatting, status labels)

## Admin Scripts

### Delete User

Delete a user and all associated data (invoices, clients, expenses, payments, settings) by email:
```bash
cd backend
bun run delete-user user@example.com
```
The script will show user details and prompt for confirmation before deleting.

## Project Structure

```
essential-invoice/
├── backend/
│   ├── src/
│   │   ├── db/              # Database init (init.ts) and migrations (migrate.ts)
│   │   ├── middleware/      # Auth middleware (auth.ts)
│   │   ├── routes/          # API routes (auth, clients, invoices, expenses, payments, settings, ares, dashboard, ai)
│   │   ├── services/        # Business logic
│   │   │   ├── bankParsers/ # Bank email parsers (Air Bank)
│   │   │   ├── emailPoller.ts
│   │   │   ├── emailSender.ts       # Per-user SMTP for invoices
│   │   │   ├── globalEmailSender.ts  # Global SMTP for system emails
│   │   │   ├── pdfGenerator.ts       # Uses pdfmake library
│   │   │   └── perplexityAI.ts
│   │   ├── utils/           # Validation utilities (IČO, IBAN, SPAYD)
│   │   └── index.ts         # Express app entry point
│   ├── uploads/             # File uploads (logos, expense attachments)
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Layout, AIAssistant
│   │   ├── context/         # AuthContext, AIContext
│   │   ├── pages/           # Dashboard, Clients, ClientDetail, Invoices, InvoiceCreate, InvoiceDetail,
│   │   │                    # Expenses, ExpenseCreate, ExpenseDetail, Payments, Settings, Profile,
│   │   │                    # Calculator, Login, Register, Onboarding, ForgotPassword, ResetPassword
│   │   ├── utils/           # API client, formatting helpers
│   │   └── test/            # Test setup (Vitest/jsdom)
│   ├── Dockerfile
│   ├── nginx.conf           # Production Nginx config
│   └── package.json
├── docs/                    # Detailed documentation
├── .github/workflows/       # CI/CD (Docker build)
├── helm-chart/              # Helm chart (see helm-chart/README.md)
├── docker-compose.yml
├── docker-compose.production.yml
├── .env.example
├── CLAUDE.md
└── README.md
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

When contributing code changes, **always update the documentation** to reflect your changes:

1. **Added a new feature?** - Update README.md features, add API endpoints to `docs/api-reference.md`, update `docs/architecture.md`
2. **Changed existing behavior?** - Update the relevant docs files
3. **Added configuration options?** - Add to `.env.example` and `docs/configuration.md`
4. **Changed dependencies?** - Update mentions in CLAUDE.md and relevant docs

**Documentation is part of your contribution.** PRs with outdated documentation may be rejected.
