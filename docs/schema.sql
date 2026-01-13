CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE clients (
  id UUID PRIMARY KEY,
  company_name TEXT NOT NULL,
  primary_email TEXT NOT NULL,
  secondary_email TEXT,
  address TEXT,
  ico TEXT,
  dic TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id),
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  currency TEXT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_terms TEXT,
  subtotal_cents INTEGER NOT NULL,
  vat_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  qr_payment_code TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  vat_rate NUMERIC,
  line_total_cents INTEGER NOT NULL
);

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  variable_symbol TEXT,
  sender_name TEXT,
  message TEXT,
  transaction_code TEXT,
  booked_at DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE email_logs (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  primary_email_sent_at TIMESTAMP WITH TIME ZONE,
  secondary_email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
