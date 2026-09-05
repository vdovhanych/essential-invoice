# Repository agent instructions

This is the shared instruction source for agents working in this repository. `CLAUDE.md` points here; maintain guidance here instead of duplicating it. Detailed architecture and setup belong in `docs/`.

## Repository map

Essential Invoice is a self-hosted invoicing application for Czech freelancers.

- `backend/`: Express API and TypeScript, run directly with Bun. `src/index.ts` mounts routes, validates secrets, initializes the database, and starts email polling and recurring invoice generation.
- `backend/src/db/init.ts`: PostgreSQL pool, query helper, schema, and idempotent inline migrations. `src/db/migrate.ts` runs the same initialization explicitly; there is no separate migrations directory.
- `backend/src/routes/`: API endpoints. `src/services/`: PDF generation (pdfmake), SMTP delivery, IMAP bank matching, recurring invoices, AI provider, and CNB exchange rates.
- `frontend/`: React, TypeScript, Vite, and Tailwind CSS. `src/App.tsx` defines routes; `src/pages/`, `src/components/`, and `src/context/` contain the UI. The `@/*` alias maps to `src/*` in the app's TypeScript and Vite configuration.
- `helm-chart/`: application chart with a built-in PostgreSQL StatefulSet and optional external database. Docker Compose files support local and production deployments.
- `.github/workflows/test.yml`: path-filtered frontend/backend Vitest jobs with a combined `Tests` check. It does not run the frontend production build.

Use each package's `package.json` and configuration files for current dependency versions and commands.

## Commands and local setup

There is no root package workspace. Run package commands in `backend/` or `frontend/`; the examples below use subshells so they can all be copied from the repository root.

```bash
(cd backend && bun install --frozen-lockfile)
(cd frontend && bun install --frozen-lockfile)

docker compose up -d db
(cd backend && bun run dev)    # API: http://localhost:3001
(cd frontend && bun run dev)   # Vite: http://localhost:5173; use a second terminal
```

- For Docker Compose, create a root `.env` from `.env.example` if it does not exist. For direct Bun development from `backend/`, create `backend/.env` from the same example; do not assume Bun loads the parent `.env` or overwrite existing configuration.
- In `backend/.env`, use `DB_HOST=localhost`, match the database credentials and published port, and set `CORS_ORIGIN=http://localhost:5173` and `FRONTEND_URL=http://localhost:5173`. The example's `DB_HOST=db` is for container networking. The API reads `PORT` (default `3001`); `BACKEND_PORT` is a Compose variable. Vite proxies `/api` to port `3001`.
- Startup requires `JWT_SECRET` (at least 16 characters) and `ENCRYPTION_KEY` (64 hexadecimal characters). Generate local values with `openssl rand -hex 32`. Keep credentials out of tracked files and logs.
- Global SMTP is for system emails; per-user SMTP/IMAP and AI settings are configured in the app. See [configuration](docs/configuration.md) for details.
- Commit the corresponding `bun.lock` when intentionally changing dependencies. Use `bun install` without `--frozen-lockfile` for those updates.

Other commands, from the repository root:

```bash
(cd backend && bun run start)           # Run TypeScript directly; no backend build script
(cd backend && bun run migrate)         # Apply schema initialization/migrations
(cd backend && bun run seed)            # Development data: test@test.com / password123

docker compose up -d                    # Full stack; frontend defaults to port 8080
docker compose logs backend
```

Custom seed credentials and the destructive `delete-user` admin command are documented in [development](docs/development.md). Deployment commands belong in [deployment](docs/deployment.md) and the [chart README](helm-chart/README.md).

## Implementation conventions

### Backend and invoice data

- Scope reads and writes of user-owned data to the authenticated `req.userId`, including referenced clients, invoices, payments, and attachments. Use parameterized SQL and preserve existing transaction boundaries for multi-table changes.
- Add schema changes to `backend/src/db/init.ts` so initialization works for both fresh databases and existing installations, and remains safe to run repeatedly at startup.
- Reuse `backend/src/utils/money.ts` for monetary rounding and invoice totals, and `utils/validation.ts` for Czech IČO, IBAN, and SPAYD logic. Preserve VAT/non-VAT PDF behavior.
- Reuse `services/cnbExchangeRate.ts` for EUR-to-CZK conversion. Both invoices and expenses store `exchange_rate` and `total_czk`; keep these consistent when amounts, currencies, or relevant dates change.
- Reuse `utils/encryption.ts` for sensitive settings and `utils/jwt.ts` for JWT secrets; preserve startup validation.
- `PUT /auth/me` replaces company fields. Follow the existing full-profile update pattern when changing only language or another preference, so unrelated fields are not cleared.
- The application starts email polling and recurring invoice generation in-process. Account for those side effects when running the server or changing scheduled behavior.

### Frontend, localization, and interaction

- Use the existing API client in `frontend/src/utils/api.ts` for standard authenticated requests, uploads, and downloads.
- The “Calm Indigo” design tokens and shared component classes live in `frontend/src/index.css`. Tailwind exposes the tokens through its CSS `@theme` block; there is no `tailwind.config.js`.
- Use semantic colors (`canvas`, `surface`, `text`, `accent`, `border`, `success`, `danger`, and their variants), not raw palette utilities. Light/dark colors swap through `:root` and `.dark`, so color-specific `dark:` overrides are unnecessary. Reuse `card`, `btn*`, `badge*`, `input`, `input-auth`, and `label`; use `tabular-nums` for numeric values.
- Add UI text to both `frontend/src/i18n/locales/cs/` and `en/`. Register new namespaces in `frontend/src/i18n/i18n.ts`. PDF/email text belongs in both language maps in `backend/src/i18n/translations.ts`. Use locale-aware `frontend/src/utils/format.ts` for display values.
- Preserve desktop sidebar and mobile bottom navigation behavior. Settings/Profile sections are URL routes (`/settings/:section`, `/profile/:section`) so browser Back works. The mobile Settings index also provides access to Profile.
- Reuse `SettingsList.tsx` and `StickySaveBar.tsx` for settings forms. The save bar is fixed above the mobile navigation and appears only for unsaved changes; its positioning accounts for Layout's overflow clipping. Appearance and language apply immediately.
- Keep interactions usable by keyboard and touch as well as mouse, including dialogs, the command palette, and chart tooltips. Verify changed UI in light/dark themes and at mobile/desktop sizes.
- Payment reminders use `ReminderComposer.tsx`: AI drafts stay editable and are sent only when the user presses Send.

## Verification

Both packages use **Vitest**. Run `bun run test`, not Bun's built-in `bun test`.

```bash
# Full suites — run both before submitting code changes
(cd backend && bun run test)
(cd frontend && bun run test)

# Focused tests while iterating
(cd backend && bun run test src/utils/validation.test.ts)
(cd frontend && bun run test src/utils/format.test.ts)

# TypeScript check and production bundle for frontend changes
(cd frontend && bun run build)
```

- Add behavior-focused tests for new functionality and regression tests for bug fixes, including relevant validation, authorization, and money edge cases. Follow neighboring tests instead of introducing another test framework.
- Backend tests are `src/**/*.test.ts` in a Node environment; route tests use Supertest with mocked database/services. Frontend tests are `src/**/*.test.{ts,tsx}` with jsdom and React Testing Library; shared setup is `frontend/src/test/setup.ts`. Keep tests independent of live databases, email delivery, and paid external APIs.
- Both packages also provide `test:watch` and `test:coverage` scripts.
- For Helm changes, lint and render with required placeholder secrets (validation only):

  ```bash
  helm lint ./helm-chart --set existingSecret=agent-validation --set postgresql.auth.password=agent-validation-only
  helm template essential-invoice ./helm-chart --set existingSecret=agent-validation --set postgresql.auth.password=agent-validation-only > /tmp/essential-invoice-helm.yaml
  ```

  Use additional values for any changed optional configuration; `existingSecret` skips rendering the application Secret, so test that template separately with dummy `jwtSecret` and `encryptionKey` values when changing it.

- Documentation-only changes need link/path/command checks and `git diff --check`; application tests are not required unless code or runtime configuration also changes.
- Report the checks actually run and any failures or checks that could not run.

## Documentation maintenance

Update documentation affected by the change; avoid copying full component inventories or volatile defaults into agent instructions.

| Change | Documentation to update |
| --- | --- |
| Agent workflow or repository conventions | `AGENTS.md`; keep `CLAUDE.md` as a pointer |
| API endpoints or request/response behavior | `docs/api-reference.md` |
| Architecture, pages, services, or integrations | `docs/architecture.md` |
| Environment/configuration options | `.env.example`, `docs/configuration.md`, and affected Compose/Helm configuration |
| User-facing features | `README.md` |
| Local setup, commands, testing, or structure | `docs/development.md` |
| Deployment or chart behavior | `docs/deployment.md`, `helm-chart/README.md`, and affected chart files |
| Troubleshooting guidance | `docs/troubleshooting.md` |
