# Bank Support

Information about supported banks and how to add support for new banks.

## Currently Supported Banks

### Air Bank

**Email Parser**: `backend/src/services/bankParsers/airbank.ts`

**Features**:
- Parses incoming payment notification emails
- Extracts payment amount, currency, variable symbol, date
- Automatically matches payments to invoices
- Marks invoices as paid

**Notification Email Format**:
- Sender: `noreply@airbank.cz`
- Subject: Contains "Příchozí platba" or similar
- Body: Contains payment details in Czech

**Configuration**:
1. Go to Settings > Email (IMAP)
2. Set "Bank Email Filter" to: `noreply@airbank.cz`
3. Ensure IMAP is correctly configured
4. System will automatically detect and parse Air Bank emails

## How Bank Parsing Works

### Overview

```
┌─────────────────┐
│  Email Inbox    │
│  (IMAP Server)  │
└────────┬────────┘
         │
         │ Every 5 minutes
         │
┌────────▼────────────────┐
│  Email Poller Service   │
│  (emailPoller.ts)       │
└────────┬────────────────┘
         │
         │ Filter by sender
         │
┌────────▼────────────────┐
│  Bank Parser Factory    │
│  (bankParsers/index.ts) │
└────────┬────────────────┘
         │
         │ Detect bank & parse
         │
┌────────▼────────────────┐
│   Specific Bank Parser  │
│   (e.g., airbank.ts)    │
└────────┬────────────────┘
         │
         │ Extract payment data
         │
┌────────▼────────────────┐
│  Create Payment Record  │
│  Match to Invoice       │
│  Mark Invoice as Paid   │
└─────────────────────────┘
```

### Parser Interface

All bank parsers must implement the `BankParser` interface:

```typescript
interface ParsedPayment {
  amount: number;
  currency: string;
  variableSymbol?: string;
  specificSymbol?: string;
  constantSymbol?: string;
  date: Date;
  description: string;
  senderAccount?: string;
  senderName?: string;
}

interface BankParser {
  // Unique identifier for the bank
  bankName: string;
  
  // Check if this parser can handle the email
  canParse(email: EmailData): boolean;
  
  // Parse payment details from email
  parse(email: EmailData): ParsedPayment | null;
}
```

### Email Data Structure

```typescript
interface EmailData {
  from: string;        // Sender email address
  subject: string;     // Email subject
  text: string;        // Plain text body
  html?: string;       // HTML body (optional)
  date: Date;          // Email date
}
```

## Adding Support for a New Bank

### Step 1: Create Parser File

Create a new file in `backend/src/services/bankParsers/yourbank.ts`:

```typescript
import { BankParser, ParsedPayment, EmailData } from './types';

export class YourBankParser implements BankParser {
  bankName = 'YourBank';

  canParse(email: EmailData): boolean {
    // Check if email is from your bank
    return email.from.includes('noreply@yourbank.cz') ||
           email.from.includes('notifications@yourbank.cz');
  }

  parse(email: EmailData): ParsedPayment | null {
    try {
      // Extract payment details from email
      const amount = this.extractAmount(email.text);
      const variableSymbol = this.extractVariableSymbol(email.text);
      const date = this.extractDate(email.text);
      
      if (!amount || !date) {
        return null;
      }

      return {
        amount,
        currency: 'CZK',
        variableSymbol,
        date,
        description: email.subject,
        senderName: this.extractSenderName(email.text),
      };
    } catch (error) {
      console.error('Error parsing YourBank email:', error);
      return null;
    }
  }

  private extractAmount(text: string): number | null {
    // Regular expression to extract amount
    // Example: "Částka: 10 000 Kč" or "Amount: 10,000 CZK"
    const match = text.match(/(?:Částka|Amount):\s*([\d\s,\.]+)/i);
    if (!match) return null;
    
    // Remove spaces and convert to number
    const amount = parseFloat(match[1].replace(/[\s,]/g, ''));
    return isNaN(amount) ? null : amount;
  }

  private extractVariableSymbol(text: string): string | undefined {
    // Extract variable symbol (VS)
    const match = text.match(/(?:VS|Variabilní symbol):\s*(\d+)/i);
    return match ? match[1] : undefined;
  }

  private extractDate(text: string): Date | null {
    // Extract date
    // Example: "Datum: 15.01.2024" or "Date: 2024-01-15"
    const match = text.match(/(?:Datum|Date):\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    if (!match) return null;
    
    const [day, month, year] = match[1].split('.');
    return new Date(`${year}-${month}-${day}`);
  }

  private extractSenderName(text: string): string | undefined {
    // Extract sender name if available
    const match = text.match(/(?:Od|From):\s*([^\n]+)/i);
    return match ? match[1].trim() : undefined;
  }
}
```

### Step 2: Register Parser

Edit `backend/src/services/bankParsers/index.ts`:

```typescript
import { AirBankParser } from './airbank';
import { YourBankParser } from './yourbank';  // Add import
import { BankParser, EmailData, ParsedPayment } from './types';

// Register all parsers
const parsers: BankParser[] = [
  new AirBankParser(),
  new YourBankParser(),  // Add your parser
];

export function parseBankEmail(email: EmailData): ParsedPayment | null {
  // Find parser that can handle this email
  const parser = parsers.find(p => p.canParse(email));
  
  if (!parser) {
    console.log('No parser found for email from:', email.from);
    return null;
  }

  console.log(`Using ${parser.bankName} parser`);
  return parser.parse(email);
}

export { ParsedPayment, EmailData } from './types';
```

### Step 3: Write Tests

Create `backend/src/services/bankParsers/yourbank.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { YourBankParser } from './yourbank';

describe('YourBankParser', () => {
  const parser = new YourBankParser();

  describe('canParse', () => {
    it('should recognize YourBank emails', () => {
      const email = {
        from: 'noreply@yourbank.cz',
        subject: 'Příchozí platba',
        text: '',
        date: new Date(),
      };
      expect(parser.canParse(email)).toBe(true);
    });

    it('should reject non-YourBank emails', () => {
      const email = {
        from: 'other@example.com',
        subject: 'Test',
        text: '',
        date: new Date(),
      };
      expect(parser.canParse(email)).toBe(false);
    });
  });

  describe('parse', () => {
    it('should extract payment details', () => {
      const email = {
        from: 'noreply@yourbank.cz',
        subject: 'Příchozí platba',
        text: `
          Dobrý den,
          
          Na váš účet byla připsána platba:
          
          Částka: 10 000 Kč
          Variabilní symbol: 2024001
          Datum: 15.01.2024
          Od: Jan Novák
        `,
        date: new Date(),
      };

      const payment = parser.parse(email);
      
      expect(payment).not.toBeNull();
      expect(payment?.amount).toBe(10000);
      expect(payment?.currency).toBe('CZK');
      expect(payment?.variableSymbol).toBe('2024001');
      expect(payment?.senderName).toBe('Jan Novák');
    });

    it('should return null for invalid emails', () => {
      const email = {
        from: 'noreply@yourbank.cz',
        subject: 'Different notification',
        text: 'No payment information',
        date: new Date(),
      };

      const payment = parser.parse(email);
      expect(payment).toBeNull();
    });
  });
});
```

### Step 4: Run Tests

```bash
cd backend
pnpm test bankParsers/yourbank.test.ts
```

### Step 5: Test with Real Emails

1. Configure IMAP with your test email account
2. Send yourself a test notification email that matches your bank's format
3. Set bank email filter to your bank's sender address
4. Click "Check Emails" in the application
5. Verify payment is created and matched correctly

### Step 6: Update Documentation

1. Add your bank to this file's "Currently Supported Banks" section
2. Include notification email format details
3. Update configuration instructions

## Bank Parser Best Practices

### 1. Robust Parsing

- Use regular expressions carefully
- Handle multiple date/number formats
- Don't assume specific formatting
- Gracefully handle missing fields

### 2. Error Handling

```typescript
parse(email: EmailData): ParsedPayment | null {
  try {
    // ... parsing logic
    return payment;
  } catch (error) {
    console.error(`${this.bankName} parser error:`, error);
    return null;  // Don't throw, return null
  }
}
```

### 3. Logging

```typescript
console.log(`${this.bankName}: Parsing email from ${email.date}`);
console.log(`${this.bankName}: Extracted amount: ${amount}`);
```

### 4. Validation

```typescript
// Validate extracted data before returning
if (!amount || amount <= 0) {
  console.warn(`${this.bankName}: Invalid amount: ${amount}`);
  return null;
}

if (!date || date > new Date()) {
  console.warn(`${this.bankName}: Invalid date: ${date}`);
  return null;
}
```

### 5. Testing

- Test with multiple real email examples
- Test edge cases (missing fields, malformed data)
- Test with different locales/languages
- Test with various amount formats

## Common Patterns

### Amount Extraction

```typescript
// Czech format: "10 000 Kč" or "10 000,50 Kč"
private extractAmount(text: string): number | null {
  const patterns = [
    /(?:Částka|Amount):\s*([\d\s]+(?:,\d{2})?)\s*(?:Kč|CZK)/i,
    /([\d\s]+(?:,\d{2})?)\s*(?:Kč|CZK)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Remove spaces, replace comma with dot
      const amount = match[1].replace(/\s/g, '').replace(',', '.');
      const parsed = parseFloat(amount);
      if (!isNaN(parsed)) return parsed;
    }
  }
  
  return null;
}
```

### Variable Symbol Extraction

```typescript
private extractVariableSymbol(text: string): string | undefined {
  const patterns = [
    /VS:\s*(\d+)/i,
    /Variabilní\s+symbol:\s*(\d+)/i,
    /Variable\s+symbol:\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  return undefined;
}
```

### Date Extraction

```typescript
private extractDate(text: string): Date | null {
  // Try Czech format: dd.mm.yyyy
  let match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const [_, day, month, year] = match;
    return new Date(`${year}-${month}-${day}`);
  }

  // Try ISO format: yyyy-mm-dd
  match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(match[0]);
  }

  return null;
}
```

## Example: Full Parser Implementation

See `backend/src/services/bankParsers/airbank.ts` for a complete, working example.

## Debugging Tips

### Enable Verbose Logging

Add debug logs in your parser:

```typescript
parse(email: EmailData): ParsedPayment | null {
  console.log('=== YourBank Parser Debug ===');
  console.log('From:', email.from);
  console.log('Subject:', email.subject);
  console.log('Text length:', email.text.length);
  console.log('Text sample:', email.text.substring(0, 200));
  
  // ... rest of parsing
}
```

### View Raw Email Content

Temporarily log full email in `emailPoller.ts`:

```typescript
console.log('Raw email:', JSON.stringify(email, null, 2));
```

### Manual Testing

Create a test script `test-parser.ts`:

```typescript
import { YourBankParser } from './services/bankParsers/yourbank';

const testEmail = {
  from: 'noreply@yourbank.cz',
  subject: 'Payment notification',
  text: `Your actual email content here`,
  date: new Date(),
};

const parser = new YourBankParser();
console.log('Can parse:', parser.canParse(testEmail));

const result = parser.parse(testEmail);
console.log('Parse result:', result);
```

Run it:
```bash
npx tsx test-parser.ts
```

## Contributing Your Parser

If you've added support for a new bank:

1. **Test thoroughly** with multiple real emails
2. **Write comprehensive tests**
3. **Update documentation** (this file)
4. **Submit a pull request**:
   - Include parser implementation
   - Include tests
   - Include documentation updates
   - Include example email format (with sensitive data removed)

## Frequently Asked Questions

### Q: My bank sends HTML emails, not plain text. How do I parse them?

A: The `EmailData` interface includes an optional `html` field. You can parse HTML:

```typescript
parse(email: EmailData): ParsedPayment | null {
  const content = email.html || email.text;
  
  // For HTML, you might want to strip tags first
  const text = content.replace(/<[^>]*>/g, '');
  
  // ... continue parsing
}
```

### Q: What if my bank sends multiple payment notifications in one email?

A: Currently, parsers return a single `ParsedPayment`. For multiple payments, you'd need to:
1. Extend the interface to support `ParsedPayment[]`
2. Update the `parseBankEmail` function to handle arrays
3. Update the email poller to create multiple payment records

### Q: How do I handle different currencies?

A: Extract currency from the email and set it in the `ParsedPayment`:

```typescript
const currencyMatch = text.match(/(CZK|EUR|USD)/i);
const currency = currencyMatch ? currencyMatch[1].toUpperCase() : 'CZK';

return {
  amount,
  currency,
  // ...
};
```

### Q: What if the variable symbol is in a different field?

A: Banks might put the invoice number in different fields (constant symbol, specific symbol, or description). Extract all available fields:

```typescript
return {
  amount,
  currency: 'CZK',
  variableSymbol: this.extractVS(text),
  constantSymbol: this.extractCS(text),
  specificSymbol: this.extractSS(text),
  description: this.extractDescription(text),
  date,
};
```

The matching logic will try to match using any of these fields.

## Need Help?

- Review the Air Bank parser implementation as a reference
- Check the test files for examples
- Open an issue on GitHub with your bank's email format
- Community members may help add support for your bank
