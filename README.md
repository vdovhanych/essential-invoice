# Essential Invoice

A lightweight, self-hosted invoicing web application designed for Czech freelancers and small businesses. Features include PDF invoice generation with QR payment codes, SMTP email sending, and automatic bank payment matching via IMAP.

## Features

- **AI-Powered Features** (New! 🤖):
  - Smart payment matching with Perplexity AI
  - Invoice categorization and insights
  - Czech tax & accounting advisor chatbot
  - Real-time financial insights
- **Invoice Management**: Create, edit, delete, and send invoices with automatic numbering
- **Expense Tracking**: Track business expenses with PDF attachments and automatic numbering
- **Client Management**: Store and manage client contacts with ARES API integration for Czech companies
- **PDF Generation**: Professional Czech invoice templates with QR payment codes (SPAYD format), VAT/non-VAT payer support
- **Email Integration**: Send invoices via SMTP, receive bank notifications via IMAP
- **Bank Payment Matching**: Automatic matching of Air Bank payment notifications to invoices, with manual matching, unmatching, and deletion capabilities
- **Password Reset**: Email-based password recovery with secure token flow
- **Welcome Emails**: Automatic welcome email on registration (when global SMTP is configured)
- **Onboarding Wizard**: Guided 2-step setup after registration to collect company and bank details
- **Paušální Daň Tracking**: Monitor invoiced amounts against paušální daň limits (3 tiers)
- **Dashboard**: Overview of revenue, outstanding payments, and recent activity
- **Multi-currency**: Support for CZK and EUR
- **Docker Ready**: Single command deployment with docker compose
- **Helm Chart**: Kubernetes deployment with Helm chart (built-in PostgreSQL StatefulSet, ingress support)

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- (Optional) SMTP server for sending emails
- (Optional) IMAP access for receiving bank notifications

### Deployment

1. Clone the repository:
```bash
git clone https://github.com/yourusername/essential-invoice.git
cd essential-invoice
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Edit `.env` with your settings: (required: JWT_SECRET, DB_PASSWORD)
```bash
# Required: Set a secure JWT secret (min 32 characters)
JWT_SECRET=your_secure_jwt_secret_here_min_32_chars

# Required: Set database password
DB_PASSWORD=your_secure_database_password

```

4. Start the application:
```bash
docker compose up -d
```

5. Access the application at `http://localhost`

6. Register your first user account

### Kubernetes (Helm)

```bash
cd helm-chart
helm install essential-invoice . \
  --namespace essential-invoice \
  --create-namespace \
  --set jwtSecret=$(openssl rand -base64 32) \
  --set postgresql.auth.password=$(openssl rand -base64 16)
```

See [helm-chart/README.md](helm-chart/README.md) for full configuration reference.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `db` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `essential_invoice` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `JWT_SECRET` | - | JWT signing secret (required) |
| `CORS_ORIGIN` | `http://localhost:5173` (dev)<br/>`http://localhost:8080` (Docker) | Allowed CORS origins (comma-separated) |
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

### SMTP Configuration (In-App)

Configure email sending in Settings > Email (SMTP):
- SMTP Host (e.g., `smtp.gmail.com`)
- Port (typically 587 for TLS, 465 for SSL)
- Username and password
- Sender email and name

### IMAP Configuration (In-App)

Configure bank notification receiving in Settings > Email (IMAP):
- IMAP Host (e.g., `imap.gmail.com`)
- Port (typically 993 for TLS)
- Username and password
- Bank notification email filter (e.g., `noreply@airbank.cz`)

### AI Features (Optional)

To enable AI-powered features, each user needs to configure their own Perplexity API key:

1. Get an API key from [https://www.perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)
2. Log in to Essential Invoice
3. Go to Settings (Nastavení)
4. Find the "AI funkce (Perplexity)" section
5. Enter your API key and save

Once configured, AI features become available in the application:
- Payment matching suggestions in the Payments page
- Tax advisor chatbot accessible from the AI assistant
- Financial insights on the Dashboard

## Usage Guide

### Setting Up Your Profile

1. Register your account (only name, email, password required)
2. Complete the **Onboarding Wizard** (2 steps):
   - **Step 1**: Company name, IČO, address, VAT payer status, DIČ, paušální daň settings
   - **Step 2**: Bank account, bank code, logo upload
3. After onboarding, you can update your details anytime in **Profile**:
   - Company name, address, IČO
   - VAT payer status (checkbox "Jsem plátce DPH"):
     - If **checked**: You are a VAT payer - DIČ will be shown on invoices
     - If **unchecked** (default): You are not a VAT payer - "Neplátce DPH" will be shown instead of DIČ on invoices
   - DIČ (only required if you are a VAT payer)
   - Bank account number and bank code (required for QR payment codes)
   - Paušální daň settings (tier, income limit)

### Adding Clients

1. Go to **Clients** and click "New Client"
2. Enter the client's ICO and click "Load from ARES" to auto-fill company details
3. Or manually enter: Company name, email (required), address, ICO, DIC

### Creating Invoices

1. Go to **Invoices** and click "New Invoice"
2. Select a client (auto-fills their details)
3. Set dates: Issue date and due date
4. Add line items with description, quantity, unit, and price
5. Select currency (CZK/EUR) and VAT rate
   - **Note**: If you set VAT rate to 0%, the VAT line will not be shown on the PDF invoice
6. Click "Create Invoice" (saves as Draft)

### Sending Invoices

1. Open the invoice detail page
2. Click "Send" button
3. Choose whether to also send to secondary email
4. Invoice is emailed as PDF attachment
5. Status changes to "Sent"

### Tracking Payments

Payments can be matched in two ways:

**Automatic (via IMAP):**
1. Configure IMAP settings in Settings
2. System checks for Air Bank notification emails
3. Payments are auto-matched by variable symbol (invoice number)
4. Invoice status updates to "Paid"

**Manual:**
1. Go to **Payments** page
2. Click "Match" on an unmatched payment
3. Select the corresponding invoice
4. Or manually mark invoice as paid from invoice detail

## API Reference

### Authentication
- `POST /api/auth/register` - Register new user (sends welcome email if global SMTP configured)
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update profile
- `POST /api/auth/change-password` - Change password (requires current password)
- `POST /api/auth/forgot-password` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token

### Clients
- `GET /api/clients` - List all clients
- `GET /api/clients/:id` - Get client details
- `GET /api/clients/:id/invoices` - Get client's invoices
- `POST /api/clients` - Create client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Invoices
- `GET /api/invoices` - List invoices (filters: status, clientId, from, to)
- `GET /api/invoices/:id` - Get invoice with items
- `GET /api/invoices/:id/pdf` - Download PDF
- `POST /api/invoices` - Create invoice
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete draft invoice
- `POST /api/invoices/:id/send` - Send via email
- `POST /api/invoices/:id/mark-paid` - Mark as paid
- `POST /api/invoices/:id/cancel` - Cancel invoice

### Expenses
- `GET /api/expenses` - List expenses (filters: status, clientId, from, to)
- `GET /api/expenses/:id` - Get expense details
- `GET /api/expenses/:id/file` - Download attached file
- `POST /api/expenses` - Create expense with optional file upload
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense
- `POST /api/expenses/:id/mark-paid` - Mark as paid
- `POST /api/expenses/:id/cancel` - Cancel expense

### Payments
- `GET /api/payments` - List payments (filter: matched)
- `GET /api/payments/unmatched` - List unmatched payments
- `GET /api/payments/:id/matches` - Get potential invoice matches
- `POST /api/payments/:id/match` - Match to invoice
- `POST /api/payments/:id/unmatch` - Remove match
- `DELETE /api/payments/:id` - Delete unmatched payment
- `POST /api/payments/check-emails` - Check for new payments from email

### ARES
- `GET /api/ares/lookup/:ico` - Lookup company by ICO
- `GET /api/ares/validate/:ico` - Validate ICO checksum

### Dashboard
- `GET /api/dashboard` - Get dashboard statistics

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings
- `POST /api/settings/test-smtp` - Test SMTP connection
- `POST /api/settings/test-imap` - Test IMAP connection

### AI (Perplexity)
- `GET /api/ai/status` - Check AI feature availability
- `POST /api/ai/match-payment` - AI-powered payment matching
- `POST /api/ai/tax-advisor` - Czech tax advisor chat

## Development

### Local Development Setup

**Important:** For local development, the frontend runs on port 5173 (Vite default).  
Make sure your `.env` file has: `CORS_ORIGIN=http://localhost:5173`

1. Start database:
```bash
docker compose up -d db
```

2. Backend:
```bash
cd backend
pnpm install
cp ../.env.example .env
# Edit .env - ensure CORS_ORIGIN=http://localhost:5173 for local dev
pnpm run dev
```

3. Frontend:
```bash
cd frontend
pnpm install
pnpm run dev
```

### Running Tests

Both backend and frontend include comprehensive test suites using Vitest.

**Backend tests:**
```bash
cd backend
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report
```

**Frontend tests:**
```bash
cd frontend
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report
```

**Test coverage includes:**
- Air Bank email parsing (incoming payment detection, field extraction)
- Bank parser factory (bank detection, payment parsing)
- Validation utilities (IČO checksum, email, currency formatting, SPAYD)
- API routes (authentication, authorization, validation)
- Frontend utilities (date/currency formatting, status labels)

### Project Structure

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
├── .github/workflows/       # CI/CD (Docker build)
├── helm-chart/
│   ├── Chart.yaml              # Helm chart metadata + dependencies
│   ├── values.yaml             # Default configuration values
│   ├── README.md               # Helm chart documentation
│   └── templates/              # Kubernetes manifests
├── docker-compose.yml
├── docker-compose.production.yml
├── .env.example
├── CLAUDE.md
└── README.md
```

## Bank Support

Currently supported:
- **Air Bank** - Parses incoming payment notification emails

The bank parsing system is designed to be extensible. To add support for another bank:

1. Create a new parser in `backend/src/services/bankParsers/`
2. Implement the `ParsedPayment` interface
3. Register the parser in `bankParsers/index.ts`

## Security

- All API endpoints (except auth) require JWT authentication
- Passwords are hashed with bcrypt (12 rounds)
- Rate limiting on API endpoints (100 requests/15 min)
- HTTPS recommended for production (configure via reverse proxy)
- Environment-based configuration (no hardcoded secrets)
- Input validation on all endpoints

## Troubleshooting

### Common Issues

**PDF generation fails:**
- Ensure Chromium is installed in the Docker container
- Check logs: `docker compose logs backend`

**Email sending fails:**
- Verify SMTP settings in Settings page
- Test connection with the "Test" button
- Check if 2FA requires app password (Gmail, etc.)

**Bank notifications not received:**
- Verify IMAP settings
- Check that bank notification email filter is correct
- Ensure email is marked as unread in inbox

**Database connection errors:**
- Wait for database to be healthy before backend starts
- Check `docker compose logs db`

### Logs

```bash
# All logs
docker compose logs

# Backend logs
docker compose logs backend

# Database logs
docker compose logs db
```

## Backup

### Database Backup

```bash
# Create backup
docker compose exec db pg_dump -U postgres essential_invoice > backup.sql

# Restore backup
docker compose exec -T db psql -U postgres essential_invoice < backup.sql
```

### Volume Backup

```bash
# Stop containers
docker compose down

# Backup volume
docker run --rm -v essential-invoice_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz -C /data .

# Restore volume
docker run --rm -v essential-invoice_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/db-backup.tar.gz -C /data
```

## License

MIT License - See LICENSE file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

### Documentation Guidelines

When contributing code changes, **always update the documentation** to reflect your changes:

1. **Added a new feature?**
   - Add it to the "Features" section
   - Document the API endpoints in "API Reference"
   - Update the project structure tree if needed
   - Update CLAUDE.md architecture section

2. **Changed existing behavior?**
   - Update the relevant sections in README.md
   - Update usage examples if applicable
   - Update CLAUDE.md if architecture changed

3. **Added configuration options?**
   - Add to .env.example with clear comments
   - Document in the "Configuration" section
   - Update CLAUDE.md "Environment" section

4. **Changed dependencies?**
   - Update mentions in both README.md and CLAUDE.md
   - Ensure accuracy (e.g., don't say "Puppeteer" if you switched to "pdfmake")

**Documentation is part of your contribution.** PRs with outdated documentation may be rejected.

## Support

For issues and feature requests, please use the GitHub issue tracker.
