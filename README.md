# Essential Invoice

A lightweight, self-hosted invoicing web application designed for Czech freelancers and small businesses. Features include PDF invoice generation with QR payment codes, SMTP email sending, and automatic bank payment matching via IMAP.

## Features

- **AI-Powered Features** (New! 🤖):
  - Smart payment matching with Perplexity AI
  - Invoice categorization and insights
  - Czech tax & accounting advisor chatbot
  - Real-time financial insights
- **Invoice Management**: Create, edit, delete, and send invoices with automatic numbering
- **Client Management**: Store and manage client contacts with ARES API integration for Czech companies
- **PDF Generation**: Professional Czech invoice templates with QR payment codes (SPAYD format)
- **Email Integration**: Send invoices via SMTP, receive bank notifications via IMAP
- **Bank Payment Matching**: Automatic matching of Air Bank payment notifications to invoices
- **Dashboard**: Overview of revenue, outstanding payments, and recent activity
- **Multi-currency**: Support for CZK and EUR
- **Docker Ready**: Single command deployment with docker compose

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

3. Edit `.env` with your settings:
```bash
# Required: Set a secure JWT secret (min 32 characters)
JWT_SECRET=your_secure_jwt_secret_here_min_32_chars

# Required: Set database password
DB_PASSWORD=your_secure_database_password

# Note: AI features are now configured per-user in Settings page
# Each user can add their own Perplexity API key in Settings > AI Features
# No need to set PERPLEXITY_API_KEY here anymore
```

4. Start the application:
```bash
docker compose up -d
```

5. Access the application at `http://localhost`

6. Register your first user account

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

**Benefits of per-user configuration:**
- Each user controls their own AI quota
- Better privacy and security
- Individual cost tracking
- Users can opt-in as needed

See [AI_FEATURES.md](AI_FEATURES.md) for detailed documentation.

## Usage Guide

### Setting Up Your Profile

1. Register/Login to your account
2. Go to **Profile** and fill in your company details:
   - Company name, address, ICO, DIC
   - Bank account number and bank code (required for QR payment codes)

### Adding Clients

1. Go to **Clients** and click "New Client"
2. Enter the client's ICO and click "Load from ARES" to auto-fill company details
3. Or manually enter: Company name, email (required), address, ICO, DIC

### Creating Invoices

1. Go to **Invoices** and click "New Invoice"
2. Select a client (auto-fills their details)
3. Set dates: Issue date, due date, delivery date (DUZP)
4. Add line items with description, quantity, unit, and price
5. Select currency (CZK/EUR) and VAT rate
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
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update profile
- `POST /api/auth/change-password` - Change password

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

### Payments
- `GET /api/payments` - List payments (filter: matched)
- `GET /api/payments/unmatched` - List unmatched payments
- `GET /api/payments/:id/matches` - Get potential invoice matches
- `POST /api/payments/:id/match` - Match to invoice
- `POST /api/payments/:id/unmatch` - Remove match

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
│   │   ├── db/           # Database initialization
│   │   ├── middleware/   # Auth middleware
│   │   ├── routes/       # API routes
│   │   └── services/     # Business logic
│   │       ├── bankParsers/  # Bank email parsers
│   │       ├── emailPoller.ts
│   │       ├── emailSender.ts
│   │       └── pdfGenerator.ts
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/   # Shared components
│   │   ├── context/      # React context
│   │   ├── pages/        # Page components
│   │   └── utils/        # Utilities
│   ├── Dockerfile
│   └── package.json
├── docker compose.yml
├── .env.example
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

## Support

For issues and feature requests, please use the GitHub issue tracker.
