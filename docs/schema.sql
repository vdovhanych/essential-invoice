CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  invoice_sequence_start INTEGER NOT NULL DEFAULT 1,
  invoice_sequence_padding INTEGER NOT NULL DEFAULT 4,
  secondary_email_mode VARCHAR(8) NOT NULL DEFAULT 'cc',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  company_name VARCHAR(255) NOT NULL,
  primary_email VARCHAR(255) NOT NULL,
  secondary_email VARCHAR(255),
  address VARCHAR(255),
  ico VARCHAR(32),
  dic VARCHAR(32),
  contact_person VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(32) NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  status VARCHAR(20) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_terms VARCHAR(255),
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  qr_payment_code VARCHAR(512),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_invoice_number_user ON invoices (user_id, invoice_number);

CREATE TABLE invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  total NUMERIC(12, 2) NOT NULL
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  invoice_id INTEGER REFERENCES invoices(id),
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  variable_symbol VARCHAR(32),
  sender VARCHAR(255),
  message VARCHAR(255),
  transaction_code VARCHAR(64),
  booked_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  primary_email VARCHAR(255) NOT NULL,
  secondary_email VARCHAR(255),
  primary_email_sent_at TIMESTAMPTZ,
  secondary_email_sent_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  payment_id INTEGER NOT NULL REFERENCES payments(id),
  reason VARCHAR(64) NOT NULL DEFAULT 'missing_variable_symbol',
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
