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

### Phase 2 — Core features
- Invoice PDF generation with Czech template.
- Dashboard endpoints and UI.
- Authentication and basic RBAC.

### Phase 3 — Email integration
- SMTP sending of invoice PDFs.
- IMAP polling to parse Air Bank notifications.
- Payment matching + manual disambiguation UI.

### Phase 4 — Polish & deploy
- Hardening, migrations, and backup docs.
- Documentation, monitoring, and admin tools.

## Quick Start (Docker)

```bash
cp .env.example .env
docker-compose up --build
```

API available at `http://localhost:8000`.

## API Overview

- `GET /health` — health check
- `POST /api/clients` — create client
- `GET /api/clients` — list clients
- `GET /api/clients/{id}` — get client
- `POST /api/invoices` — create invoice
- `GET /api/invoices` — list invoices
- `GET /api/invoices/{id}` — get invoice
- `GET /api/ares/{ico}` — ARES lookup by IČO

## Suggested Endpoints (future scope)

- Auth: `POST /api/auth/login`, `POST /api/auth/register`
- Invoice PDF: `GET /api/invoices/{id}/pdf`
- Email send: `POST /api/invoices/{id}/send`
- Payment ingest: `POST /api/payments/ingest`
- Dashboard: `GET /api/dashboard`

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

1. **Invoice number format**: Suggested `YYYY####` to align with variable symbol usage (e.g., `20240001`).
2. **Single vs. multi-user**: Current scope supports a single default user; can be expanded to multi-user with JWT roles.
3. **ARES failures**: fallback to manual entry and cache responses for reliability.
4. **Email logging**: store all send attempts + timestamps in `email_logs`.
5. **Payment conflicts**: if multiple invoices match, surface manual matching UI.
6. **Secondary email**: send as CC by default or separate send depending on user preference.
7. **Backup strategy**: use PostgreSQL dumps + Docker volume snapshots, document in README.

## Development

```bash
cd backend
uvicorn app.main:app --reload
```

## Troubleshooting

- Ensure `.env` exists and database credentials match `docker-compose.yml`.
- If ARES API fails, verify outbound access and the `ARES_BASE_URL`.
