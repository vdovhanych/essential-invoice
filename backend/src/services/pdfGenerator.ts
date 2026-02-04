import QRCode from 'qrcode';
import { query } from '../db/init.js';

// pdfmake is a CJS module – require it
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake/build/pdfmake.js');
const vfsFonts = require('pdfmake/build/vfs_fonts.js');
pdfmake.addVirtualFileSystem(vfsFonts);

import type { TDocumentDefinitions, Content, TableCell, Column } from 'pdfmake/interfaces';

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

const BLUE = '#2563eb';
const GRAY_BORDER = '#e5e7eb';

function buildDocumentDefinition(invoice: InvoiceData, qrCodeDataUrl: string): TDocumentDefinitions {
  // --- Header section ---
  const headerRight: Content = invoice.userLogoDataUrl
    ? { image: invoice.userLogoDataUrl, width: 150, alignment: 'right' as const }
    : {
        stack: [
          { text: invoice.userCompanyName || invoice.userName, bold: true, fontSize: 13, alignment: 'right' as const },
          ...(invoice.userAddress ? [{ text: invoice.userAddress, color: '#555', alignment: 'right' as const }] : []),
          ...(invoice.userIco ? [{ text: `IČO: ${invoice.userIco}`, color: '#555', alignment: 'right' as const }] : []),
          ...(invoice.userDic ? [{ text: `DIČ: ${invoice.userDic}`, color: '#555', alignment: 'right' as const }] : []),
        ],
      };

  const headerSection: Content = {
    columns: [
      {
        width: '*',
        stack: [
          { text: 'FAKTURA', fontSize: 26, bold: true, color: BLUE },
          { text: `č. ${invoice.invoiceNumber}`, fontSize: 13, color: '#666', margin: [0, 4, 0, 0] },
        ],
      },
      { width: '*', ...headerRight } as any,
    ],
    margin: [0, 0, 0, 12],
  };

  const headerLine: Content = {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: BLUE }],
    margin: [0, 0, 0, 20],
  };

  // --- Parties section ---
  function buildPartyStack(title: string, name: string, address: string, ico: string, dic: string): Column {
    const lines: Content[] = [];
    if (address) lines.push({ text: address, color: '#555' });
    if (ico) lines.push({ text: `IČO: ${ico}`, color: '#555' });
    if (dic) lines.push({ text: `DIČ: ${dic}`, color: '#555' });
    return {
      width: '*',
      stack: [
        { text: title, fontSize: 9, bold: true, color: '#666', margin: [0, 0, 0, 6] },
        { text: name, fontSize: 13, bold: true, margin: [0, 0, 0, 4] },
        ...lines,
      ],
    };
  }

  const partiesSection: Content = {
    columns: [
      buildPartyStack('DODAVATEL', invoice.userCompanyName || invoice.userName, invoice.userAddress, invoice.userIco, invoice.userDic),
      buildPartyStack('ODBĚRATEL', invoice.clientName, invoice.clientAddress, invoice.clientIco, invoice.clientDic),
    ],
    margin: [0, 0, 0, 18],
  };

  // --- Dates section ---
  const datesSection: Content = {
    table: {
      widths: ['*', '*', '*'],
      body: [
        [
          { text: 'DATUM VYSTAVENÍ', fontSize: 8, color: '#666', alignment: 'center' as const },
          { text: 'DATUM ZDANITELNÉHO PLNĚNÍ', fontSize: 8, color: '#666', alignment: 'center' as const },
          { text: 'DATUM SPLATNOSTI', fontSize: 8, color: '#666', alignment: 'center' as const },
        ],
        [
          { text: formatDate(invoice.issueDate), fontSize: 11, bold: true, alignment: 'center' as const },
          { text: formatDate(invoice.deliveryDate), fontSize: 11, bold: true, alignment: 'center' as const },
          { text: formatDate(invoice.dueDate), fontSize: 11, bold: true, alignment: 'center' as const },
        ],
      ],
    },
    layout: {
      fillColor: () => '#f8fafc',
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingTop: () => 6,
      paddingBottom: () => 6,
      paddingLeft: () => 8,
      paddingRight: () => 8,
    },
    margin: [0, 0, 0, 18],
  };

  // --- Items table ---
  const itemsHeaderRow: TableCell[] = [
    { text: 'POPIS', style: 'tableHeader' },
    { text: 'MNOŽSTVÍ', style: 'tableHeader', alignment: 'right' },
    { text: 'CENA ZA JEDNOTKU', style: 'tableHeader', alignment: 'right' },
    { text: 'CELKEM', style: 'tableHeader', alignment: 'right' },
  ];

  const itemRows: TableCell[][] = invoice.items.map(item => [
    { text: item.description },
    { text: `${item.quantity} ${item.unit}`, alignment: 'right' as const },
    { text: formatCurrency(item.unitPrice, invoice.currency), alignment: 'right' as const },
    { text: formatCurrency(item.total, invoice.currency), alignment: 'right' as const },
  ]);

  const itemsSection: Content = {
    table: {
      headerRows: 1,
      widths: ['*', 'auto', 'auto', 'auto'],
      body: [itemsHeaderRow, ...itemRows],
    },
    layout: {
      fillColor: (rowIndex: number) => (rowIndex === 0 ? BLUE : null),
      hLineWidth: (i: number, node: any) => (i === 0 || i === 1 ? 0 : 1),
      vLineWidth: () => 0,
      hLineColor: () => GRAY_BORDER,
      paddingTop: () => 8,
      paddingBottom: () => 8,
      paddingLeft: () => 8,
      paddingRight: () => 8,
    },
    margin: [0, 0, 0, 18],
  };

  // --- Totals section ---
  const totalsTable: Column = {
    width: 250,
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          { text: 'Základ daně:' },
          { text: formatCurrency(invoice.subtotal, invoice.currency), alignment: 'right' as const },
        ],
        [
          { text: `DPH (${invoice.vatRate}%):` },
          { text: formatCurrency(invoice.vatAmount, invoice.currency), alignment: 'right' as const },
        ],
        [
          { text: 'Celkem k úhradě:', bold: true, fontSize: 14, color: BLUE, margin: [0, 8, 0, 0] as [number, number, number, number] },
          { text: formatCurrency(invoice.total, invoice.currency), bold: true, fontSize: 14, color: BLUE, alignment: 'right' as const, margin: [0, 8, 0, 0] as [number, number, number, number] },
        ],
      ],
    },
    layout: {
      hLineWidth: (i: number) => (i > 0 && i < 3 ? 1 : 0),
      vLineWidth: () => 0,
      hLineColor: () => GRAY_BORDER,
      paddingTop: () => 4,
      paddingBottom: () => 4,
      paddingLeft: () => 0,
      paddingRight: () => 0,
    },
  };

  const totalsSection: Content = {
    columns: [
      { width: '*', text: '' },
      totalsTable,
    ],
    margin: [0, 0, 0, 16],
  };

  // --- Payment info section ---
  const paymentRows: Content[] = [
    {
      columns: [
        { width: 110, text: 'Číslo účtu:', color: '#666' },
        { width: '*', text: `${invoice.userBankAccount}/${invoice.userBankCode}`, bold: true },
      ],
      margin: [0, 0, 0, 4],
    },
    {
      columns: [
        { width: 110, text: 'Variabilní symbol:', color: '#666' },
        { width: '*', text: invoice.variableSymbol, bold: true },
      ],
      margin: [0, 0, 0, 4],
    },
    {
      columns: [
        { width: 110, text: 'Částka:', color: '#666' },
        { width: '*', text: formatCurrency(invoice.total, invoice.currency), bold: true },
      ],
    },
  ];

  const paymentColumns: Column[] = [
    {
      width: '*',
      stack: [
        { text: 'Platební údaje', fontSize: 12, bold: true, color: '#0369a1', margin: [0, 0, 0, 10] },
        ...paymentRows,
      ],
    },
  ];

  if (qrCodeDataUrl && invoice.currency === 'CZK') {
    paymentColumns.push({
      width: 'auto',
      stack: [
        { image: qrCodeDataUrl, width: 100, alignment: 'center' as const },
        { text: 'QR platba', fontSize: 8, color: '#666', alignment: 'center' as const, margin: [0, 4, 0, 0] },
      ],
    });
  }

  const paymentSection: Content = {
    table: {
      widths: ['*'],
      body: [
        [
          {
            columns: paymentColumns,
            columnGap: 15,
          },
        ],
      ],
    },
    layout: {
      fillColor: () => '#f0f9ff',
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => '#bae6fd',
      vLineColor: () => '#bae6fd',
      paddingTop: () => 12,
      paddingBottom: () => 12,
      paddingLeft: () => 14,
      paddingRight: () => 14,
    },
    margin: [0, 0, 0, 0],
  };

  // --- Notes section (conditional) ---
  const notesSection: Content | null = invoice.notes
    ? {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: 'Poznámky:', bold: true, margin: [0, 0, 0, 4] },
                  { text: invoice.notes },
                ],
              },
            ],
          ],
        },
        layout: {
          fillColor: () => '#fefce8',
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => '#fde047',
          vLineColor: () => '#fde047',
          paddingTop: () => 10,
          paddingBottom: () => 10,
          paddingLeft: () => 12,
          paddingRight: () => 12,
        },
        margin: [0, 16, 0, 0],
      }
    : null;

  // --- Footer ---
  const footerLine: Content = {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: GRAY_BORDER }],
    margin: [0, 20, 0, 10],
  };

  const footerText: Content = {
    text: `Vystaveno dne ${formatDate(new Date())} | Faktura č. ${invoice.invoiceNumber}`,
    alignment: 'center',
    color: '#666',
    fontSize: 8,
  };

  // --- Assemble document ---
  const content: Content[] = [
    headerSection,
    headerLine,
    partiesSection,
    datesSection,
    itemsSection,
    totalsSection,
    paymentSection,
  ];

  if (notesSection) {
    content.push(notesSection);
  }

  content.push(footerLine);
  content.push(footerText);

  return {
    pageSize: 'A4',
    pageMargins: [30, 30, 30, 30],
    content,
    styles: {
      tableHeader: {
        color: 'white',
        bold: true,
        fontSize: 9,
      },
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      lineHeight: 1.3,
    },
  };
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

  const docDefinition = buildDocumentDefinition(invoiceData, qrCodeDataUrl);

  // Generate PDF buffer
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const pdf = pdfmake.createPdf(docDefinition);
      pdf.getBuffer((buffer: Uint8Array) => {
        resolve(Buffer.from(buffer));
      });
    } catch (err) {
      reject(err);
    }
  });
}
