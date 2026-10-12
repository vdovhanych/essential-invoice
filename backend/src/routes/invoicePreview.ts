import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth';
import { query } from '../db/init';
import { renderInvoicePDF, InvoiceData } from '../services/pdfGenerator';
import { calculateInvoiceTax } from '../utils/money';
import { generateSpayd } from '../utils/validation';
import { convertEurToCzk } from '../services/cnbExchangeRate';
import { t } from '../i18n/translations';

export const invoicePreviewRouter: ReturnType<typeof Router> = Router();

// Drafts can have empty fields, but supplied values must still be safe to render.
invoicePreviewRouter.post('/',
  body('invoiceId').optional().isUUID(),
  body('clientId').optional({ values: 'falsy' }).isUUID(),
  ...['issueDate', 'dueDate', 'deliveryDate'].map(field =>
    body(field).optional({ values: 'falsy' }).matches(/^\d{4}-\d{2}-\d{2}$/).isISO8601({ strict: true })),
  body('currency').optional().isIn(['CZK', 'EUR']),
  body('vatRate').optional().isFloat({ min: 0, max: 100 }),
  body('notes').optional().isString().isLength({ max: 300 }),
  body('items').isArray({ max: 500 }),
  body('items.*.description').isString().isLength({ max: 150 }),
  body('items.*.unit').optional().isString().isLength({ max: 50 }),
  body('items.*.quantity').isFloat({ min: 0, max: 1e9 }),
  body('items.*.unitPrice').isFloat({ min: 0, max: 1e9 }),
  body('items.*.vatRate').optional().isFloat({ min: 0, max: 100 }),
  body('items.*.vatTreatment').optional().isIn(['standard', 'exempt', 'reverse_charge', 'eu_service']),
  body('items.*.vatReason').optional().isString().isLength({ max: 300 }),
  async (req: AuthRequest, res: Response) => {
    if (!validationResult(req).isEmpty()) {
      return res.status(400).json({ error: 'Invalid preview data' });
    }
    try {
      const { invoiceId, clientId, issueDate, dueDate, deliveryDate, currency = 'CZK', vatRate = 21, notes = '' } = req.body;
      // Never accept supplier details or assigned numbers from the browser.
      const user = (await query(`SELECT name, company_name, company_address, company_ico, company_dic,
        vat_payer, bank_account, bank_code, language, logo_data, logo_mime_type
        FROM users WHERE id = $1`, [req.userId])).rows[0];
      if (!user) return res.status(404).json({ error: 'User not found' });
      let client;
      if (clientId) {
        client = (await query('SELECT * FROM clients WHERE id = $1 AND user_id = $2', [clientId, req.userId])).rows[0];
        if (!client) return res.status(404).json({ error: 'Client not found' });
      }
      let existing;
      if (invoiceId) {
        existing = (await query('SELECT invoice_number, variable_symbol FROM invoices WHERE id = $1 AND user_id = $2', [invoiceId, req.userId])).rows[0];
        if (!existing) return res.status(404).json({ error: 'Invoice not found' });
      }
      const language = user.language || 'cs';
      const tr = t(language).pdf;
      const items = req.body.items.map((item: InvoiceData['items'][number]) => ({
        ...item, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice),
        description: item.description.trim() || tr.previewItem, unit: item.unit || 'ks',
      }));
      const { subtotal, vatAmount, total, lines } = calculateInvoiceTax(items, Number(vatRate));
      // Same conversion service and date as invoice creation; only its rate cache may be updated.
      const conversion = currency === 'EUR' && issueDate ? await convertEurToCzk(total, issueDate) : null;
      const qrPaymentData = existing && currency === 'CZK' && user.bank_account && user.bank_code
        ? generateSpayd(user.bank_account, user.bank_code, total, currency, existing.variable_symbol,
          `${language === 'en' ? 'Invoice' : 'Faktura'} ${existing.invoice_number}`)
        : '';
      const pdf = await renderInvoicePDF({
        id: invoiceId || '', status: 'draft', draftPreview: !existing,
        invoiceNumber: existing?.invoice_number || tr.previewNumber,
        variableSymbol: existing?.variable_symbol || tr.previewAssignedOnSave,
        currency, issueDate: issueDate ? new Date(issueDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        deliveryDate: (deliveryDate || issueDate) ? new Date(deliveryDate || issueDate) : null,
        subtotal, vatRate: Number(vatRate), vatAmount, total, notes, qrPaymentData,
        exchangeRate: conversion?.rate ?? null, totalCzk: conversion?.czkAmount ?? null,
        clientName: client?.company_name || tr.previewCustomer,
        clientAddress: client?.address || '', clientIco: client?.ico || '', clientDic: client?.dic || '',
        userName: user.name, userCompanyName: user.company_name || '', userAddress: user.company_address || '',
        userIco: user.company_ico || '', userDic: user.company_dic || '', userVatPayer: user.vat_payer !== false,
        userBankAccount: user.bank_account || '', userBankCode: user.bank_code || '',
        userLogoDataUrl: user.logo_data && user.logo_mime_type ? `data:${user.logo_mime_type};base64,${user.logo_data}` : null,
        language, items: lines.map((line, index) => ({ ...items[index], ...line })),
      });
      res.setHeader('Cache-Control', 'no-store');
      res.json({ pdfBase64: pdf.toString('base64') });
    } catch (error) {
      console.error('Invoice draft preview error:', error);
      res.status(500).json({ error: 'Failed to generate preview' });
    }
  },
);
