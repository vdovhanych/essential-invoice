import bcrypt from 'bcryptjs';
import { query, pool } from './init';

const TEST_EMAIL = 'test@test.com';
const TEST_PASSWORD = 'password123';

async function seed() {
  const email = process.argv[2] || TEST_EMAIL;
  const password = process.argv[3] || TEST_PASSWORD;

  console.log(`Seeding data for user: ${email}`);

  // Check if user already exists
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    console.error(`User ${email} already exists. Delete them first with: bun run delete-user ${email}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const userResult = await query(
    `INSERT INTO users (email, password_hash, name, company_name, company_ico, company_dic, company_address, bank_account, bank_code, vat_payer, onboarding_completed, pausalni_dan_enabled, pausalni_dan_tier, pausalni_dan_limit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id`,
    [
      email,
      passwordHash,
      'Jan Novák',
      'Jan Novák - Webový vývoj',
      '12345678',
      'CZ1234567890',
      'Karlova 15\n110 00 Praha 1',
      'CZ6508000000192000145399',
      '0800',
      false,
      true,   // onboarding completed
      true,   // pausalni dan enabled
      1,      // tier
      1000000 // limit
    ]
  );
  const userId = userResult.rows[0].id;
  console.log(`  Created user: ${userId}`);

  // Create settings
  await query(
    `INSERT INTO settings (user_id, invoice_number_prefix, invoice_number_format, default_vat_rate, default_payment_terms, calculator_enabled)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, 'FV', 'YYYYMM##', 0, 14, true]
  );
  console.log('  Created settings');

  // Create clients
  const clients = [
    {
      companyName: 'Acme s.r.o.',
      primaryEmail: 'fakturace@acme.cz',
      secondaryEmail: 'jan@acme.cz',
      address: 'Vinohradská 42\n120 00 Praha 2',
      ico: '27082440',
      dic: 'CZ27082440',
      contactPerson: 'Petr Svoboda',
      contactPhone: '+420 602 123 456',
      notes: 'Hlavní klient, pravidelná spolupráce',
    },
    {
      companyName: 'TechStart s.r.o.',
      primaryEmail: 'info@techstart.cz',
      secondaryEmail: null,
      address: 'Brněnská 78\n602 00 Brno',
      ico: '04512398',
      dic: 'CZ04512398',
      contactPerson: 'Marie Dvořáková',
      contactPhone: '+420 773 456 789',
      notes: null,
    },
    {
      companyName: 'DataFlow a.s.',
      primaryEmail: 'billing@dataflow.cz',
      secondaryEmail: 'cto@dataflow.cz',
      address: 'Plzeňská 200\n150 00 Praha 5',
      ico: '63080401',
      dic: 'CZ63080401',
      contactPerson: 'Tomáš Černý',
      contactPhone: '+420 608 789 012',
      notes: 'Platí vždy včas',
    },
    {
      companyName: 'GreenSoft s.r.o.',
      primaryEmail: 'office@greensoft.cz',
      secondaryEmail: null,
      address: 'Masarykova 5\n301 00 Plzeň',
      ico: '28196150',
      dic: null,
      contactPerson: 'Eva Nová',
      contactPhone: '+420 724 321 654',
      notes: 'Nový klient od ledna 2026',
    },
  ];

  const clientIds: string[] = [];
  for (const c of clients) {
    const result = await query(
      `INSERT INTO clients (user_id, company_name, primary_email, secondary_email, address, ico, dic, contact_person, contact_phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [userId, c.companyName, c.primaryEmail, c.secondaryEmail, c.address, c.ico, c.dic, c.contactPerson, c.contactPhone, c.notes]
    );
    clientIds.push(result.rows[0].id);
  }
  console.log(`  Created ${clients.length} clients`);

  // Create invoices with items — spread across Jul 2025 - Feb 2026 for dashboard graph
  const invoices = [
    // Jul 2025
    {
      clientIdx: 0,
      number: 'FV202507001',
      vs: '202507001',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-07-01',
      dueDate: '2025-07-15',
      deliveryDate: '2025-07-01',
      vatRate: 0,
      paidAt: '2025-07-12',
      notes: null,
      items: [
        { description: 'Vývoj webové aplikace - červenec 2025', quantity: 35, unit: 'hod', unitPrice: 1400 },
      ],
    },
    // Aug 2025
    {
      clientIdx: 0,
      number: 'FV202508001',
      vs: '202508001',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-08-01',
      dueDate: '2025-08-15',
      deliveryDate: '2025-08-01',
      vatRate: 0,
      paidAt: '2025-08-14',
      notes: null,
      items: [
        { description: 'Vývoj webové aplikace - srpen 2025', quantity: 40, unit: 'hod', unitPrice: 1400 },
        { description: 'Konzultace architektury', quantity: 4, unit: 'hod', unitPrice: 1800 },
      ],
    },
    {
      clientIdx: 2,
      number: 'FV202508002',
      vs: '202508002',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-08-10',
      dueDate: '2025-08-24',
      deliveryDate: '2025-08-10',
      vatRate: 0,
      paidAt: '2025-08-22',
      notes: null,
      items: [
        { description: 'Správa serverů - srpen', quantity: 1, unit: 'měs', unitPrice: 12000 },
      ],
    },
    // Sep 2025
    {
      clientIdx: 0,
      number: 'FV202509001',
      vs: '202509001',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-09-01',
      dueDate: '2025-09-15',
      deliveryDate: '2025-09-01',
      vatRate: 0,
      paidAt: '2025-09-13',
      notes: null,
      items: [
        { description: 'Vývoj webové aplikace - září 2025', quantity: 45, unit: 'hod', unitPrice: 1400 },
      ],
    },
    {
      clientIdx: 1,
      number: 'FV202509002',
      vs: '202509002',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-09-10',
      dueDate: '2025-09-24',
      deliveryDate: '2025-09-10',
      vatRate: 0,
      paidAt: '2025-09-22',
      notes: 'Jednorázový projekt',
      items: [
        { description: 'Redesign landing page', quantity: 1, unit: 'ks', unitPrice: 25000 },
        { description: 'Responzivní úpravy', quantity: 8, unit: 'hod', unitPrice: 1500 },
      ],
    },
    // Oct 2025
    {
      clientIdx: 0,
      number: 'FV202510001',
      vs: '202510001',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-10-01',
      dueDate: '2025-10-15',
      deliveryDate: '2025-10-01',
      vatRate: 0,
      paidAt: '2025-10-14',
      notes: null,
      items: [
        { description: 'Vývoj webové aplikace - říjen 2025', quantity: 50, unit: 'hod', unitPrice: 1500 },
      ],
    },
    {
      clientIdx: 2,
      number: 'FV202510002',
      vs: '202510002',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-10-05',
      dueDate: '2025-10-19',
      deliveryDate: '2025-10-05',
      vatRate: 0,
      paidAt: '2025-10-18',
      notes: null,
      items: [
        { description: 'Správa serverů - říjen', quantity: 1, unit: 'měs', unitPrice: 15000 },
        { description: 'Migrace databáze na nový server', quantity: 8, unit: 'hod', unitPrice: 2000 },
      ],
    },
    // Nov 2025
    {
      clientIdx: 0,
      number: 'FV202511001',
      vs: '202511001',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-11-01',
      dueDate: '2025-11-15',
      deliveryDate: '2025-11-01',
      vatRate: 0,
      paidAt: '2025-11-13',
      notes: null,
      items: [
        { description: 'Vývoj webové aplikace - listopad 2025', quantity: 42, unit: 'hod', unitPrice: 1500 },
        { description: 'Code review a konzultace', quantity: 6, unit: 'hod', unitPrice: 1800 },
      ],
    },
    {
      clientIdx: 1,
      number: 'FV202511002',
      vs: '202511002',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-11-15',
      dueDate: '2025-11-29',
      deliveryDate: '2025-11-15',
      vatRate: 0,
      paidAt: '2025-11-27',
      notes: null,
      items: [
        { description: 'Implementace platební brány', quantity: 30, unit: 'hod', unitPrice: 1600 },
      ],
    },
    // Dec 2025
    {
      clientIdx: 0,
      number: 'FV202512001',
      vs: '202512001',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-12-01',
      dueDate: '2025-12-15',
      deliveryDate: '2025-12-01',
      vatRate: 0,
      paidAt: '2025-12-12',
      notes: null,
      items: [
        { description: 'Vývoj webové aplikace - prosinec 2025', quantity: 30, unit: 'hod', unitPrice: 1500 },
      ],
    },
    {
      clientIdx: 2,
      number: 'FV202512002',
      vs: '202512002',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-12-10',
      dueDate: '2025-12-24',
      deliveryDate: '2025-12-10',
      vatRate: 0,
      paidAt: '2025-12-20',
      notes: null,
      items: [
        { description: 'Správa serverů - prosinec', quantity: 1, unit: 'měs', unitPrice: 15000 },
      ],
    },
    // Jan 2026
    {
      clientIdx: 0,
      number: 'FV202601001',
      vs: '202601001',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2026-01-05',
      dueDate: '2026-01-19',
      deliveryDate: '2026-01-05',
      vatRate: 0,
      paidAt: '2026-01-15',
      notes: null,
      items: [
        { description: 'Vývoj webové aplikace - leden 2026', quantity: 40, unit: 'hod', unitPrice: 1500 },
        { description: 'Code review a konzultace', quantity: 5, unit: 'hod', unitPrice: 1800 },
      ],
    },
    {
      clientIdx: 1,
      number: 'FV202601002',
      vs: '202601002',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2026-01-10',
      dueDate: '2026-01-24',
      deliveryDate: '2026-01-10',
      vatRate: 0,
      paidAt: '2026-01-22',
      notes: null,
      items: [
        { description: 'Vývoj e-shopu - sprint 1', quantity: 35, unit: 'hod', unitPrice: 1600 },
      ],
    },
    {
      clientIdx: 2,
      number: 'FV202601003',
      vs: '202601003',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2026-01-15',
      dueDate: '2026-01-29',
      deliveryDate: '2026-01-15',
      vatRate: 0,
      paidAt: '2026-01-28',
      notes: null,
      items: [
        { description: 'Správa serverů - leden', quantity: 1, unit: 'měs', unitPrice: 15000 },
        { description: 'Migrace databáze', quantity: 12, unit: 'hod', unitPrice: 2000 },
      ],
    },
    // Feb 2026 — sent, draft, overdue, EUR
    {
      clientIdx: 0,
      number: 'FV202602001',
      vs: '202602001',
      status: 'sent',
      currency: 'CZK',
      issueDate: '2026-02-01',
      dueDate: '2026-02-15',
      deliveryDate: '2026-02-01',
      vatRate: 0,
      paidAt: null,
      notes: null,
      items: [
        { description: 'Vývoj webové aplikace - únor 2026', quantity: 45, unit: 'hod', unitPrice: 1500 },
        { description: 'Nasazení do produkce', quantity: 4, unit: 'hod', unitPrice: 1800 },
      ],
    },
    {
      clientIdx: 2,
      number: 'FV202602002',
      vs: '202602002',
      status: 'sent',
      currency: 'CZK',
      issueDate: '2026-02-05',
      dueDate: '2026-02-19',
      deliveryDate: '2026-02-05',
      vatRate: 0,
      paidAt: null,
      notes: null,
      items: [
        { description: 'Správa serverů - únor', quantity: 1, unit: 'měs', unitPrice: 15000 },
      ],
    },
    {
      clientIdx: 3,
      number: 'FV202601004',
      vs: '202601004',
      status: 'overdue',
      currency: 'CZK',
      issueDate: '2026-01-20',
      dueDate: '2026-02-03',
      deliveryDate: '2026-01-20',
      vatRate: 0,
      paidAt: null,
      notes: 'Upomínka odeslána 2026-02-10',
      items: [
        { description: 'Počáteční analýza a návrh', quantity: 16, unit: 'hod', unitPrice: 1500 },
      ],
    },
    {
      clientIdx: 1,
      number: 'FV202602003',
      vs: '202602003',
      status: 'draft',
      currency: 'CZK',
      issueDate: '2026-02-15',
      dueDate: '2026-03-01',
      deliveryDate: '2026-02-15',
      vatRate: 0,
      paidAt: null,
      notes: null,
      items: [
        { description: 'Vývoj mobilní aplikace - sprint 1', quantity: 60, unit: 'hod', unitPrice: 1600 },
        { description: 'UX konzultace', quantity: 8, unit: 'hod', unitPrice: 2000 },
      ],
    },
    {
      clientIdx: 2,
      number: 'FV202602004',
      vs: '202602004',
      status: 'sent',
      currency: 'EUR',
      issueDate: '2026-02-10',
      dueDate: '2026-02-24',
      deliveryDate: '2026-02-10',
      vatRate: 0,
      paidAt: null,
      notes: 'Fakturace v EUR dle smlouvy',
      exchangeRate: 25.125,
      items: [
        { description: 'API integration consulting', quantity: 20, unit: 'hod', unitPrice: 65 },
      ],
    },
  ];

  const invoiceIds: string[] = [];
  for (const inv of invoices) {
    const subtotal = inv.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const vatAmount = inv.vatRate > 0 ? Math.round(subtotal * (inv.vatRate / 100) * 100) / 100 : 0;
    const total = subtotal + vatAmount;

    // Calculate exchange rate fields for EUR invoices
    const exchangeRate = ('exchangeRate' in inv && inv.exchangeRate) ? inv.exchangeRate : null;
    const totalCzk = exchangeRate ? Math.round(total * exchangeRate * 100) / 100 : null;

    const result = await query(
      `INSERT INTO invoices (user_id, client_id, invoice_number, variable_symbol, status, currency, issue_date, due_date, delivery_date, subtotal, vat_rate, vat_amount, total, notes, paid_at, exchange_rate, total_czk)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING id`,
      [
        userId, clientIds[inv.clientIdx], inv.number, inv.vs, inv.status, inv.currency,
        inv.issueDate, inv.dueDate, inv.deliveryDate, subtotal, inv.vatRate, vatAmount, total,
        inv.notes, inv.paidAt, exchangeRate, totalCzk,
      ]
    );
    const invoiceId = result.rows[0].id;
    invoiceIds.push(invoiceId);

    for (let i = 0; i < inv.items.length; i++) {
      const item = inv.items[i];
      const itemTotal = item.quantity * item.unitPrice;
      await query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [invoiceId, item.description, item.quantity, item.unit, item.unitPrice, itemTotal, i]
      );
    }
  }
  console.log(`  Created ${invoices.length} invoices with items`);

  // Create expenses — spread across multiple months
  const expenses = [
    {
      number: 'N202508001',
      supplierInvoiceNumber: 'DF-2025-0301',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-08-01',
      dueDate: '2025-08-15',
      deliveryDate: '2025-08-01',
      amount: 2200,
      vatRate: 0,
      vatAmount: 0,
      total: 2200,
      description: 'Hosting serverů - srpen 2025',
      notes: null,
      paidAt: '2025-08-08',
      clientIdx: null,
    },
    {
      number: 'N202509001',
      supplierInvoiceNumber: 'DF-2025-0402',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-09-01',
      dueDate: '2025-09-15',
      deliveryDate: '2025-09-01',
      amount: 2200,
      vatRate: 0,
      vatAmount: 0,
      total: 2200,
      description: 'Hosting serverů - září 2025',
      notes: null,
      paidAt: '2025-09-05',
      clientIdx: null,
    },
    {
      number: 'N202510001',
      supplierInvoiceNumber: 'DF-2025-0510',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-10-01',
      dueDate: '2025-10-15',
      deliveryDate: '2025-10-01',
      amount: 2500,
      vatRate: 0,
      vatAmount: 0,
      total: 2500,
      description: 'Hosting serverů - říjen 2025',
      notes: null,
      paidAt: '2025-10-06',
      clientIdx: null,
    },
    {
      number: 'N202510002',
      supplierInvoiceNumber: 'INV-780055',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-10-15',
      dueDate: '2025-10-29',
      deliveryDate: '2025-10-15',
      amount: 8900,
      vatRate: 0,
      vatAmount: 0,
      total: 8900,
      description: 'Licence na software a nástroje - Q4',
      notes: 'JetBrains, Figma, GitHub',
      paidAt: '2025-10-20',
      clientIdx: null,
    },
    {
      number: 'N202511001',
      supplierInvoiceNumber: 'DF-2025-0611',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-11-01',
      dueDate: '2025-11-15',
      deliveryDate: '2025-11-01',
      amount: 2500,
      vatRate: 0,
      vatAmount: 0,
      total: 2500,
      description: 'Hosting serverů - listopad 2025',
      notes: null,
      paidAt: '2025-11-07',
      clientIdx: null,
    },
    {
      number: 'N202512001',
      supplierInvoiceNumber: 'DF-2025-0720',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2025-12-01',
      dueDate: '2025-12-15',
      deliveryDate: '2025-12-01',
      amount: 2500,
      vatRate: 0,
      vatAmount: 0,
      total: 2500,
      description: 'Hosting serverů - prosinec 2025',
      notes: null,
      paidAt: '2025-12-05',
      clientIdx: null,
    },
    {
      number: 'N202601001',
      supplierInvoiceNumber: 'DF-2026-0042',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2026-01-05',
      dueDate: '2026-01-19',
      deliveryDate: '2026-01-05',
      amount: 2500,
      vatRate: 0,
      vatAmount: 0,
      total: 2500,
      description: 'Hosting serverů - leden 2026',
      notes: null,
      paidAt: '2026-01-10',
      clientIdx: null,
    },
    {
      number: 'N202601002',
      supplierInvoiceNumber: 'INV-890123',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2026-01-15',
      dueDate: '2026-01-29',
      deliveryDate: '2026-01-15',
      amount: 8900,
      vatRate: 0,
      vatAmount: 0,
      total: 8900,
      description: 'Licence na software a nástroje - Q1 2026',
      notes: 'JetBrains, Figma, GitHub',
      paidAt: '2026-01-20',
      clientIdx: null,
    },
    {
      number: 'N202602001',
      supplierInvoiceNumber: 'DF-2026-0098',
      status: 'paid',
      currency: 'CZK',
      issueDate: '2026-02-01',
      dueDate: '2026-02-15',
      deliveryDate: '2026-02-01',
      amount: 2500,
      vatRate: 0,
      vatAmount: 0,
      total: 2500,
      description: 'Hosting serverů - únor 2026',
      notes: null,
      paidAt: '2026-02-05',
      clientIdx: null,
    },
    {
      number: 'N202602002',
      supplierInvoiceNumber: null,
      status: 'unpaid',
      currency: 'CZK',
      issueDate: '2026-02-10',
      dueDate: '2026-02-24',
      deliveryDate: '2026-02-10',
      amount: 4500,
      vatRate: 0,
      vatAmount: 0,
      total: 4500,
      description: 'Doména a SSL certifikáty pro klienta',
      notes: 'Přefakturovat klientovi',
      paidAt: null,
      clientIdx: 0,
    },
  ];

  for (const exp of expenses) {
    await query(
      `INSERT INTO expenses (user_id, client_id, expense_number, supplier_invoice_number, status, currency, issue_date, due_date, delivery_date, amount, vat_rate, vat_amount, total, description, notes, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        userId, exp.clientIdx !== null ? clientIds[exp.clientIdx] : null,
        exp.number, exp.supplierInvoiceNumber, exp.status, exp.currency,
        exp.issueDate, exp.dueDate, exp.deliveryDate, exp.amount, exp.vatRate, exp.vatAmount, exp.total,
        exp.description, exp.notes, exp.paidAt,
      ]
    );
  }
  console.log(`  Created ${expenses.length} expenses`);

  // Create payments — matched to paid invoices (only recent ones + unmatched)
  const payments = [
    {
      invoiceIdx: 4, // FV202509002 - TechStart redesign
      amount: 37000,
      currency: 'CZK',
      vs: '202509002',
      senderName: 'TechStart s.r.o.',
      senderAccount: 'CZ3201000000195000233078',
      message: null,
      transactionCode: 'TX20250922001',
      transactionDate: '2025-09-22',
      matchMethod: 'variable_symbol',
    },
    {
      invoiceIdx: 5, // FV202510001 - Acme Oct
      amount: 75000,
      currency: 'CZK',
      vs: '202510001',
      senderName: 'Acme s.r.o.',
      senderAccount: 'CZ6508000000192000145399',
      message: 'Úhrada FV202510001',
      transactionCode: 'TX20251014001',
      transactionDate: '2025-10-14',
      matchMethod: 'variable_symbol',
    },
    {
      invoiceIdx: 6, // FV202510002 - DataFlow Oct
      amount: 31000,
      currency: 'CZK',
      vs: '202510002',
      senderName: 'DataFlow a.s.',
      senderAccount: 'CZ9503000000000217653109',
      message: 'Faktura 202510002',
      transactionCode: 'TX20251018001',
      transactionDate: '2025-10-18',
      matchMethod: 'variable_symbol',
    },
    {
      invoiceIdx: 11, // FV202601001 - Acme Jan
      amount: 69000,
      currency: 'CZK',
      vs: '202601001',
      senderName: 'Acme s.r.o.',
      senderAccount: 'CZ6508000000192000145399',
      message: 'Úhrada FV202601001',
      transactionCode: 'TX20260115001',
      transactionDate: '2026-01-15',
      matchMethod: 'variable_symbol',
    },
    {
      invoiceIdx: 12, // FV202601002 - TechStart Jan
      amount: 56000,
      currency: 'CZK',
      vs: '202601002',
      senderName: 'TechStart s.r.o.',
      senderAccount: 'CZ3201000000195000233078',
      message: null,
      transactionCode: 'TX20260122001',
      transactionDate: '2026-01-22',
      matchMethod: 'variable_symbol',
    },
    {
      invoiceIdx: 13, // FV202601003 - DataFlow Jan
      amount: 39000,
      currency: 'CZK',
      vs: '202601003',
      senderName: 'DataFlow a.s.',
      senderAccount: 'CZ9503000000000217653109',
      message: 'Faktura 202601003',
      transactionCode: 'TX20260128001',
      transactionDate: '2026-01-28',
      matchMethod: 'variable_symbol',
    },
    // Unmatched payment
    {
      invoiceIdx: null,
      amount: 12000,
      currency: 'CZK',
      vs: '999999',
      senderName: 'Neznámý s.r.o.',
      senderAccount: 'CZ1220100000002800176854',
      message: 'Platba za služby',
      transactionCode: 'TX20260210001',
      transactionDate: '2026-02-10',
      matchMethod: null,
    },
  ];

  for (const p of payments) {
    const matchedInvoiceId = p.invoiceIdx !== null ? invoiceIds[p.invoiceIdx] : null;
    await query(
      `INSERT INTO payments (user_id, invoice_id, amount, currency, variable_symbol, sender_name, sender_account, message, transaction_code, transaction_date, bank_type, matched_at, match_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        userId, matchedInvoiceId, p.amount, p.currency, p.vs, p.senderName, p.senderAccount,
        p.message, p.transactionCode, p.transactionDate, 'airbank',
        matchedInvoiceId ? p.transactionDate : null,
        p.matchMethod,
      ]
    );
  }
  console.log(`  Created ${payments.length} payments`);

  console.log('\nSeed complete!');
  console.log(`  Login: ${email} / ${password}`);

  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
