import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildISDOC, xmlEscape } from './isdocGenerator';
import { mixedInvoice } from '../test/fixtures/invoice';

const schema = fileURLToPath(new URL('../test/fixtures/isdoc/isdoc-invoice-6.0.2.xsd', import.meta.url));

describe('ISDOC 6.0.2', () => {
  it.each(['CZK', 'EUR'])('validates mixed VAT %s invoices against the official XSD', currency => {
    const xml = buildISDOC(mixedInvoice(currency));
    expect(() => execFileSync('xmllint', ['--noout', '--nonet', '--schema', schema, '-'], { input: xml, stdio: ['pipe', 'pipe', 'pipe'] })).not.toThrow();
    expect(xml).toContain('<Percent>12</Percent>');
    expect(xml).toContain('<LocalReverseChargeCode>4</LocalReverseChargeCode>');
    expect(xml).toContain('<VATNote>§ 57 zákona o DPH</VATNote>');
    expect(xml).toContain('Vývoj &amp; konzultace &lt;IT&gt;');
    expect(xml).toContain('<TaxPointDate>2026-08-31</TaxPointDate>');
    if (currency === 'EUR') {
      expect(xml).toContain('<ForeignCurrencyCode>EUR</ForeignCurrencyCode>');
      expect(xml).toContain('<CurrRate>24.321</CurrRate>');
      expect(xml).toContain('<PayableAmountCurr>');
    } else expect(xml).not.toContain('AmountCurr>');
  });

  it('exports non-VAT payers without contradictory taxable lines', () => {
    const doc = mixedInvoice();
    doc.items = [{ ...doc.items[0], quantity: 1, unitPrice: 100, total: 100, vatRate: 0, vatAmount: 0 }];
    Object.assign(doc.invoice, { user_vat_payer: false, subtotal: 100, vat_amount: 0, total: 100 });
    const xml = buildISDOC(doc);
    expect(xml).not.toContain('<VATApplicable>true</VATApplicable>');
    execFileSync('xmllint', ['--noout', '--nonet', '--schema', schema, '-'], { input: xml, stdio: ['pipe', 'pipe', 'pipe'] });
  });

  it('refuses missing exchange rates or inconsistent recorded totals', () => {
    const doc = mixedInvoice('EUR');
    doc.invoice.exchange_rate = null;
    expect(() => buildISDOC(doc)).toThrow('exchange rate is missing');
    const broken = mixedInvoice();
    broken.invoice.vat_amount += 1;
    expect(() => buildISDOC(broken)).toThrow('do not reconcile');
  });

  it('requires the reverse-charge supply code', () => {
    const doc = mixedInvoice();
    doc.items[3].vatCode = '';
    expect(() => buildISDOC(doc)).toThrow('supply code is missing');
  });

  it('escapes XML metacharacters and removes forbidden control bytes', () => {
    expect(xmlEscape('\u0000<&"\'')).toBe('&lt;&amp;&quot;&apos;');
  });

  it('exports recorded EUR tax and independently reconciled CZK rounding, not recalculated VAT', () => {
    const doc = mixedInvoice('EUR');
    // Deliberately do not derive the expected amounts from the money implementation.
    Object.assign(doc.invoice, { subtotal: 0.06, vat_amount: 0.01, total: 0.07, exchange_rate: 24.321, total_czk: 1.70 });
    doc.items = [
      { ...doc.items[0], quantity: 1, unitPrice: 0.03, total: 0.03, vatRate: 21, vatAmount: 0.01 },
      { ...doc.items[0], id: 'line-2', quantity: 1, unitPrice: 0.03, total: 0.03, vatRate: 21, vatAmount: 0 },
    ];
    const xml = buildISDOC(doc);
    const monetary = xml.match(/<LegalMonetaryTotal>([\s\S]*?)<\/LegalMonetaryTotal>/)![1];
    expect(monetary).toContain('<TaxExclusiveAmount>1.46</TaxExclusiveAmount><TaxExclusiveAmountCurr>0.06</TaxExclusiveAmountCurr>');
    expect(monetary).toContain('<TaxInclusiveAmount>1.70</TaxInclusiveAmount><TaxInclusiveAmountCurr>0.07</TaxInclusiveAmountCurr>');
    expect(monetary).toContain('<PayableAmount>1.70</PayableAmount><PayableAmountCurr>0.07</PayableAmountCurr>');
    expect(xml).toContain('<TaxAmountCurr>0.01</TaxAmountCurr><TaxAmount>0.24</TaxAmount>');
    expect([...xml.matchAll(/<LineExtensionTaxAmount>(.*?)<\/LineExtensionTaxAmount>/g)].map(match => match[1])).toEqual(['0.24', '0.00']);

    // Stored payable can differ from summed converted lines by a cent.
    doc.invoice.total_czk = 1.71;
    expect(buildISDOC(doc)).toContain('<PayableRoundingAmount>0.01</PayableRoundingAmount>');
  });

  it('keeps a historical manually recorded tax amount instead of replacing it with the nominal rate', () => {
    const doc = mixedInvoice();
    Object.assign(doc.invoice, { subtotal: 100, vat_amount: 21.01, total: 121.01 });
    doc.items = [{ ...doc.items[0], quantity: 1, unitPrice: 100, total: 100, vatRate: 21, vatAmount: 21.01 }];
    const xml = buildISDOC(doc);
    expect(xml).toContain('<LineExtensionTaxAmount>21.01</LineExtensionTaxAmount>');
    expect(xml).toContain('<TaxAmount>21.01</TaxAmount>');
    expect(xml).toContain('<PayableAmount>121.01</PayableAmount>');
  });

});
