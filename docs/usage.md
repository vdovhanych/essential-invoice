# Usage Guide

Comprehensive guide on how to use Essential Invoice.

## Getting Started

### First Time Setup

After deploying Essential Invoice:

1. **Register Your Account**
   - Navigate to the application URL
   - Click "Register" (Registrovat)
   - Enter your name, email, and password
   - Click "Create Account"

2. **Complete Onboarding**
   - After registration, you'll be guided through a 2-step onboarding process
   - **Step 1 - Company Details:**
     - Company name (required)
     - IČO - Czech company ID (required)
     - Address (required)
     - VAT payer status (checkbox)
     - DIČ - VAT ID (required if VAT payer)
     - Paušální daň settings (optional)
   - **Step 2 - Bank & Logo:**
     - Bank account number (required)
     - Bank code (required)
     - Upload company logo (optional)

3. **Configure Email Settings** (optional but recommended)
   - Go to Settings (Nastavení)
   - Configure SMTP for sending invoices
   - Configure IMAP for receiving payment notifications
   - See [Configuration Guide](configuration.md) for details

## Managing Clients

### Adding a New Client

1. Navigate to **Clients (Klienti)** page
2. Click **"New Client" (Nový klient)** button
3. Two options:
   - **Option A - Use ARES (for Czech companies):**
     - Enter IČO (Czech company ID)
     - Click "Load from ARES" (Načíst z ARES)
     - System auto-fills company name, address, and DIČ
   - **Option B - Manual entry:**
     - Company name (required)
     - Email (required)
     - Address
     - IČO
     - DIČ
4. Click **"Save"** (Uložit)

### Viewing Client Details

1. Go to **Clients** page
2. Click on a client's name
3. View:
   - Contact information
   - List of all invoices for this client
   - Total invoiced amount
   - Outstanding balance

### Editing a Client

1. Go to client detail page
2. Click **"Edit"** (Upravit)
3. Update information
4. Click **"Save"**

### Deleting a Client

1. Go to client detail page
2. Click **"Delete"** (Smazat)
3. Confirm deletion

**Note**: You cannot delete a client that has associated invoices.

## Creating and Managing Invoices

### Creating a New Invoice

1. Navigate to **Invoices (Faktury)** page
2. Click **"New Invoice" (Nová faktura)** button
3. Fill in details:
   - **Client**: Select from dropdown (auto-fills client details)
   - **Issue Date** (Datum vystavení): Invoice creation date
   - **Due Date** (Datum splatnosti): Payment deadline
   - **Currency**: CZK or EUR
   - **VAT Rate** (Sazba DPH): 0%, 12%, or 21%
4. Add line items:
   - Description (Popis)
   - Quantity (Množství)
   - Unit (Jednotka): e.g., "hours", "pcs", "days"
   - Unit Price (Jednotková cena)
5. Click **"Create Invoice"** (Vytvořit fakturu)

**Invoice Number**: Auto-generated based on year (e.g., 2024001, 2024002)

**VAT Note**: 
- If VAT rate is 0%, the VAT line will not appear on the PDF
- If you're not a VAT payer, "Neplátce DPH" appears instead of DIČ

### Invoice Statuses

- **Draft** (Koncept): Invoice created but not sent
- **Sent** (Odesláno): Invoice sent to client via email
- **Paid** (Zaplaceno): Payment received and matched
- **Cancelled** (Stornováno): Invoice cancelled

### Editing an Invoice

1. Open invoice detail page
2. Click **"Edit"** (Upravit)
3. Modify details
4. Click **"Save"**

**Note**: Only draft invoices can be fully edited. Sent invoices have limited editing capabilities.

### Sending an Invoice

1. Open invoice detail page
2. Click **"Send"** (Odeslat) button
3. Choose whether to send to secondary email (if client has one)
4. Invoice is sent as PDF attachment via SMTP
5. Status changes to "Sent"

**Requirements**:
- SMTP must be configured in Settings
- Client must have an email address

### Downloading Invoice PDF

1. Open invoice detail page
2. Click **"Download PDF"** button
3. PDF includes:
   - Your company details
   - Client details
   - Invoice items
   - QR payment code (SPAYD format)
   - Bank account details

### Marking Invoice as Paid

**Option 1 - Automatic (via IMAP):**
- Configure IMAP in Settings
- System automatically checks for bank notifications
- Matches payments by variable symbol (invoice number)
- Invoice automatically marked as paid

**Option 2 - Manual:**
1. Open invoice detail page
2. Click **"Mark as Paid"** (Označit jako zaplaceno)
3. Confirm action
4. Status changes to "Paid"

### Cancelling an Invoice

1. Open invoice detail page
2. Click **"Cancel"** (Stornovat)
3. Confirm cancellation
4. Status changes to "Cancelled"

### Deleting an Invoice

1. Open invoice detail page
2. Click **"Delete"** (Smazat)
3. Confirm deletion

**Note**: Only draft invoices can be deleted. Sent/paid invoices should be cancelled instead.

## Managing Expenses

### Adding a New Expense

1. Navigate to **Expenses (Výdaje)** page
2. Click **"New Expense"** (Nový výdaj) button
3. Fill in details:
   - Description (Popis)
   - Amount (Částka)
   - Expense Date (Datum výdaje)
   - Category (Kategorie)
   - Attach receipt/invoice (optional)
4. Click **"Create Expense"** (Vytvořit výdaj)

**Expense Number**: Auto-generated (e.g., E2024001, E2024002)

### Viewing Expenses

1. Go to **Expenses** page
2. View list of all expenses
3. Filter by:
   - Status (draft, paid, cancelled)
   - Date range

### Expense Details

1. Click on an expense
2. View:
   - Full description
   - Amount and date
   - Attached file (if any)
   - Status

### Downloading Attached Files

1. Open expense detail page
2. If a file is attached, click **"Download File"** button
3. File opens/downloads (PDF, image, etc.)

### Marking Expense as Paid

1. Open expense detail page
2. Click **"Mark as Paid"**
3. Status changes to "Paid"

### Editing/Deleting Expenses

Similar to invoices - only draft expenses can be fully edited or deleted.

## Payment Management

### Viewing Payments

1. Navigate to **Payments (Platby)** page
2. View:
   - All received payments
   - Matched vs. unmatched payments
   - Payment details (amount, variable symbol, date)

### Automatic Payment Matching

**Setup:**
1. Configure IMAP in Settings
2. Set bank email filter (e.g., `noreply@airbank.cz`)

**How it works:**
- System checks email every 5 minutes (configurable)
- Parses bank notification emails
- Extracts payment details (amount, variable symbol, date)
- Automatically matches to invoices by variable symbol
- Marks invoice as paid

**Supported Banks:**
- Air Bank (more banks can be added)

### Manual Payment Matching

For unmatched payments:

1. Go to **Payments** page
2. Find unmatched payment
3. Click **"Match"** (Spárovat)
4. System suggests potential invoice matches
5. Select correct invoice
6. Click **"Confirm"**

### AI-Powered Payment Matching

If Perplexity API is configured:

1. System uses AI to suggest best matches
2. Considers:
   - Amount similarity
   - Variable symbol
   - Date proximity
   - Client information
3. Provides confidence level (high/medium/low)

### Unmatching a Payment

1. Go to payment detail page
2. Click **"Unmatch"** (Zrušit párování)
3. Invoice returns to "Sent" status
4. Payment returns to unmatched

### Deleting a Payment

1. Only unmatched payments can be deleted
2. Go to payment detail page
3. Click **"Delete"**
4. Confirm deletion

### Manually Check for New Payments

1. Go to **Payments** page
2. Click **"Check Emails"** button
3. System immediately checks IMAP for new notifications

## Dashboard

The dashboard provides an overview of your business:

### Key Metrics

- **Total Revenue**: Sum of all paid invoices
- **Outstanding Amount**: Sum of unpaid invoices
- **Paid Invoices Count**: Number of paid invoices
- **Unpaid Invoices Count**: Number of unpaid invoices

### Paušální Daň Progress

If enabled:
- Shows current invoiced amount vs. limit
- Progress bar with percentage
- Warning when approaching limit

### Recent Activity

- Recent invoices
- Recent payments
- Quick access to details

## Profile Management

### Updating Your Profile

1. Go to **Profile (Profil)** page
2. Update:
   - Company information (name, IČO, address)
   - VAT payer status
   - DIČ (if VAT payer)
   - Bank account details
   - Paušální daň settings
   - Company logo

### VAT Payer Status

**Important**: This affects how invoices are displayed:

- **VAT Payer (checked)**:
  - DIČ shown on invoices
  - VAT rates applied normally
  
- **Not VAT Payer (unchecked)**:
  - "Neplátce DPH" shown instead of DIČ
  - When VAT rate is 0%, no VAT line on invoice

### Paušální Daň Settings

1. Enable/disable paušální daň
2. Select tier (1, 2, or 3)
3. Set income limit
4. Dashboard tracks progress

### Uploading Logo

1. Click **"Upload Logo"** (Nahrát logo)
2. Select image file (PNG, JPG)
3. Max size: 2MB
4. Recommended: 200x200 pixels
5. Logo appears on invoices

### Changing Password

1. Go to **Settings (Nastavení)**
2. Find "Change Password" section
3. Enter current password
4. Enter new password
5. Confirm new password
6. Click **"Change Password"**

## Email Configuration

See [Configuration Guide](configuration.md#smtp-configuration) for detailed SMTP/IMAP setup instructions.

### Testing Email Configuration

**Test SMTP:**
1. Go to Settings > Email (SMTP)
2. Fill in SMTP details
3. Click **"Test"** button
4. System sends a test email
5. Success message confirms working setup

**Test IMAP:**
1. Go to Settings > Email (IMAP)
2. Fill in IMAP details
3. Click **"Test"** button
4. System connects to email server
5. Success message confirms working setup

## AI Assistant

If Perplexity API key is configured:

### Using the Tax Advisor

1. Click on AI assistant icon (usually bottom-right)
2. Ask questions in Czech or English:
   - "Mohu si odečíst home office?"
   - "How to handle VAT returns?"
   - "What are the paušální daň requirements?"
3. Get context-aware answers based on:
   - Your VAT payer status
   - Paušální daň settings
   - Czech tax laws

### AI Features

- **Payment Matching**: Intelligent payment-to-invoice matching
- **Invoice Categorization**: Automatic expense categorization
- **Financial Insights**: Business performance analysis
- **Tax Advice**: Czech-specific tax and accounting guidance

## Tips and Best Practices

### Invoice Management

1. **Always set realistic due dates**: Typical is 14-30 days
2. **Send invoices promptly**: Don't wait to send after work completion
3. **Follow up on overdue invoices**: Check dashboard regularly
4. **Use consistent item descriptions**: Makes tracking easier

### Payment Tracking

1. **Configure IMAP early**: Automates payment matching
2. **Use variable symbols**: Clients should use invoice number as VS
3. **Check payments regularly**: Review unmatched payments weekly

### Expense Tracking

1. **Attach receipts**: Always upload receipt/invoice files
2. **Categorize properly**: Helps with tax preparation
3. **Track immediately**: Don't wait until tax season

### Data Management

1. **Regular backups**: See [Backup Guide](backup.md)
2. **Keep client info updated**: Verify contact details regularly
3. **Review dashboard weekly**: Stay on top of finances

### Security

1. **Use strong password**: Mix of letters, numbers, symbols
2. **Don't share credentials**: Each user should have own account
3. **Enable HTTPS**: Use reverse proxy in production
4. **Log out on shared computers**: Always log out when done
