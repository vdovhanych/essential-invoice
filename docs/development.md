# Development

## Prerequisites

- [Bun](https://bun.sh/) runtime
- Node.js 22.12+ on the 22.x line, 24.x, or 26+ for Vitest 5 ([supported engines](https://github.com/vitest-dev/vitest/blob/v5.0.0/packages/vitest/package.json)); Bun installs dependencies and invokes the test script, but the Vitest executable uses Node.js
- Docker and Docker Compose (for PostgreSQL)
- `xmllint` for ISDOC schema tests (included on macOS; `sudo apt-get install libxml2-utils` on Debian/Ubuntu)

## Local Development Setup

Agents should read [AGENTS.md](../AGENTS.md) for the shared repository instructions. `CLAUDE.md` points to that file so the guidance stays in sync.

**Important:** For local development, the frontend runs on port 5173 (Vite default).
Compose reads the root `.env`; direct Bun commands from `backend/` use `backend/.env`.

1. Create a root `.env` from `.env.example` if it does not exist and configure database credentials, then start the database:
```bash
docker compose up -d db
```

2. Backend:
```bash
cd backend
bun install
# If backend/.env does not exist, copy ../.env.example to .env
# Set DB_HOST=localhost and match the root .env database credentials/port.
# Set CORS_ORIGIN=http://localhost:5173 and FRONTEND_URL=http://localhost:5173.
# Configure JWT_SECRET and ENCRYPTION_KEY before starting the API.
bun run dev
```

3. Frontend:
```bash
cd frontend
bun install
bun run dev
```

## Running Tests

Both backend and frontend use Vitest (`bun run test`, not `bun test`). Tests are co-located with source files: backend `*.test.ts`, frontend `*.test.ts` and `*.test.tsx`.

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
(cd backend && bun run test src/utils/validation.test.ts)
(cd frontend && bun run test src/utils/format.test.ts)
```

Before submitting code changes, run both suites. For frontend changes, also run `(cd frontend && bun run build)` from the repository root to check TypeScript and the production bundle. Documentation-only changes need link/path/command checks and `git diff --check`.

**Test coverage includes:**
- Air Bank email parsing (incoming payment detection, field extraction)
- Bank parser factory (bank detection, payment parsing)
- Validation utilities (IČO checksum, email, currency formatting, SPAYD)
- API routes (authentication, authorization, validation)
- Mixed-rate VAT rounding, tax treatment validation, and export access controls
- ISDOC CZK/EUR fixtures validated against the bundled official XSD; ZIP contents and CSV escaping
- Frontend utilities (date/currency formatting, status labels)

### Pull request CI

On pull requests, `.github/workflows/test.yml` runs backend and/or frontend tests based on changed paths (`backend/**`, `frontend/**`). A single **Tests** check aggregates the results so branch protection can require one status.

## Admin Scripts

### Seed Test Data

Use only a disposable local development database. The CLI refuses `NODE_ENV=production`,
requires `SEED_CONFIRM_LOCAL=1`, an explicit `DB_NAME`, and a `DB_HOST` of `localhost`,
`127.0.0.1`, `::1` or an absolute Unix-socket directory. These checks cannot detect a
production database forwarded to localhost: verify the target yourself. The seeder
never resets a database, deletes users, sends mail, calls CNB/ARES/AI, or starts jobs.

From `backend/`, configure the local database credentials as described above, run
`bun run migrate` to initialize its schema, then:

```bash
# Example: a newly created disposable local database, not an existing deployment
export DB_HOST=127.0.0.1 DB_NAME=essential_invoice_dev
# Also set DB_PORT, DB_USER and DB_PASSWORD for that local database.
bun run migrate
SEED_CONFIRM_LOCAL=1 bun run seed
SEED_CONFIRM_LOCAL=1 bun run seed developer@example.invalid --scenario all
# Pin the lifecycle clock when reproducing a bug (default: today in Europe/Prague)
SEED_CONFIRM_LOCAL=1 bun run seed another@example.invalid --scenario core --date 2026-10-26
```

Default credentials are `test@example.invalid` / `password123`. Emails use the same
normalization as login (case folding and provider alias rules); scenario accounts use
stable `vat_` / `identified_` prefixes. The CLI prints the exact login addresses. The optional second
positional argument still sets a password; prefer `SEED_PASSWORD` to avoid putting a
custom password in command history or Bun's command echo. The seeder itself does not
print passwords or database error row details. The fixtures use synthetic identities, reserved contact addresses and an
example bank account; do not send their invoices or submit their filings.

| Scenario | Account | Representative data |
| --- | --- | --- |
| `core` (default) | supplied email | Nonpayer; paid CZK/EUR, last-year revenue, future/due-today sent, overdue, draft and cancelled invoices; fractional quantities and half-cent rounding; two matchable CZK/EUR payments plus an unrelated payment; clear supplier-linked paid/unpaid CZK/EUR expenses; PNG receipt; inactive recurring template |
| `vat` | `vat_` supplied email | Monthly payer, August 2026: mixed 21/12% domestic sales; KH exactly/above CZK 10,000 and consumer cases; grouped haléř VAT; construction reverse charge code 4; EU B2B EUR service; mixed supplier-recorded tax with full deduction and a no-deduction expense |
| `identified` | `identified_` supplied email | August 2026 EU services supplied/received, self-assessed liability with no deduction; domestic nonpayer activity; no KH |
| `all` | all three accounts | Entire set is created atomically, including five locally validated saved filing versions |

Invoice numbering follows `FVYYYYMM##`; `notes` / expense `description` contain stable
`Seed: ...` labels. CZK invoices include SPAYD/QR data; EUR amounts use a fixed synthetic
recorded rate of 25.125 (not a claim about the actual CNB rate). Current line VAT and
expense breakdowns are populated immediately. SMTP/IMAP credentials are absent, AI
is disabled, and the recurring template has both `active=false` and `auto_send=false`.
The regular app can still access external services if you configure or invoke them.

Lifecycle dates are relative to `--date`. Tax scenarios deliberately stay in **2026-08**,
within the implementation's supported reporting year, so their history does not expire
when the development clock moves. Their taxpayer/document review fingerprints and
original DPHDP3/DPHKH1/DPHSHV versions are computed from the actual stored data and
validated against bundled XSDs; identified persons have only DPHDP3/DPHSHV. No EPO
submission or import is performed (`epoImportVerified=false`). Change a document to
exercise stale-review/history behavior; do not edit immutable saved versions directly.

**Repeated runs:** if any requested account already exists, the whole request fails
without changing accounts. Any insertion or XML validation failure rolls back every
requested scenario, including previously created scenarios in an `all` request. After
fixing the cause, the same command can be retried. For a second independent dataset,
choose a different email. Deleting disposable accounts is an explicit separate admin
action; the seeder never does it automatically. Schema initialization is intentionally
separate (`bun run migrate`), so seeding an existing schema does not rerun migrations.

These are compact development examples, not exhaustive coverage. Quarterly profiles,
replacement filings, intentionally blocked tax cases, logo/email histories and export
size limits remain in focused tests or manual scenarios. See [VAT filing scope](vat-filings.md)
before extending fixtures; do not mark unsupported tax cases as successfully reviewed.

The seed PostgreSQL integration test runs in a dedicated disposable CI service. Locally,
create a **new disposable localhost database** named `essential_seed_test` and run:

```bash
SEED_TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:PORT/essential_seed_test bun run test src/db/developmentSeed.integration.test.ts
```

It initializes the schema, verifies actual stored totals, XML/PDF/ZIP output, matching,
user isolation and immutable filing history. A temporary failure constraint checks
rollback across scenarios and a successful retry; it is removed in `finally`, and only
the test's synthetic users are deleted. Never use application data. Without the URL,
this integration test is skipped; the safeguard/date unit tests still run normally.

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
│   │   ├── db/              # Database init (init.ts), migrations (migrate.ts), seed (seed.ts)
│   │   ├── middleware/      # Auth middleware (auth.ts)
│   │   ├── routes/          # API routes (auth, clients, invoices, expenses, payments, settings, ares, dashboard, ai)
│   │   ├── i18n/             # Backend translations (translations.ts) for PDFs and emails
│   │   ├── services/        # Business logic
│   │   │   ├── bankParsers/ # Bank email parsers (Air Bank)
│   │   │   ├── emailPoller.ts
│   │   │   ├── emailSender.ts       # Per-user SMTP for invoices
│   │   │   ├── globalEmailSender.ts  # Global SMTP for system emails
│   │   │   ├── pdfGenerator.ts       # Uses pdfmake library
│   │   │   └── aiProvider.ts        # OpenRouter / OpenAI-compatible AI client
│   │   ├── scripts/          # Admin CLI scripts (delete-user.ts)
│   │   ├── utils/           # Validation utilities (IČO, IBAN, SPAYD)
│   │   └── index.ts         # Express app entry point
│   ├── uploads/             # File uploads (logos, expense attachments)
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Layout, AIAssistant
│   │   ├── context/         # AuthContext, AIContext
│   │   ├── i18n/            # react-i18next config + locales/{cs,en}/*.json
│   │   ├── pages/           # Dashboard, Clients, ClientDetail, Invoices, InvoiceCreate, InvoiceDetail,
│   │   │                    # Expenses, ExpenseCreate, ExpenseDetail, Payments, Settings, Profile,
│   │   │                    # Calculator, Login, Register, Onboarding, ForgotPassword, ResetPassword
│   │   ├── utils/           # API client, formatting helpers
│   │   └── test/            # Test setup (Vitest/jsdom)
│   ├── Dockerfile
│   ├── nginx.conf           # Production Nginx config
│   └── package.json
├── docs/                    # Detailed documentation
├── .github/workflows/       # CI/CD (PR tests, Docker build, chart publish)
├── helm-chart/              # Helm chart (see helm-chart/README.md)
├── docker-compose.yml
├── docker-compose.production.yml
├── .env.example
├── AGENTS.md                # Shared repository instructions for agents
├── CLAUDE.md                # Points to AGENTS.md
└── README.md
```

## Adding Translations (i18n)

### Frontend

Frontend translations use react-i18next with JSON files organized by namespace:

```
frontend/src/i18n/locales/
├── cs/
│   ├── common.json
│   ├── dashboard.json
│   ├── invoices.json
│   ├── expenses.json
│   ├── clients.json
│   ├── payments.json
│   ├── settings.json
│   ├── profile.json
│   ├── auth.json
│   └── calculator.json
└── en/
    └── (same files)
```

To add a new translation key:
1. Add the key to the appropriate namespace JSON file in both `cs/` and `en/`
2. Use it in components with `const { t } = useTranslation('namespace')` then `t('key')`

To add a new namespace:
1. Create `<namespace>.json` in both `cs/` and `en/` locale directories
2. Register the namespace in `frontend/src/i18n/i18n.ts`

### Backend

Backend translations live in `backend/src/i18n/translations.ts` as plain TypeScript objects keyed by language code. These are used by PDF generation and email templates. Add new keys to both `cs` and `en` entries.

Backend error messages use language-neutral error codes (e.g., `TOO_MANY_LOGIN_ATTEMPTS`) rather than human-readable strings. The frontend maps these codes to localized messages.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

When contributing code changes, **always update the documentation** to reflect your changes:

1. **Added a new feature?** - Update README.md features, add API endpoints to `docs/api-reference.md`, update `docs/architecture.md`
2. **Changed existing behavior?** - Update the relevant docs files
3. **Added configuration options?** - Add to `.env.example` and `docs/configuration.md`
4. **Changed dependencies?** - Update the corresponding `bun.lock` and affected documentation; update `AGENTS.md` if commands or conventions change

**Documentation is part of your contribution.** PRs with outdated documentation may be rejected.

## VAT filing verification

The filing implementation is deliberately limited to reviewed 2026 cases; [VAT filings](vat-filings.md) records the supported matrix, official structures, rounding and correction limitations. Tests never submit returns or use live taxpayer identities. `vatFiling.test.ts` validates representative XML with the bundled official XSDs, offline. The manifest beside them records original source URLs, versions and SHA-256 checksums; update fixtures and period applicability together when upgrading structures or rules.

Run the normal complete suites and frontend build from the commands above. The real PostgreSQL migration test is opt-in because it removes filing columns/tables to reconstruct a legacy schema. Use a **fresh, disposable** database named `essential_vat_test` on localhost only. Never point it at application data. For example:

```bash
docker run --rm -d --name essential-vat-validation -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1:55439:5432 postgres:17-alpine
# Wait until pg_isready succeeds before creating the database.
docker exec essential-vat-validation pg_isready -U postgres
docker exec essential-vat-validation createdb -U postgres essential_vat_test
(cd backend && VAT_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/essential_vat_test bun run test src/db/vatMigration.test.ts)
docker stop essential-vat-validation
```

No persistent volume is attached. The test initializes a fresh schema, simulates the previous schema, inserts a supplier-rounded legacy expense, migrates twice, checks unchanged historical totals and unknown deduction metadata, and verifies the database rejects updates to saved XML. Recreate the disposable database/container before running this test again. The ordinary full suite skips this integration test when its environment variable is absent.

### Initial implementation checks (8 September 2026)

- Complete backend (309 tests) and frontend (213 tests) Vitest suites passed, along with the frontend production bundle and backend TypeScript check. The PostgreSQL migration test was also run against a disposable PostgreSQL 17 instance.
- The production frontend was exercised with synthetic data and an isolated Express harness using the real VAT routes, without starting email polling or recurring invoice jobs. Czech/English labels, desktop/mobile layouts, light/dark themes, the taxpayer save bar above mobile navigation, linked document blockers, explicit metadata edits and stale-fingerprint rejection were checked. A native date-input regression is covered by a frontend test and was rechecked in the browser. A completed review generated/downloaded a new version, which was inspected in saved-version history.
- Synthetic August 2026 XML was imported using EPO's **Načíst ze souboru**, followed by **Protokol chyb**. The return (`DPHDP3`) and control statement (`DPHKH1`) reported **Písemnost neobsahuje chyby**; the recapitulative statement (`DPHSHV`) reported no errors preventing sending. The return/KH fixture used a domestic sale; SH used an EU B2B service with code 3. These are representative smoke checks, not EPO coverage of every matrix combination. Broader combinations are covered locally against XSDs and calculation tests.
- Initial synthetic personal-identifier and reserved `.invalid` contact-email errors were corrected before the successful EPO checks. The taxpayer validator requires a personal 9/10-digit VAT identifier for individuals; KH rejects non-routable reserved email endings. EPO can enforce additional business/registration checks beyond the bundled XSDs.
- No **Odeslání písemnosti**, signature, authentication or submission action was performed. Test identifiers are synthetic; acceptance by a form checker does not establish actual registration or tax correctness. Real exports still carry `epoImportVerified: false` and must be imported and reviewed by their owner.

When repeating UI checks after a production rebuild, reload and accept the app's service-worker update, or use a fresh localhost origin. Otherwise an older cached frontend can hide the code being verified. Restore temporary browser viewport overrides and stop disposable servers/databases after QA.

### VAT workspace usability regressions (9 September 2026)

First-time setup now prefills existing user details without marking them as confirmed filing data. Browser QA exercised profile confirmation, mixed-rate expense breakdown plus metadata in one save, blocker-free review, version creation, and the expense editor in English/Czech and light/dark desktop/mobile layouts. It also reproduced a one-day shift in expense edit dates; invoice/expense list and detail APIs now return date-only values using the existing document-date normalizer. Regression tests cover these changes, initial-load recovery, and period defaults for quarterly taxpayers. Complete suites passed with 316 backend tests and 218 frontend tests; frontend build, backend TypeScript and `git diff --check` also passed. The optional destructive migration test remains skipped in the ordinary suite; this fix introduces no schema migration.

The in-app browser did not emit a download-completion event during the follow-up check. The synthetic saved-version endpoint was verified directly to return HTTP 200, an XML attachment, and parseable `DPHDP3` bytes; native file-save completion was not observed by automation.

Settings → Exports was also checked with a synthetic profile in Czech/English, light/dark themes, and 1280 px desktop / 390 px mobile viewports. The DPH entry now has its own card and a 44 px button; Enter opens the filing workspace with profile defaults. ZIP period shortcuts, the expandable package description, and keyboard focus above the mobile navigation were exercised. Regression coverage includes date-input events, invalid ranges, year boundaries, pending-request protection, and inline error/retry behavior. The complete suites passed with 316 backend tests (one optional migration test skipped) and 223 frontend tests; the production build passed with existing font-resolution and Browserslist warnings. This Settings UI check used stubbed API data and did not generate a live ZIP.

### Export review fixes (13–15 October 2026)

Regression coverage now includes VAT-card visibility for payers/identified persons, mixed-rate expense data in accountant ZIPs, overdue deduction payment timing and reverse-charge exclusions, advance receipts before a later supply period, expense AI extraction and rate synchronization, and rejection of changed expense revisions before loading attachments. The concurrency tests simulate database query results; they are not live PostgreSQL concurrency tests.

On 15 October, the full suites passed with 370 backend tests and 247 frontend tests. The optional PostgreSQL migration test was skipped. The frontend production build and staged diff checks passed, with existing font-resolution and Browserslist warnings. Earlier checks of these fixes exercised the actual export/profile and expense-editor components with synthetic API data in Czech/English, light/dark themes and desktop/mobile layouts, including keyboard interaction. These follow-up checks did not repeat the September EPO smoke tests or submit any filings.
