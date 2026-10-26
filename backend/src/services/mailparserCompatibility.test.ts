import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { simpleParser } from 'mailparser';
import type { ParsedMail } from 'mailparser';
import { parsePaymentEmail } from './bankParsers';

// Synthetic messages only: exercise the same decoded fields consumed by
// processEmail, without IMAP, a database, or sending any mail.
function notification(currency: 'CZK' | 'EUR', incoming = true) {
  return [
    'Dobrý den,',
    `zůstatek na účtu TEST číslo 123456789/3030 se ${incoming ? 'zvýšil' : 'snížil'} o částku 1 234,56 ${currency}.`,
    'Příchozí úhrada z účtu Žluťoučký Test s.r.o. číslo 987654321/0800',
    'Datum zaúčtování: 26.10.2026',
    'Variabilní symbol: 000123',
    'Zpráva pro příjemce: Faktura za říjen — test',
    'Kód transakce: 000987654321',
  ].join('\r\n');
}

function encodeBody(body: string, encoding: 'quoted-printable' | 'base64') {
  if (encoding === 'base64') return Buffer.from(body).toString('base64').match(/.{1,76}/g)!.join('\r\n');
  // Encode every UTF-8 byte, including line breaks; soft line breaks split
  // encoded words too, guarding against decoding corruption across chunks.
  return [...Buffer.from(body)].map(byte => `=${byte.toString(16).toUpperCase().padStart(2, '0')}`)
    .join('').match(/.{1,60}/g)!.join('=\r\n');
}

function rawMessage(body: string, encoding: 'quoted-printable' | 'base64', from = 'info@airbank.cz') {
  return [
    `From: =?UTF-8?B?${Buffer.from('Oznámení banky').toString('base64')}?= <${from}>`,
    'To: synthetic@example.invalid',
    'Date: Mon, 26 Oct 2026 10:00:00 +0000',
    'Message-ID: <synthetic-bank-fixture@example.invalid>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="fixture-boundary"',
    '',
    '--fixture-boundary',
    'Content-Type: text/plain; charset=UTF-8',
    `Content-Transfer-Encoding: ${encoding}`,
    '',
    encodeBody(body, encoding),
    '--fixture-boundary',
    'Content-Type: text/html; charset=UTF-8',
    '',
    '<p>Alternative HTML must not replace the authoritative plain-text notification.</p>',
    '--fixture-boundary--',
    '',
  ].join('\r\n');
}

async function parseNotification(raw: string) {
  // Production uses the stream/callback overload, not only the Promise API.
  const bytes = Buffer.from(raw);
  const chunks = Array.from({ length: Math.ceil(bytes.length / 17) }, (_, i) => bytes.subarray(i * 17, (i + 1) * 17));
  const mail = await new Promise<ParsedMail>((resolve, reject) => {
    simpleParser(Readable.from(chunks), (error, parsed) => error ? reject(error) : resolve(parsed));
  });
  return {
    mail,
    result: parsePaymentEmail(mail.from?.value[0]?.address || '', mail.text || '', mail.date || new Date()),
  };
}

describe('mailparser bank notification compatibility', () => {
  it.each(['quoted-printable', 'base64'] as const)('preserves Czech payment fields in %s multipart messages', async encoding => {
    for (const currency of ['CZK', 'EUR'] as const) {
      const { mail, result } = await parseNotification(rawMessage(notification(currency), encoding));
      expect(mail.from?.value[0]?.address).toBe('info@airbank.cz');
      expect(mail.date).toEqual(new Date('2026-10-26T10:00:00Z'));
      expect(result.bankType).toBe('airbank');
      expect(result.payment).toMatchObject({
        amount: 1234.56,
        currency,
        variableSymbol: '000123',
        transactionCode: '000987654321',
        senderName: 'Žluťoučký Test s.r.o.',
        senderAccount: '987654321/0800',
        message: 'Faktura za říjen — test',
        transactionDate: new Date(2026, 9, 26),
      });
      expect(result.payment?.rawEmail).toContain('se zvýšil o částku');
    }
  });

  it('does not turn an encoded outgoing notification into an incoming payment', async () => {
    const { result } = await parseNotification(rawMessage(notification('CZK', false), 'quoted-printable'));
    expect(result).toEqual({ bankType: 'airbank', payment: null });
  });

  it('does not use an encoded display name as the bank sender address', async () => {
    const raw = rawMessage(notification('CZK'), 'base64', 'sender@example.invalid')
      .replace(Buffer.from('Oznámení banky').toString('base64'), Buffer.from('info@airbank.cz').toString('base64'));
    const { mail, result } = await parseNotification(raw);
    expect(mail.from?.value[0]?.address).toBe('sender@example.invalid');
    expect(result).toEqual({ bankType: null, payment: null });
  });
});
