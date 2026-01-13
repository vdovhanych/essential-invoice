// Bank parser factory
// Extensible system for parsing payment notifications from different banks

import { parseAirBankEmail, isIncomingPayment as isAirBankIncoming, BANK_TYPE as AIRBANK_TYPE, EXPECTED_SENDER as AIRBANK_SENDER, ParsedPayment } from './airbank.js';

export { ParsedPayment } from './airbank.js';

interface BankParser {
  type: string;
  expectedSender: string;
  isIncomingPayment: (emailBody: string) => boolean;
  parse: (emailBody: string, emailDate: Date) => ParsedPayment | null;
}

// Register available bank parsers
const bankParsers: BankParser[] = [
  {
    type: AIRBANK_TYPE,
    expectedSender: AIRBANK_SENDER,
    isIncomingPayment: isAirBankIncoming,
    parse: parseAirBankEmail
  }
  // Add more banks here:
  // {
  //   type: 'csob',
  //   expectedSender: 'notification@csob.cz',
  //   isIncomingPayment: isCSObIncoming,
  //   parse: parseCSOBEmail
  // },
];

export function detectBank(senderEmail: string): BankParser | null {
  // Normalize email
  const normalizedSender = senderEmail.toLowerCase().trim();

  for (const parser of bankParsers) {
    if (normalizedSender.includes(parser.expectedSender.toLowerCase())) {
      return parser;
    }
  }

  return null;
}

export function parsePaymentEmail(
  senderEmail: string,
  emailBody: string,
  emailDate: Date
): { payment: ParsedPayment | null; bankType: string | null } {
  const parser = detectBank(senderEmail);

  if (!parser) {
    return { payment: null, bankType: null };
  }

  // Check if this is an incoming payment (not outgoing)
  if (!parser.isIncomingPayment(emailBody)) {
    return { payment: null, bankType: parser.type };
  }

  const payment = parser.parse(emailBody, emailDate);
  return { payment, bankType: parser.type };
}

export function getSupportedBanks(): Array<{ type: string; sender: string }> {
  return bankParsers.map(p => ({ type: p.type, sender: p.expectedSender }));
}
