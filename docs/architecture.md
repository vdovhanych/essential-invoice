# Architecture

Technical architecture and design decisions for Essential Invoice.

## System Overview

Essential Invoice is a full-stack web application built with:

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Express + TypeScript + Node.js
- **Database**: PostgreSQL
- **Deployment**: Docker + Docker Compose

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Browser                       │
│                    (React SPA on Vite)                      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/HTTPS
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      Nginx (Production)                      │
│              Serves static files + reverse proxy             │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                  │
┌───────▼────────┐              ┌─────────▼─────────┐
│   Frontend     │              │    Backend API     │
│   (Port 80)    │              │   (Port 3001)      │
│                │              │                    │
│  React + Vite  │              │  Express + Node.js │
│  TailwindCSS   │              │   TypeScript       │
└────────────────┘              └─────────┬──────────┘
                                          │
                                ┌─────────▼──────────┐
                                │   PostgreSQL DB    │
                                │   (Port 5432)      │
                                └────────────────────┘
                                          │
                                ┌─────────▼──────────┐
                                │  External Services │
                                │  - SMTP Server     │
                                │  - IMAP Server     │
                                │  - ARES API        │
                                │  - Perplexity AI   │
                                └────────────────────┘
```

## Backend Architecture

### Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database Client**: node-postgres (pg)
- **Authentication**: JWT (jsonwebtoken)
- **Email**: nodemailer (SMTP/IMAP)
- **PDF Generation**: pdfmake
- **File Upload**: multer
- **Validation**: Built-in validation utilities
- **Testing**: Vitest

### Directory Structure

```
backend/src/
├── db/                    # Database layer
│   ├── init.ts           # Schema definitions (CREATE TABLE)
│   └── migrate.ts        # Migration runner
├── middleware/           # Express middleware
│   └── auth.ts          # JWT authentication
├── routes/              # API route handlers
│   ├── auth.ts         # User authentication
│   ├── clients.ts      # Client management
│   ├── invoices.ts     # Invoice management
│   ├── expenses.ts     # Expense tracking
│   ├── payments.ts     # Payment management
│   ├── settings.ts     # User settings
│   ├── ares.ts         # ARES API integration
│   ├── dashboard.ts    # Dashboard statistics
│   └── ai.ts           # AI features
├── services/           # Business logic
│   ├── bankParsers/   # Bank email parsers
│   ├── emailPoller.ts # IMAP polling service
│   ├── emailSender.ts # SMTP sending service
│   ├── pdfGenerator.ts # PDF generation
│   └── perplexityAI.ts # AI integration
├── utils/             # Utilities
│   └── validation.ts  # Validation helpers
└── index.ts          # Application entry point
```

### Key Components

#### 1. Express Application (index.ts)

- Initializes Express app
- Configures middleware (CORS, JSON parsing, rate limiting)
- Mounts API routes
- Starts HTTP server
- Initializes email polling service

#### 2. Authentication Middleware

**JWT-based authentication:**
- Token generation on login/register
- Token verification on protected routes
- User context injection into requests

```typescript
interface AuthRequest extends Request {
  userId?: number;
  user?: User;
}
```

#### 3. Database Layer

**Schema Management:**
- Uses `CREATE TABLE IF NOT EXISTS` for idempotency
- Inline `ALTER TABLE` migrations
- No separate migration files
- Run with `pnpm run migrate`

**Connection Pooling:**
- Uses pg Pool for connection management
- Configured via environment variables
- Automatic reconnection on failure

**Tables:**
- `users` - User accounts and profiles
- `clients` - Client contacts
- `invoices` - Invoice headers
- `invoice_items` - Invoice line items
- `expenses` - Expense records
- `payments` - Payment records
- `settings` - User-specific settings

#### 4. PDF Generation Service

**Library**: pdfmake

**Features:**
- Czech invoice template
- QR payment codes (SPAYD format)
- VAT/non-VAT payer support
- Logo embedding
- Multi-currency support

**Process:**
1. Fetch invoice data from database
2. Format data for Czech invoice standards
3. Generate SPAYD QR code
4. Compose PDF document definition
5. Generate PDF buffer
6. Return as downloadable file

#### 5. Email Services

**SMTP (emailSender.ts):**
- Sends invoices as PDF attachments
- Configurable per user
- Connection testing
- Error handling

**IMAP (emailPoller.ts):**
- Polls inbox every 5 minutes
- Filters by sender email
- Parses bank notification emails
- Creates payment records
- Auto-matches to invoices
- Marks emails as read

#### 6. Bank Parser System

**Extensible architecture:**

```typescript
interface ParsedPayment {
  amount: number;
  currency: string;
  variableSymbol?: string;
  date: Date;
  description: string;
}

interface BankParser {
  canParse(email: EmailData): boolean;
  parse(email: EmailData): ParsedPayment | null;
}
```

**Factory pattern:**
- Register parsers for different banks
- Auto-detect bank from email sender
- Parse payment details from email content

**Current implementations:**
- Air Bank (`airbank.ts`)

#### 7. ARES Integration

**Czech company registry API:**
- Lookup company by IČO
- Auto-fill company details
- Validate IČO checksum
- Extract DIČ (VAT ID)

#### 8. AI Integration (Perplexity)

**Features:**
- Payment matching suggestions
- Tax advisor chatbot
- Financial insights

**Implementation:**
- User-specific API keys
- Context-aware queries
- Czech language support

### API Design

**RESTful principles:**
- Resource-based URLs
- HTTP methods (GET, POST, PUT, DELETE)
- JSON request/response bodies
- Proper status codes

**Authentication:**
- `Authorization: Bearer <token>` header
- Token includes user ID
- Middleware verifies and injects user context

**Error Handling:**
- Try/catch blocks in all routes
- Consistent error response format
- Proper HTTP status codes
- Logged errors for debugging

**Rate Limiting:**
- 100 requests per 15 minutes per IP
- Prevents abuse
- Returns 429 status when exceeded

## Frontend Architecture

### Technology Stack

- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Routing**: React Router v6
- **State Management**: React Context API
- **HTTP Client**: Fetch API (wrapped in utils/api.ts)
- **Testing**: Vitest + React Testing Library

### Directory Structure

```
frontend/src/
├── components/          # Reusable components
│   ├── Layout.tsx      # Main layout with nav
│   └── AIAssistant.tsx # AI chat component
├── context/            # React Context providers
│   ├── AuthContext.tsx # Authentication state
│   └── AIContext.tsx   # AI assistant state
├── pages/              # Page components
│   ├── Dashboard.tsx
│   ├── Clients.tsx
│   ├── Invoices.tsx
│   ├── Expenses.tsx
│   ├── Payments.tsx
│   ├── Settings.tsx
│   └── ...
├── utils/              # Utility functions
│   ├── api.ts         # API client wrapper
│   └── format.ts      # Formatting helpers
├── test/              # Test setup
├── App.tsx            # Root component + routing
└── main.tsx           # Entry point
```

### Key Components

#### 1. Application Entry (main.tsx)

- Renders React app to DOM
- Wraps app with Context providers
- Mounts to `#root` element

#### 2. Routing (App.tsx)

**React Router v6:**
- Browser-based routing
- Protected routes (require authentication)
- Public routes (login, register)
- Nested routes with Layout

```typescript
<Routes>
  <Route element={<Layout />}>
    <Route path="/" element={<Dashboard />} />
    <Route path="/clients" element={<Clients />} />
    // ...
  </Route>
  <Route path="/login" element={<Login />} />
</Routes>
```

#### 3. Authentication Context

**Manages auth state globally:**
- Current user
- JWT token (stored in localStorage)
- Login/logout functions
- Token refresh logic

**Provider wraps entire app:**
```typescript
<AuthProvider>
  <App />
</AuthProvider>
```

#### 4. Layout Component

**Consistent UI structure:**
- Navigation bar
- User menu
- Page content area
- Responsive design

#### 5. API Client (utils/api.ts)

**Centralized HTTP requests:**
- Base URL configuration
- Automatic token injection
- Error handling
- Response parsing

```typescript
export const api = {
  get: (url: string) => fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  }),
  post: (url: string, data: any) => // ...
  // ...
};
```

#### 6. Formatting Utilities

**Date formatting:**
- Czech locale (dd.mm.yyyy)
- ISO to display conversion

**Currency formatting:**
- CZK: "10 000 Kč"
- EUR: "1 000 €"

**Status labels:**
- Translated status names
- Color coding

### State Management

**Context API for global state:**
- AuthContext - User authentication
- AIContext - AI assistant state

**Local state for page-specific data:**
- useState for form inputs
- useEffect for data fetching

**No Redux/MobX:**
- App complexity doesn't warrant it
- Context API sufficient for current needs

### Styling Strategy

**TailwindCSS utility-first:**
- Consistent design system
- Responsive utilities
- Dark mode support (future)

**Component-scoped styles:**
- Minimal custom CSS
- Utility classes in JSX

### Build Process

**Vite for fast development:**
- Hot Module Replacement (HMR)
- Fast cold start
- Optimized production builds

**Production build:**
1. TypeScript compilation
2. Vite bundling
3. Asset optimization
4. Output to `dist/`

**Deployment:**
- Nginx serves static files
- Production Dockerfile builds and serves

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  ico VARCHAR(8),
  dic VARCHAR(12),
  address TEXT,
  bank_account VARCHAR(50),
  bank_code VARCHAR(4),
  vat_payer BOOLEAN DEFAULT FALSE,
  logo_path VARCHAR(255),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  pausalni_dan_enabled BOOLEAN DEFAULT FALSE,
  pausalni_dan_tier INTEGER,
  pausalni_dan_limit DECIMAL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Clients Table

```sql
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  ico VARCHAR(8),
  dic VARCHAR(12),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Invoices Table

```sql
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  client_id INTEGER REFERENCES clients(id),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount DECIMAL NOT NULL,
  currency VARCHAR(3) DEFAULT 'CZK',
  vat_rate DECIMAL DEFAULT 21,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Invoice Items Table

```sql
CREATE TABLE invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL NOT NULL,
  unit VARCHAR(50),
  unit_price DECIMAL NOT NULL,
  total_price DECIMAL NOT NULL
);
```

### Payments Table

```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount DECIMAL NOT NULL,
  currency VARCHAR(3) NOT NULL,
  variable_symbol VARCHAR(50),
  payment_date DATE NOT NULL,
  description TEXT,
  matched_invoice_id INTEGER REFERENCES invoices(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Security Design

### Authentication

**JWT tokens:**
- Signed with JWT_SECRET
- Expire after 7 days (configurable)
- Stored in localStorage on client
- Sent in Authorization header

### Password Security

**bcrypt hashing:**
- 12 salt rounds
- Hashed before storage
- Never transmitted or logged

### Authorization

**User-specific data isolation:**
- All queries filter by user_id
- Middleware injects user context
- No cross-user data access

### Input Validation

**All inputs validated:**
- Required fields checked
- Email format validation
- IČO checksum validation
- SQL injection prevented (parameterized queries)
- XSS prevention (React escaping + sanitization)

### Rate Limiting

**Express rate limiter:**
- 100 requests per 15 minutes per IP
- Prevents brute force attacks
- Returns 429 status when exceeded

### CORS Configuration

**Configured for specific origins:**
- Development: http://localhost:5173
- Production: http://localhost:8080 or custom domain
- No wildcard origins in production

## Deployment Architecture

### Docker Compose

**Three services:**

1. **PostgreSQL Database**
   - Official postgres:14 image
   - Persistent volume for data
   - Health check for readiness

2. **Backend API**
   - Custom Node.js image
   - Depends on database
   - Environment variables from .env

3. **Frontend**
   - Nginx serving static build
   - Reverse proxy to backend API
   - Optimized for production

### Production Considerations

**Reverse Proxy (Recommended):**
- Nginx or Caddy in front of Docker
- SSL/TLS termination
- Domain routing
- Load balancing (if scaled)

**Database:**
- Regular backups
- Separate volume backups
- Connection pooling
- Query optimization

**Monitoring:**
- Application logs
- Database logs
- Error tracking (optional: Sentry)
- Uptime monitoring

**Scaling:**
- Backend can be horizontally scaled
- Database connection pool handles multiple instances
- Frontend served by CDN or multiple nginx instances

## Design Decisions

### Why Express instead of NestJS/Fastify?

- **Simplicity**: Express is well-understood and straightforward
- **Ecosystem**: Huge ecosystem of middleware and libraries
- **Performance**: Sufficient for small-to-medium deployments
- **Learning curve**: Low barrier to entry for contributors

### Why Context API instead of Redux?

- **Complexity**: Redux adds unnecessary boilerplate for this app size
- **Sufficient**: Context API handles global state adequately
- **Performance**: No performance issues at current scale
- **Maintainability**: Simpler codebase

### Why pdfmake instead of Puppeteer?

- **Performance**: pdfmake is faster (no headless browser)
- **Resources**: Lower memory/CPU usage
- **Docker**: Smaller image size, no Chromium needed
- **Reliability**: Fewer moving parts, fewer failures

### Why PostgreSQL instead of MongoDB?

- **Relational data**: Invoices/clients/payments are relational
- **ACID compliance**: Financial data requires transactions
- **Querying**: SQL is powerful for complex queries
- **Ecosystem**: Mature tools and libraries

### Why TypeScript everywhere?

- **Type safety**: Catch errors at compile time
- **IDE support**: Better autocomplete and refactoring
- **Documentation**: Types serve as inline documentation
- **Maintenance**: Easier to maintain and refactor

## Future Enhancements

### Planned Features

1. **Multi-user organizations**: Multiple users per company
2. **Recurring invoices**: Auto-generate recurring invoices
3. **Invoice templates**: Customizable PDF templates
4. **More banks**: Support for additional Czech banks
5. **Mobile app**: React Native mobile client
6. **Export/import**: CSV/Excel export for accounting software
7. **Webhooks**: External system integrations
8. **Multi-language**: English/Czech UI switching

### Scalability Improvements

1. **Caching**: Redis for session/query caching
2. **Queue system**: Bull/BullMQ for async tasks
3. **CDN**: CloudFront/CloudFlare for static assets
4. **Database replicas**: Read replicas for reporting
5. **Microservices**: Split services if needed

### Technical Debt

1. **Test coverage**: Increase to 80%+
2. **E2E tests**: Add Playwright/Cypress tests
3. **API documentation**: Add OpenAPI/Swagger
4. **Logging**: Structured logging with Winston
5. **Monitoring**: Add application monitoring (Prometheus/Grafana)
