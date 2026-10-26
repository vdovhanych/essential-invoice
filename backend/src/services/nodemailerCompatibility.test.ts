import { describe, expect, it } from 'vitest';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';

// Offline transports only. These must never connect to a real SMTP service.
const attachment = Buffer.from('%PDF-1.4\n% synthetic invoice fixture\n%%EOF');
const message = {
  from: '"Žluťoučký dodavatel" <supplier@example.invalid>',
  to: '"Příjemce faktury" <recipient@example.invalid>',
  subject: 'Faktura č. TEST-000123 — říjen',
  text: 'Částka k úhradě: 1 234,56 CZK. Variabilní symbol: 000123.',
  attachments: [{ filename: 'faktura-říjen.pdf', content: attachment, contentType: 'application/pdf' }],
};

describe('nodemailer offline compatibility', () => {
  it('preserves Czech invoice content, addresses and PDF bytes in generated MIME', async () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const info = await transport.sendMail(message);
    expect(info.envelope).toMatchObject({ from: 'supplier@example.invalid', to: ['recipient@example.invalid'] });
    const parsed = await simpleParser(info.message);
    expect(parsed.subject).toBe(message.subject);
    expect(parsed.from?.value[0]).toMatchObject({ address: 'supplier@example.invalid', name: 'Žluťoučký dodavatel' });
    expect(parsed.to).toMatchObject({ value: [{ address: 'recipient@example.invalid', name: 'Příjemce faktury' }] });
    expect(parsed.text?.trim()).toBe(message.text);
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0]).toMatchObject({ filename: 'faktura-říjen.pdf', contentType: 'application/pdf' });
    expect(parsed.attachments[0].content).toEqual(attachment);
  });

  it('supports the dynamic default import used by SMTP settings without network access', async () => {
    const imported = await import('nodemailer');
    const transport = imported.default.createTransport({ jsonTransport: true });
    const info = await transport.sendMail(message);
    if (typeof info.message !== 'string') {
      throw new Error('Offline JSON transport must return a serialized message when skipEncoding is not enabled');
    }
    const generated = JSON.parse(info.message);
    expect(generated.subject).toBe(message.subject);
    expect(generated.text).toBe(message.text);
    expect(generated.from).toMatchObject({ address: 'supplier@example.invalid' });
    expect(generated.to).toMatchObject([{ address: 'recipient@example.invalid' }]);
    expect(Buffer.from(generated.attachments[0].content, 'base64')).toEqual(attachment);
  });
});
