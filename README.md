# Essential Invoice

A lightweight, self-hosted invoicing application focused on Czech invoicing workflows, including QR Platba and Air Bank payment notifications.

## Architecture & Technology Choices

### Proposed stack
- **Backend**: Python **FastAPI** (async-friendly, OpenAPI-first, easy to self-host, strong typing). 
- **Database**: **PostgreSQL** (production-ready, works well with Docker, supports structured financial data).
- **PDF & QR**: ReportLab for PDFs, QR built from **SPAYD** (Short Payment Descriptor) strings.
- **Email**: SMTP for outgoing invoices, IMAP polling for incoming Air Bank payment notifications.

**Why this stack?**
- FastAPI enables quick iteration, typed schemas, and good async I/O for IMAP polling and API integration.
- PostgreSQL is reliable for financial data and works well in Docker.
- Python has mature email/PDF libraries and makes regex-based parsing straightforward.

## Implementation Phases

### Phase 1 — Foundation (current repository)
- Dockerized FastAPI backend with PostgreSQL.
- Base data models for users, clients, invoices, invoice items, payments, and email logs.
- Basic API routes for clients/invoices and ARES lookup.

### Phase 2 — Multi-user core
- Authentication with JWT and per-user scoping for all core entities.
- Roles/permissions for admin vs. standard users.
- User preferences (invoice numbering sequence, secondary email CC/BCC setting).

### Phase 3 — Core invoicing
- Invoice PDF generation with Czech template.
- Dashboard endpoints and UI.
- Invoice numbering strategy (`YYYY####`) aligned with variable symbols.

### Phase 4 — Email + payments
- SMTP sending of invoice PDFs (log every send attempt in `email_logs`).
- IMAP polling to parse Air Bank notifications.
- Payment matching by VS only; if VS is missing, surface a manual resolution notification.

### Phase 5 — Polish & deploy
- Hardening, migrations, and backup docs (Docker volume snapshots as baseline).
- Documentation, monitoring, and admin tools.

## Quick Start (Docker)

```bash
cp .env.example .env
docker-compose up --build
```

API available at `http://localhost:8000`.

## API Overview

- `GET /health` — health check
- `POST /api/auth/register` — create a user
- `POST /api/auth/login` — get JWT token
- `GET /api/users/me` — current user profile
- `PATCH /api/users/me` — update user preferences
- `POST /api/clients` — create client
- `GET /api/clients` — list clients
- `GET /api/clients/{id}` — get client
- `POST /api/invoices` — create invoice
- `GET /api/invoices` — list invoices
- `GET /api/invoices/{id}` — get invoice
- `GET /api/invoices/{id}/pdf` — download invoice PDF
- `POST /api/payments/ingest` — ingest payment notification
- `GET /api/notifications` — list payment resolution notifications
- `POST /api/notifications/{id}/resolve` — resolve notification
- `GET /api/ares/{ico}` — ARES lookup by IČO
- `GET /api/dashboard` — dashboard summary
- `GET /ui` — lightweight dashboard UI

## Suggested Endpoints (future scope)
- Email send: `POST /api/invoices/{id}/send`

## Database Schema

See `docs/schema.sql` for the SQL schema.

## Configuration

All configuration is via environment variables. See `.env.example`.

## Bank Parsing Design (Air Bank)

Parsing is handled in `app/services/email_parser.py` using regex patterns. The parser:
- Ignores outgoing payments (contains `se snížil o částku`).
- Extracts amount, VS, sender, message, booked date, transaction code.
- Returns `None` on malformed or incomplete messages.

**Extensibility**: the parsing logic is isolated in a service module so additional banks can be added with parallel parsers and a strategy selector.

## QR Payment Format

The `build_spayd` helper uses the SPAYD Short Payment Descriptor format:
```
SPD*1.0*ACC:<account>*AM:<amount>*CC:CZK*X-VS:<vs>*MSG:<message>
```

## Questions / Decisions

1. **Invoice number format**: `YYYY####` aligned with variable symbol usage (e.g., `20240001`).
2. **Single vs. multi-user**: prioritize multi-user support with JWT roles and per-user data isolation.
3. **ARES failures**: fallback to manual entry and cache responses for reliability.
4. **Email logging**: store all send attempts + timestamps in `email_logs`.
5. **Payment conflicts**: match only via VS; if missing, surface an in-app notification for manual resolution.
6. **Secondary email**: send as CC or BCC based on user preference.
7. **Backup strategy**: start with Docker volume snapshots (optionally add PostgreSQL dumps later).

## Development

```bash
cd backend
uvicorn app.main:app --reload
```

## Troubleshooting

- Ensure `.env` exists and database credentials match `docker-compose.yml`.
- If ARES API fails, verify outbound access and the `ARES_BASE_URL`.
