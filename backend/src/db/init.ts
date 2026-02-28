import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'essential_invoice',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create tables if they don't exist
    await client.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        company_name VARCHAR(255),
        company_ico VARCHAR(20),
        company_dic VARCHAR(20),
        company_address TEXT,
        bank_account VARCHAR(50),
        bank_code VARCHAR(10),
        logo_data TEXT,
        logo_mime_type VARCHAR(50),
        vat_payer BOOLEAN DEFAULT false,
        onboarding_completed BOOLEAN DEFAULT false,
        pausalni_dan_enabled BOOLEAN DEFAULT false,
        pausalni_dan_tier INTEGER DEFAULT 1,
        pausalni_dan_limit INTEGER DEFAULT 1000000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Clients table
      CREATE TABLE IF NOT EXISTS clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_name VARCHAR(255) NOT NULL,
        primary_email VARCHAR(255) NOT NULL,
        secondary_email VARCHAR(255),
        address TEXT,
        ico VARCHAR(20),
        dic VARCHAR(20),
        contact_person VARCHAR(255),
        contact_phone VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Invoices table
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
        recurring_invoice_id UUID,
        invoice_number VARCHAR(50) NOT NULL,
        variable_symbol VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
        currency VARCHAR(3) DEFAULT 'CZK' CHECK (currency IN ('CZK', 'EUR')),
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        delivery_date DATE,
        subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
        vat_rate DECIMAL(5, 2) DEFAULT 21,
        vat_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        total DECIMAL(12, 2) NOT NULL DEFAULT 0,
        notes TEXT,
        payment_method VARCHAR(50) DEFAULT 'bank_transfer',
        qr_payment_data TEXT,
        sent_at TIMESTAMP,
        paid_at TIMESTAMP,
        primary_email_sent_at TIMESTAMP,
        secondary_email_sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT invoices_user_invoice_number_key UNIQUE (user_id, invoice_number)
      );

      -- Invoice items table
      CREATE TABLE IF NOT EXISTS invoice_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
        unit VARCHAR(20) DEFAULT 'ks',
        unit_price DECIMAL(12, 2) NOT NULL,
        total DECIMAL(12, 2) NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Payments table (from bank notifications)
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
        amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'CZK',
        variable_symbol VARCHAR(20),
        sender_name VARCHAR(255),
        sender_account VARCHAR(50),
        message TEXT,
        transaction_code VARCHAR(50),
        transaction_date DATE,
        bank_type VARCHAR(20) DEFAULT 'airbank',
        raw_email TEXT,
        matched_at TIMESTAMP,
        match_method VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Email logs table
      CREATE TABLE IF NOT EXISTS email_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
        email_type VARCHAR(20) NOT NULL CHECK (email_type IN ('invoice_sent', 'bank_notification', 'welcome', 'password_reset')),
        recipient_email VARCHAR(255),
        subject VARCHAR(500),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
        error_message TEXT,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Settings table (for SMTP/IMAP config per user)
      CREATE TABLE IF NOT EXISTS settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        smtp_host VARCHAR(255),
        smtp_port INTEGER DEFAULT 587,
        smtp_user VARCHAR(255),
        smtp_password TEXT,
        smtp_secure BOOLEAN DEFAULT true,
        smtp_from_email VARCHAR(255),
        smtp_from_name VARCHAR(255),
        imap_host VARCHAR(255),
        imap_port INTEGER DEFAULT 993,
        imap_user VARCHAR(255),
        imap_password TEXT,
        imap_tls BOOLEAN DEFAULT true,
        bank_notification_email VARCHAR(255),
        email_polling_interval INTEGER DEFAULT 300,
        invoice_number_prefix VARCHAR(20) DEFAULT '',
        invoice_number_format VARCHAR(50) DEFAULT 'YYYYMM##',
        default_vat_rate DECIMAL(5, 2) DEFAULT 21,
        default_payment_terms INTEGER DEFAULT 14,
        email_template TEXT,
        calculator_enabled BOOLEAN DEFAULT false,
        ai_enabled BOOLEAN DEFAULT true,
        perplexity_api_key TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Password reset tokens table
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Expenses table (received invoices / náklady)
      CREATE TABLE IF NOT EXISTS expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
        expense_number VARCHAR(50) NOT NULL,
        supplier_invoice_number VARCHAR(100),
        status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
        currency VARCHAR(3) DEFAULT 'CZK' CHECK (currency IN ('CZK', 'EUR')),
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        delivery_date DATE,
        amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        vat_rate DECIMAL(5, 2) DEFAULT 21,
        vat_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        total DECIMAL(12, 2) NOT NULL DEFAULT 0,
        description TEXT,
        notes TEXT,
        file_data TEXT,
        file_name VARCHAR(255),
        file_mime_type VARCHAR(100),
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT expenses_user_expense_number_key UNIQUE (user_id, expense_number)
      );

      -- Recurring invoices table
      CREATE TABLE IF NOT EXISTS recurring_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
        currency VARCHAR(3) DEFAULT 'CZK' CHECK (currency IN ('CZK', 'EUR')),
        vat_rate DECIMAL(5, 2) DEFAULT 21,
        notes TEXT,
        day_of_month INTEGER NOT NULL DEFAULT 1 CHECK (day_of_month >= 1 AND day_of_month <= 28),
        start_date DATE NOT NULL,
        end_date DATE,
        next_generation_date DATE NOT NULL,
        payment_terms INTEGER DEFAULT 14,
        auto_send BOOLEAN DEFAULT false,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Recurring invoice items table
      CREATE TABLE IF NOT EXISTS recurring_invoice_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recurring_invoice_id UUID NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
        unit VARCHAR(20) DEFAULT 'ks',
        unit_price DECIMAL(12, 2) NOT NULL,
        sort_order INTEGER DEFAULT 0
      );

      -- Add FK for recurring_invoice_id (can't be in CREATE TABLE due to table ordering)
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'invoices_recurring_invoice_id_fkey'
        ) THEN
          ALTER TABLE invoices ADD CONSTRAINT invoices_recurring_invoice_id_fkey
            FOREIGN KEY (recurring_invoice_id) REFERENCES recurring_invoices(id) ON DELETE SET NULL;
        END IF;
      END $$;

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoices_variable_symbol ON invoices(variable_symbol);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
      CREATE INDEX IF NOT EXISTS idx_payments_variable_symbol ON payments(variable_symbol);
      CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_email_logs_invoice_id ON email_logs(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_client_id ON expenses(client_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
      CREATE INDEX IF NOT EXISTS idx_recurring_invoices_user_id ON recurring_invoices(user_id);
      CREATE INDEX IF NOT EXISTS idx_recurring_invoices_next_date ON recurring_invoices(next_generation_date);
      CREATE INDEX IF NOT EXISTS idx_recurring_invoice_items_recurring_id ON recurring_invoice_items(recurring_invoice_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_recurring_invoice_id ON invoices(recurring_invoice_id);
    `);

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}
