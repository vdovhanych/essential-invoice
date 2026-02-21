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
| `JWT_SECRET` | - | JWT signing secret (required) |
| `ENCRYPTION_KEY` | - | AES-256 key for encrypting secrets at rest (required, 64-char hex). Generate with `openssl rand -hex 32` |
| `CORS_ORIGIN` | `http://localhost:5173` (dev) / `http://localhost:8080` (Docker) | Allowed CORS origins (comma-separated) |
| `BACKEND_PORT` | `3001` | Backend API port |
| `FRONTEND_PORT` | `80` | Frontend web port |
| `EMAIL_POLLING_INTERVAL` | `300000` | Email check interval (ms) |
| `FRONTEND_URL` | `http://localhost:8080` | Frontend URL for email links (password reset) |
| `GLOBAL_SMTP_HOST` | - | Global SMTP server host (enables system emails) |
| `GLOBAL_SMTP_PORT` | `587` | Global SMTP server port |
| `GLOBAL_SMTP_USER` | - | Global SMTP username |
| `GLOBAL_SMTP_PASSWORD` | - | Global SMTP password |
| `GLOBAL_SMTP_SECURE` | `false` | Use TLS for global SMTP |
| `GLOBAL_SMTP_FROM_EMAIL` | - | Sender email for system emails |
| `GLOBAL_SMTP_FROM_NAME` | `essentialInvoice` | Sender name for system emails |

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

To enable AI-powered features, each user needs to configure their own Perplexity API key:

1. Get an API key from [https://www.perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)
2. Log in to Essential Invoice
3. Go to Settings (Nastavení)
4. Find the "AI funkce (Perplexity)" section
5. Enter your API key and save

Once configured, AI features become available:
- Payment matching suggestions in the Payments page
- Tax advisor chatbot accessible from the AI assistant
- Financial insights on the Dashboard
