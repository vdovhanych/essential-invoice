# Development Setup

Guide for setting up Essential Invoice for local development.

## Prerequisites

- **Node.js**: v18 or higher
- **pnpm**: Package manager (install with `npm install -g pnpm`)
- **Docker & Docker Compose**: For running PostgreSQL
- **Git**: For version control

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/vdovhanych/essential-invoice.git
cd essential-invoice
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` and configure at minimum:
```bash
JWT_SECRET=your_secure_jwt_secret_here_min_32_chars
DB_PASSWORD=your_secure_database_password
CORS_ORIGIN=http://localhost:5173  # Important for local dev!
```

### 3. Start PostgreSQL Database

```bash
docker compose up -d db
```

Wait for the database to be ready:
```bash
docker compose logs db
```

### 4. Set Up Backend

```bash
cd backend
pnpm install
pnpm run migrate  # Run database migrations
pnpm run dev      # Start development server
```

Backend will run on `http://localhost:3001`

### 5. Set Up Frontend

Open a new terminal:

```bash
cd frontend
pnpm install
pnpm run dev      # Start Vite dev server
```

Frontend will run on `http://localhost:5173`

### 6. Access the Application

Open your browser and go to `http://localhost:5173`

## Development Workflow

### Backend Development

The backend uses **tsx** with watch mode for hot reloading.

**Start backend:**
```bash
cd backend
pnpm run dev
```

**Run tests:**
```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report
```

**Run specific test file:**
```bash
pnpm vitest run src/utils/validation.test.ts
```

**Build for production:**
```bash
pnpm run build
pnpm run start
```

**Database migrations:**
```bash
pnpm run migrate
```

### Frontend Development

The frontend uses **Vite** with hot module replacement (HMR).

**Start frontend:**
```bash
cd frontend
pnpm run dev
```

**Run tests:**
```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report
```

**Run specific test file:**
```bash
pnpm vitest run src/utils/format.test.ts
```

**Build for production:**
```bash
pnpm run build
```

**Preview production build:**
```bash
pnpm run preview
```

## Project Structure

```
essential-invoice/
├── backend/
│   ├── src/
│   │   ├── db/                  # Database initialization and migrations
│   │   │   ├── init.ts          # Schema definition (CREATE TABLE IF NOT EXISTS)
│   │   │   └── migrate.ts       # Migration runner
│   │   ├── middleware/          # Express middleware
│   │   │   └── auth.ts          # JWT authentication middleware
│   │   ├── routes/              # API route handlers
│   │   │   ├── auth.ts          # Authentication routes
│   │   │   ├── clients.ts       # Client management
│   │   │   ├── invoices.ts      # Invoice management
│   │   │   ├── expenses.ts      # Expense tracking
│   │   │   ├── payments.ts      # Payment management
│   │   │   ├── settings.ts      # User settings
│   │   │   ├── ares.ts          # ARES API integration
│   │   │   ├── dashboard.ts     # Dashboard statistics
│   │   │   └── ai.ts            # AI features (Perplexity)
│   │   ├── services/            # Business logic
│   │   │   ├── bankParsers/     # Bank email parsers
│   │   │   │   ├── index.ts     # Parser factory
│   │   │   │   └── airbank.ts   # Air Bank parser
│   │   │   ├── emailPoller.ts   # IMAP email polling
│   │   │   ├── emailSender.ts   # SMTP email sending
│   │   │   ├── pdfGenerator.ts  # PDF generation (pdfmake)
│   │   │   └── perplexityAI.ts  # Perplexity AI integration
│   │   ├── utils/               # Utility functions
│   │   │   └── validation.ts    # IČO, IBAN, SPAYD validation
│   │   └── index.ts             # Express app entry point
│   ├── uploads/                 # File uploads (logos, receipts)
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable components
│   │   │   ├── Layout.tsx       # Main layout with navigation
│   │   │   └── AIAssistant.tsx  # AI assistant component
│   │   ├── context/             # React Context providers
│   │   │   ├── AuthContext.tsx  # Authentication state
│   │   │   └── AIContext.tsx    # AI assistant state
│   │   ├── pages/               # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Clients.tsx
│   │   │   ├── ClientDetail.tsx
│   │   │   ├── Invoices.tsx
│   │   │   ├── InvoiceCreate.tsx
│   │   │   ├── InvoiceDetail.tsx
│   │   │   ├── Expenses.tsx
│   │   │   ├── ExpenseCreate.tsx
│   │   │   ├── ExpenseDetail.tsx
│   │   │   ├── Payments.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── Profile.tsx
│   │   │   ├── Calculator.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   └── Onboarding.tsx
│   │   ├── utils/               # Utility functions
│   │   │   ├── api.ts           # API client
│   │   │   └── format.ts        # Date/currency formatting
│   │   ├── test/                # Test setup
│   │   ├── App.tsx              # Root component with routing
│   │   └── main.tsx             # React app entry point
│   ├── public/                  # Static assets
│   ├── Dockerfile
│   ├── nginx.conf               # Production Nginx config
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docs/                        # Documentation
├── .github/
│   └── workflows/               # CI/CD pipelines
├── docker-compose.yml           # Development Docker config
├── docker-compose.production.yml
├── .env.example
├── CLAUDE.md                    # AI agent guidelines
└── README.md
```

## Common Development Tasks

### Adding a New API Endpoint

1. Create/modify route handler in `backend/src/routes/`
2. Add business logic in `backend/src/services/` if needed
3. Mount route in `backend/src/index.ts`
4. Write tests for the endpoint
5. Update documentation in `docs/api.md`

### Adding a New Frontend Page

1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Add navigation link in `frontend/src/components/Layout.tsx`
4. Write tests for the page
5. Update documentation in `CLAUDE.md`

### Adding a Database Migration

Migrations are inline in `backend/src/db/init.ts`:

1. Edit `backend/src/db/init.ts`
2. Add new `ALTER TABLE` or `CREATE TABLE` statements
3. Run migrations: `cd backend && pnpm run migrate`
4. Test the migration thoroughly

### Adding a New Bank Parser

1. Create new parser in `backend/src/services/bankParsers/yourbank.ts`
2. Implement the `ParsedPayment` interface
3. Register parser in `backend/src/services/bankParsers/index.ts`
4. Write tests for the parser
5. Update `docs/bank-support.md`

## Debugging

### Backend Debugging

Add debug points and use:

```bash
cd backend
node --inspect-brk node_modules/.bin/tsx src/index.ts
```

Connect your debugger (VS Code, Chrome DevTools) to `localhost:9229`

### Frontend Debugging

Use browser DevTools:
1. Open `http://localhost:5173`
2. Press F12 for DevTools
3. Use React DevTools extension for component inspection

### Database Inspection

Connect to PostgreSQL:

```bash
docker compose exec db psql -U postgres essential_invoice
```

Run SQL queries:
```sql
\dt                    -- List tables
SELECT * FROM users;   -- Query users
\q                     -- Quit
```

## Testing Guidelines

### Backend Tests

Located in `backend/src/**/*.test.ts`

**Test structure:**
```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  it('should do something', () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

**Running tests:**
```bash
cd backend
pnpm test              # All tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
```

### Frontend Tests

Located in `frontend/src/**/*.test.ts`

**Test structure:**
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('ComponentName', () => {
  it('renders correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

**Running tests:**
```bash
cd frontend
pnpm test              # All tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
```

## Code Style

Both projects use TypeScript with strict mode enabled.

**Backend:**
- Follow Express best practices
- Use async/await for asynchronous operations
- Validate inputs using Joi or similar
- Handle errors with try/catch and proper status codes

**Frontend:**
- Use functional components with hooks
- Follow React best practices
- Use TypeScript for type safety
- Keep components small and focused

## Docker Development

### Full Stack with Docker

```bash
docker compose up -d
```

Services:
- Frontend: `http://localhost:80`
- Backend: `http://localhost:3001`
- Database: `localhost:5432`

### Database Only

```bash
docker compose up -d db
```

This is useful when you want to run backend and frontend locally but use a containerized database.

### View Logs

```bash
docker compose logs backend    # Backend logs
docker compose logs frontend   # Frontend logs
docker compose logs db         # Database logs
docker compose logs -f         # Follow all logs
```

### Restart Services

```bash
docker compose restart backend
docker compose restart frontend
```

### Stop Services

```bash
docker compose down
```

## Troubleshooting

### Port Already in Use

If ports 3001, 5173, or 5432 are already in use:

1. Find the process: `lsof -i :3001`
2. Kill it: `kill -9 <PID>`
3. Or change ports in `.env` or docker-compose.yml

### Database Connection Errors

1. Ensure PostgreSQL is running: `docker compose ps`
2. Check database logs: `docker compose logs db`
3. Verify `.env` database credentials

### Frontend Not Loading

1. Check CORS settings in `.env`: `CORS_ORIGIN=http://localhost:5173`
2. Restart backend after changing CORS
3. Clear browser cache

### Module Not Found

```bash
cd backend && pnpm install
cd frontend && pnpm install
```

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Write/update tests
4. Update documentation
5. Run tests: `pnpm test` (both backend and frontend)
6. Commit: `git commit -m "Add my feature"`
7. Push: `git push origin feature/my-feature`
8. Create a Pull Request

See [Contributing Guidelines](../README.md#contributing) for more details.
