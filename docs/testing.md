# Testing Guide

Guide for running and writing tests in Essential Invoice.

## Overview

Essential Invoice uses **Vitest** as the testing framework for both backend and frontend. Tests are co-located with source files using the `*.test.ts` or `*.test.tsx` naming convention.

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
pnpm test

# Run in watch mode (re-runs on file changes)
pnpm test:watch

# Run with coverage report
pnpm test:coverage

# Run specific test file
pnpm vitest run src/utils/validation.test.ts

# Run tests matching pattern
pnpm vitest run validation
```

### Frontend Tests

```bash
cd frontend

# Run all tests
pnpm test

# Run in watch mode
pnpm test:watch

# Run with coverage report
pnpm test:coverage

# Run specific test file
pnpm vitest run src/utils/format.test.ts

# Run tests matching pattern
pnpm vitest run format
```

## Test Structure

### Backend Test Example

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Subfeature', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test data';

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe('expected output');
    });

    it('should handle edge case', () => {
      const result = functionToTest(null);
      expect(result).toBeNull();
    });
  });
});
```

### Frontend Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('renders correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles user interaction', () => {
    render(<ComponentName />);
    const button = screen.getByRole('button', { name: 'Click Me' });
    
    fireEvent.click(button);
    
    expect(screen.getByText('Clicked!')).toBeInTheDocument();
  });
});
```

## Current Test Coverage

### Backend

#### Utilities (`src/utils/validation.test.ts`)
- ✅ IČO validation
- ✅ IČO checksum calculation
- ✅ Email validation
- ✅ Currency formatting (CZK, EUR)
- ✅ SPAYD QR code generation
- ✅ IBAN conversion

#### Bank Parsers (`src/services/bankParsers/`)
- ✅ Air Bank email parsing
- ✅ Payment amount extraction
- ✅ Variable symbol extraction
- ✅ Date parsing
- ✅ Bank detection

#### API Routes (future)
- ⏳ Authentication endpoints
- ⏳ Invoice CRUD operations
- ⏳ Client management
- ⏳ Payment matching

### Frontend

#### Utilities (`src/utils/format.test.ts`)
- ✅ Date formatting (Czech locale)
- ✅ Currency formatting
- ✅ Status label translation
- ✅ Number formatting

#### Components (future)
- ⏳ Layout component
- ⏳ Form components
- ⏳ Invoice list
- ⏳ Dashboard widgets

## Writing Tests

### Testing Utilities

#### Backend - Pure Functions

```typescript
// src/utils/myUtil.ts
export function calculateTotal(items: InvoiceItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

// src/utils/myUtil.test.ts
import { describe, it, expect } from 'vitest';
import { calculateTotal } from './myUtil';

describe('calculateTotal', () => {
  it('calculates total for single item', () => {
    const items = [{ quantity: 2, unitPrice: 100 }];
    expect(calculateTotal(items)).toBe(200);
  });

  it('calculates total for multiple items', () => {
    const items = [
      { quantity: 2, unitPrice: 100 },
      { quantity: 3, unitPrice: 50 },
    ];
    expect(calculateTotal(items)).toBe(350);
  });

  it('returns 0 for empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });
});
```

### Testing Services

#### Backend - Database Service

```typescript
// src/services/invoiceService.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createInvoice } from './invoiceService';

// Mock database
vi.mock('../db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('createInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates invoice with items', async () => {
    const mockQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // Invoice insert
      .mockResolvedValueOnce({ rows: [] });           // Items insert

    const invoice = await createInvoice(userId, invoiceData);
    
    expect(invoice.id).toBe(1);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});
```

### Testing API Endpoints

```typescript
// src/routes/invoices.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';

describe('Invoice API', () => {
  let token: string;
  let invoiceId: number;

  beforeAll(async () => {
    // Login and get token
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password' });
    token = response.body.token;
  });

  describe('POST /api/invoices', () => {
    it('creates new invoice', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          client_id: 1,
          issue_date: '2024-01-15',
          due_date: '2024-02-15',
          items: [
            { description: 'Service', quantity: 1, unit_price: 1000 }
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.invoice_number).toBeDefined();
      invoiceId = response.body.id;
    });

    it('requires authentication', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .send({});

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('returns invoice details', async () => {
      const response = await request(app)
        .get(`/api/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(invoiceId);
      expect(response.body.items).toBeInstanceOf(Array);
    });
  });
});
```

### Testing React Components

```typescript
// src/pages/Dashboard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { Dashboard } from './Dashboard';

// Mock API
vi.mock('../utils/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      total_revenue: 100000,
      outstanding_amount: 25000,
    }),
  },
}));

describe('Dashboard', () => {
  it('displays revenue statistics', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Dashboard />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('100 000 Kč')).toBeInTheDocument();
      expect(screen.getByText('25 000 Kč')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Dashboard />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
```

## Test Best Practices

### 1. Test Naming

Use descriptive test names:

```typescript
// Good
it('should validate IČO with correct checksum', () => {});
it('should return null when parsing invalid email', () => {});
it('should format Czech currency with spaces', () => {});

// Bad
it('works', () => {});
it('test1', () => {});
it('should test the function', () => {});
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should calculate invoice total', () => {
  // Arrange - set up test data
  const items = [
    { quantity: 2, unitPrice: 100 },
    { quantity: 3, unitPrice: 50 },
  ];

  // Act - perform the action
  const total = calculateTotal(items);

  // Assert - verify the result
  expect(total).toBe(350);
});
```

### 3. Test One Thing at a Time

```typescript
// Good - focused tests
it('should parse amount from email', () => {
  const email = { text: 'Amount: 10000 CZK' };
  expect(parser.parseAmount(email)).toBe(10000);
});

it('should parse variable symbol from email', () => {
  const email = { text: 'VS: 2024001' };
  expect(parser.parseVariableSymbol(email)).toBe('2024001');
});

// Bad - testing multiple things
it('should parse email', () => {
  const email = { text: 'Amount: 10000 CZK, VS: 2024001' };
  expect(parser.parseAmount(email)).toBe(10000);
  expect(parser.parseVariableSymbol(email)).toBe('2024001');
});
```

### 4. Test Edge Cases

```typescript
describe('validateIco', () => {
  it('validates correct IČO', () => {
    expect(validateIco('12345678')).toBe(true);
  });

  it('rejects IČO with invalid checksum', () => {
    expect(validateIco('12345679')).toBe(false);
  });

  it('rejects non-numeric IČO', () => {
    expect(validateIco('abcd1234')).toBe(false);
  });

  it('rejects IČO with wrong length', () => {
    expect(validateIco('123')).toBe(false);
    expect(validateIco('123456789')).toBe(false);
  });

  it('handles null input', () => {
    expect(validateIco(null)).toBe(false);
  });

  it('handles undefined input', () => {
    expect(validateIco(undefined)).toBe(false);
  });
});
```

### 5. Use Mocks Appropriately

```typescript
// Mock external dependencies
vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: '123' }),
  }),
}));

// Don't mock internal code you're testing
// Bad:
vi.mock('./myFunction');  // Then how do you test it?

// Good:
import { myFunction } from './myFunction';  // Import and test directly
```

### 6. Clean Up After Tests

```typescript
describe('Email Service', () => {
  let transporter;

  beforeEach(() => {
    transporter = createTransporter();
  });

  afterEach(() => {
    // Clean up resources
    transporter.close();
    vi.clearAllMocks();
  });

  it('sends email', async () => {
    // Test implementation
  });
});
```

## Continuous Integration

Tests are automatically run on:
- Pull requests
- Commits to main branch
- Before deployment

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - run: cd backend && pnpm install
      - run: cd backend && pnpm test

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - run: cd frontend && pnpm install
      - run: cd frontend && pnpm test
```

## Coverage Goals

Current coverage targets:
- **Utilities**: 90%+ (critical business logic)
- **Services**: 80%+ (business logic)
- **API Routes**: 70%+ (integration tests)
- **Components**: 60%+ (UI components)

View coverage reports:
```bash
cd backend && pnpm test:coverage
cd frontend && pnpm test:coverage
```

Coverage reports are generated in:
- `backend/coverage/`
- `frontend/coverage/`

Open `coverage/index.html` in a browser to view detailed coverage.

## What to Test

### High Priority
- ✅ Business logic (calculations, validations)
- ✅ Utilities and helpers
- ✅ Data parsing and formatting
- ✅ API endpoints
- ✅ Authentication and authorization

### Medium Priority
- ⏳ UI components
- ⏳ Form validation
- ⏳ User interactions
- ⏳ Error handling

### Low Priority
- Configuration files
- Type definitions
- Simple getters/setters
- Third-party library wrappers

## Debugging Tests

### Run Single Test

```bash
pnpm vitest run path/to/test.ts
```

### Run Tests in UI Mode

```bash
pnpm vitest --ui
```

Opens a browser interface for running and debugging tests.

### Add Debug Output

```typescript
it('debugs calculation', () => {
  const result = calculateTotal(items);
  console.log('Result:', result);  // Will show in test output
  expect(result).toBe(350);
});
```

### Use Vitest Debugger

```typescript
import { vi } from 'vitest';

it('debugs with breakpoint', () => {
  debugger;  // Execution will pause here when debugging
  const result = functionToTest();
  expect(result).toBe(expected);
});
```

Run with debugger:
```bash
node --inspect-brk ./node_modules/.bin/vitest run test.ts
```

## Common Testing Patterns

### Testing Async Functions

```typescript
it('handles async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('success');
});

it('handles async rejection', async () => {
  await expect(asyncFunction()).rejects.toThrow('Error message');
});
```

### Testing Timers

```typescript
import { vi } from 'vitest';

it('waits for timeout', () => {
  vi.useFakeTimers();
  
  const callback = vi.fn();
  setTimeout(callback, 1000);
  
  vi.advanceTimersByTime(1000);
  
  expect(callback).toHaveBeenCalled();
  
  vi.useRealTimers();
});
```

### Testing Errors

```typescript
it('throws error on invalid input', () => {
  expect(() => validateInput('')).toThrow('Input required');
  expect(() => validateInput(null)).toThrow();
});
```

### Snapshot Testing

```typescript
it('matches snapshot', () => {
  const output = generateInvoiceData(input);
  expect(output).toMatchSnapshot();
});
```

Update snapshots:
```bash
pnpm vitest -u
```

## Next Steps

1. **Increase coverage** for existing code
2. **Add E2E tests** with Playwright or Cypress
3. **Add integration tests** for full user workflows
4. **Performance tests** for database queries
5. **Security tests** for authentication and authorization
