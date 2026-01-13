# Essential Invoice (Self-Hosted)

A lightweight, self-hosted invoicing app focused on Czech freelancers/SMBs. The stack is TypeScript/Node.js with **Effect** for configuration, dependency injection, and typed workflows, plus Fastify for the HTTP server. PostgreSQL is the default database, with SQLite as a possible alternative later.

## Architecture & Technology Choices

### Why this stack
- **TypeScript + Node.js**: aligns with your familiarity and speeds up delivery.
- **Effect**: provides a strongly-typed, composable runtime for configuration, dependency injection, and background jobs (e.g., IMAP polling), which keeps the domain logic testable and modular.
- **Fastify**: production-grade HTTP server with good performance and plugins.
- **PostgreSQL**: mature relational database with solid JSON + reporting capabilities.
- **Docker Compose**: one-command deployment and repeatable environments.

### High-level architecture
- **API Service** (Node.js + Fastify + Effect)
  - REST endpoints
  - PDF generation + QR platba (SPAYD)
  - SMTP sending
  - IMAP polling + parsing (Air Bank)
- **Database** (PostgreSQL)
  - Users, clients, invoices, invoice items, payments, email logs
- **Worker loop** (same API process initially)
  - Runs IMAP polling every `IMAP_POLL_INTERVAL_MINUTES`
  - Can be extracted into a separate service later

### Implementation phases
1. **Foundation** (this commit)
   - Docker Compose + Node base service
   - Typed configuration via Effect
   - Initial schema + API plan
2. **Core features**
   - CRUD for clients/invoices
   - Invoice PDF + QR platba
   - Dashboard and auth
3. **Email integration**
   - SMTP + IMAP processing
   - Air Bank parsing module (extensible)
   - Payment matching logic
4. **Polish & deploy**
   - Tests, docs, and performance tuning
   - Backup guidance and monitoring

## API Design (Planned)

### Authentication
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`

### Clients
- `GET /clients`
- `POST /clients`
- `GET /clients/:id`
- `PATCH /clients/:id`
- `DELETE /clients/:id`
- `GET /clients/:id/invoices`

### Invoices
- `GET /invoices`
- `POST /invoices`
- `GET /invoices/:id`
- `PATCH /invoices/:id`
- `DELETE /invoices/:id`
- `POST /invoices/:id/send`
- `GET /invoices/:id/pdf`

### Dashboard
- `GET /dashboard/summary`

### ARES
- `GET /ares/:ico` (proxy + caching)

### Payments
- `POST /payments/match`
- `POST /payments/manual-match`

## Database schema
See [`docs/schema.sql`](docs/schema.sql) for the initial schema definition.

## Configuration
Copy `.env.example` to `.env` and adjust values as needed.

## Docker
```bash
docker-compose up --build
```

## Development
```bash
npm install
npm run dev
```

## Notes on requirements
- **Invoice numbers**: recommended format `YYYYNNN` (e.g., `202601`) to align with variable symbols while still being sequential.
- **Single vs multi-user**: initial version supports multi-user for future extensibility.
- **ARES failures**: fall back to manual entry; cache successful lookups for 24 hours.
- **Secondary email**: send as CC by default, configurable to a separate message.
- **Ambiguous payment matches**: create a review queue in UI for manual resolution.

## QR platba (SPAYD)
We will generate `SPD*1.0*ACC:<account>*AM:<amount>*CC:CZK*X-VS:<vs>*MSG:<message>` and embed it as a QR code on CZK invoices.
