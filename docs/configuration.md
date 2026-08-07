# Configuration

## Environment Variables

Copy `.env.example` to `.env` in the project root and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `db` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `essential_invoice` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `JWT_SECRET` | - | JWT signing secret (required, at least 16 characters — the server refuses to start without it). Generate with `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | - | AES-256 key for encrypting secrets at rest (required, 64-char hex). Generate with `openssl rand -hex 32` |
| `CORS_ORIGIN` | `http://localhost:5173` (dev) / `http://localhost:8080` (Docker) | Allowed CORS origins (comma-separated) |
| `BACKEND_PORT` | `3001` | Backend API port |
| `FRONTEND_PORT` | `80` | Frontend web port |
| `EMAIL_POLLING_INTERVAL` | `600` | Email check interval (seconds, default 10 minutes) |
| `EMAIL_FETCH_TIMEOUT` | `120` | Hard timeout for a single user's IMAP fetch (seconds). Prevents a stuck IMAP connection from blocking future polls |
| `IMAP_ALLOW_INSECURE_TLS` | `false` | Set to `true` to accept IMAP servers with self-signed/invalid TLS certificates. By default certificates are verified |
| `RECURRING_INVOICE_INTERVAL` | `86400` | Recurring invoice generation check interval (seconds, default 24 hours) |
| `FRONTEND_URL` | `http://localhost:8080` | Frontend URL for email links (password reset) |
| `GLOBAL_SMTP_HOST` | - | Global SMTP server host (enables system emails) |
| `GLOBAL_SMTP_PORT` | `587` | Global SMTP server port |
| `GLOBAL_SMTP_USER` | - | Global SMTP username |
| `GLOBAL_SMTP_PASSWORD` | - | Global SMTP password |
| `GLOBAL_SMTP_SECURE` | `false` | Use TLS for global SMTP |
| `GLOBAL_SMTP_FROM_EMAIL` | - | Sender email for system emails |
| `GLOBAL_SMTP_FROM_NAME` | `essentialInvoice` | Sender name for system emails |

## Language / Localization

The application supports Czech (`cs`, default) and English (`en`). Each user's language preference is stored in the `users.language` column and can be changed on the Profile page.

The preference affects:
- All frontend UI text (via react-i18next)
- Generated PDF invoices (labels, footer text)
- Email templates (invoice emails, welcome email, password reset)
- Date and currency formatting

The `GET /auth/me` endpoint returns the `language` field; `PUT /auth/me` accepts it to update the preference.

## SMTP Configuration (In-App)

Configure per-user email sending in Settings > Email (SMTP):
- SMTP Host (e.g., `smtp.gmail.com`)
- Port (typically 587 for TLS, 465 for SSL)
- Username and password
- Sender email and name

## IMAP Configuration (In-App)

Configure bank notification receiving in Settings > Email (IMAP):
- IMAP Host (e.g., `imap.gmail.com`)
- Port (typically 993 for TLS)
- Username and password
- Bank notification email filter (e.g., `noreply@airbank.cz`)

## AI Features (Optional)

AI features work with [OpenRouter](https://openrouter.ai) by default, but any OpenAI-compatible chat completions API can be used. Each user configures their own API key:

1. Get an API key from [https://openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
2. Log in to Essential Invoice
3. Go to Settings (Nastavení)
4. Find the "AI Features" section
5. Enter your API key and save

Optional fields:
- **API base URL** — any OpenAI-compatible endpoint (e.g. `https://api.openai.com/v1`). Leave empty to use OpenRouter (`https://openrouter.ai/api/v1`).
- **Model** — model identifier at your provider. Leave empty to use `openai/gpt-5.6-luna`. When using OpenRouter, the tax advisor automatically appends the `:online` suffix so answers use live web search; on other providers no web search is added.

Once configured, AI features become available:
- Tax advisor chatbot accessible from the AI assistant button, personalized with your VAT payer status, paušální daň settings, and current-year revenue
- "Fill form from document" on the expense form — extracts supplier, dates, amounts, and VAT from an uploaded invoice/receipt (PDF or photo; requires a vision-capable model such as the default `openai/gpt-5.6-luna`)
- "Draft payment reminder" in the invoice send dialog for sent/overdue invoices — drafts a polite reminder email in your language that you can edit before sending
