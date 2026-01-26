import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import { query } from '../db/init.js';

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  variableSymbol: string;
  status: string;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  deliveryDate: Date;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes: string;
  qrPaymentData: string;
  // Client info
  clientName: string;
  clientAddress: string;
  clientIco: string;
  clientDic: string;
  // User (supplier) info
  userName: string;
  userCompanyName: string;
  userAddress: string;
  userIco: string;
  userDic: string;
  userBankAccount: string;
  userBankCode: string;
  userLogoDataUrl: string | null;
  // Items
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }>;
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'CZK') {
    return `${amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč`;
  }
  return `${amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('cs-CZ');
}

async function generateQRCodeDataURL(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: 150,
      margin: 1,
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error('QR code generation error:', error);
    return '';
  }
}

function getLogoDataUrl(logoData: string | null, logoMimeType: string | null): string | null {
  if (!logoData || !logoMimeType) return null;
  return `data:${logoMimeType};base64,${logoData}`;
}

function generateInvoiceHTML(invoice: InvoiceData, qrCodeDataUrl: string): string {
  const itemsHtml = invoice.items.map(item => `
    <tr>
      <td>${item.description}</td>
      <td class="text-right">${item.quantity} ${item.unit}</td>
      <td class="text-right">${formatCurrency(item.unitPrice, invoice.currency)}</td>
      <td class="text-right">${formatCurrency(item.total, invoice.currency)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <title>Faktura ${invoice.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #333;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #2563eb;
    }
    .invoice-title {
      font-size: 28px;
      font-weight: bold;
      color: #2563eb;
    }
    .invoice-number {
      font-size: 14px;
      color: #666;
      margin-top: 5px;
    }
    .parties {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .party {
      width: 45%;
    }
    .party-title {
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 10px;
      font-weight: bold;
    }
    .party-name {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .party-details {
      color: #555;
    }
    .dates {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding: 15px;
      background: #f8fafc;
      border-radius: 8px;
    }
    .date-item {
      text-align: center;
    }
    .date-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #666;
    }
    .date-value {
      font-size: 14px;
      font-weight: bold;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th {
      background: #2563eb;
      color: white;
      padding: 12px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
    }
    th:last-child, td:last-child {
      text-align: right;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .text-right {
      text-align: right;
    }
    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    .totals-box {
      width: 300px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .totals-row.total {
      font-size: 18px;
      font-weight: bold;
      border-bottom: none;
      padding-top: 15px;
      color: #2563eb;
    }
    .payment-info {
      display: flex;
      justify-content: space-between;
      padding: 20px;
      background: #f0f9ff;
      border-radius: 8px;
      border: 1px solid #bae6fd;
    }
    .payment-details {
      flex: 1;
    }
    .payment-title {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 15px;
      color: #0369a1;
    }
    .payment-row {
      display: flex;
      margin-bottom: 8px;
    }
    .payment-label {
      width: 120px;
      color: #666;
    }
    .payment-value {
      font-weight: 500;
    }
    .qr-code {
      text-align: center;
    }
    .qr-code img {
      width: 120px;
      height: 120px;
    }
    .qr-code-label {
      font-size: 10px;
      color: #666;
      margin-top: 5px;
    }
    .notes {
      margin-top: 30px;
      padding: 15px;
      background: #fefce8;
      border-radius: 8px;
      border: 1px solid #fde047;
    }
    .notes-title {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #666;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="invoice-title">FAKTURA</div>
      <div class="invoice-number">č. ${invoice.invoiceNumber}</div>
    </div>
    ${invoice.userLogoDataUrl ? `
    <div style="text-align: right;">
      <img src="${invoice.userLogoDataUrl}" alt="Logo" style="max-width: 200px; max-height: 80px; object-fit: contain;">
    </div>
    ` : `
    <div style="text-align: right;">
      <div class="party-name">${invoice.userCompanyName || invoice.userName}</div>
      <div class="party-details">
        ${invoice.userAddress ? `${invoice.userAddress}<br>` : ''}
        ${invoice.userIco ? `IČO: ${invoice.userIco}<br>` : ''}
        ${invoice.userDic ? `DIČ: ${invoice.userDic}` : ''}
      </div>
    </div>
    `}
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-title">Dodavatel</div>
      <div class="party-name">${invoice.userCompanyName || invoice.userName}</div>
      <div class="party-details">
        ${invoice.userAddress ? `${invoice.userAddress}<br>` : ''}
        ${invoice.userIco ? `IČO: ${invoice.userIco}<br>` : ''}
        ${invoice.userDic ? `DIČ: ${invoice.userDic}` : ''}
      </div>
    </div>
    <div class="party">
      <div class="party-title">Odběratel</div>
      <div class="party-name">${invoice.clientName}</div>
      <div class="party-details">
        ${invoice.clientAddress ? `${invoice.clientAddress}<br>` : ''}
        ${invoice.clientIco ? `IČO: ${invoice.clientIco}<br>` : ''}
        ${invoice.clientDic ? `DIČ: ${invoice.clientDic}` : ''}
      </div>
    </div>
  </div>

  <div class="dates">
    <div class="date-item">
      <div class="date-label">Datum vystavení</div>
      <div class="date-value">${formatDate(invoice.issueDate)}</div>
    </div>
    <div class="date-item">
      <div class="date-label">Datum zdanitelného plnění</div>
      <div class="date-value">${formatDate(invoice.deliveryDate)}</div>
    </div>
    <div class="date-item">
      <div class="date-label">Datum splatnosti</div>
      <div class="date-value">${formatDate(invoice.dueDate)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Popis</th>
        <th style="text-align: right;">Množství</th>
        <th style="text-align: right;">Cena za jednotku</th>
        <th style="text-align: right;">Celkem</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row">
        <span>Základ daně:</span>
        <span>${formatCurrency(invoice.subtotal, invoice.currency)}</span>
      </div>
      <div class="totals-row">
        <span>DPH (${invoice.vatRate}%):</span>
        <span>${formatCurrency(invoice.vatAmount, invoice.currency)}</span>
      </div>
      <div class="totals-row total">
        <span>Celkem k úhradě:</span>
        <span>${formatCurrency(invoice.total, invoice.currency)}</span>
      </div>
    </div>
  </div>

  <div class="payment-info">
    <div class="payment-details">
      <div class="payment-title">Platební údaje</div>
      <div class="payment-row">
        <span class="payment-label">Číslo účtu:</span>
        <span class="payment-value">${invoice.userBankAccount}/${invoice.userBankCode}</span>
      </div>
      <div class="payment-row">
        <span class="payment-label">Variabilní symbol:</span>
        <span class="payment-value">${invoice.variableSymbol}</span>
      </div>
      <div class="payment-row">
        <span class="payment-label">Částka:</span>
        <span class="payment-value">${formatCurrency(invoice.total, invoice.currency)}</span>
      </div>
    </div>
    ${qrCodeDataUrl && invoice.currency === 'CZK' ? `
    <div class="qr-code">
      <img src="${qrCodeDataUrl}" alt="QR platba">
      <div class="qr-code-label">QR platba</div>
    </div>
    ` : ''}
  </div>

  ${invoice.notes ? `
  <div class="notes">
    <div class="notes-title">Poznámky:</div>
    <div>${invoice.notes}</div>
  </div>
  ` : ''}

  <div class="footer">
    Vystaveno dne ${formatDate(new Date())} | Faktura č. ${invoice.invoiceNumber}
  </div>
</body>
</html>
  `;
}

export async function generateInvoicePDF(invoiceId: string, userId: string): Promise<Buffer> {
  // Fetch invoice data
  const invoiceResult = await query(`
    SELECT i.*,
      c.company_name as client_name, c.address as client_address,
      c.ico as client_ico, c.dic as client_dic,
      u.name as user_name, u.company_name as user_company_name,
      u.company_address as user_address, u.company_ico as user_ico,
      u.company_dic as user_dic, u.bank_account as user_bank_account,
      u.bank_code as user_bank_code, u.logo_data as user_logo_data,
      u.logo_mime_type as user_logo_mime_type
    FROM invoices i
    JOIN clients c ON i.client_id = c.id
    JOIN users u ON i.user_id = u.id
    WHERE i.id = $1 AND i.user_id = $2
  `, [invoiceId, userId]);

  if (invoiceResult.rows.length === 0) {
    throw new Error('Invoice not found');
  }

  const row = invoiceResult.rows[0];

  // Fetch invoice items
  const itemsResult = await query(
    'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order ASC',
    [invoiceId]
  );

  // Get logo as data URL if exists
  const userLogoDataUrl = getLogoDataUrl(row.user_logo_data, row.user_logo_mime_type);

  const invoiceData: InvoiceData = {
    id: row.id,
    invoiceNumber: row.invoice_number,
    variableSymbol: row.variable_symbol,
    status: row.status,
    currency: row.currency,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    deliveryDate: row.delivery_date,
    subtotal: parseFloat(row.subtotal),
    vatRate: parseFloat(row.vat_rate),
    vatAmount: parseFloat(row.vat_amount),
    total: parseFloat(row.total),
    notes: row.notes,
    qrPaymentData: row.qr_payment_data,
    clientName: row.client_name,
    clientAddress: row.client_address,
    clientIco: row.client_ico,
    clientDic: row.client_dic,
    userName: row.user_name,
    userCompanyName: row.user_company_name,
    userAddress: row.user_address,
    userIco: row.user_ico,
    userDic: row.user_dic,
    userBankAccount: row.user_bank_account,
    userBankCode: row.user_bank_code,
    userLogoDataUrl,
    items: itemsResult.rows.map(item => ({
      description: item.description,
      quantity: parseFloat(item.quantity),
      unit: item.unit,
      unitPrice: parseFloat(item.unit_price),
      total: parseFloat(item.total)
    }))
  };

  // Generate QR code for CZK invoices
  let qrCodeDataUrl = '';
  if (invoiceData.qrPaymentData && invoiceData.currency === 'CZK') {
    qrCodeDataUrl = await generateQRCodeDataURL(invoiceData.qrPaymentData);
  }

  const html = generateInvoiceHTML(invoiceData, qrCodeDataUrl);

  // Generate PDF using Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
