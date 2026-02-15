// Air Bank email parser
// Parses incoming payment notifications from Air Bank (info@airbank.cz)

export interface ParsedPayment {
  amount: number;
  currency: string;
  variableSymbol: string | null;
  senderName: string | null;
  senderAccount: string | null;
  message: string | null;
  transactionCode: string | null;
  transactionDate: Date | null;
  rawEmail: string;
}

export function isIncomingPayment(emailBody: string): boolean {
  // Check if this is an incoming payment (balance increased)
  // Incoming: "se zvýšil o částku" (balance increased)
  // Outgoing: "se snížil o částku" (balance decreased) - ignore these
  return emailBody.includes('se zvýšil o částku');
}

export function parseAirBankEmail(emailBody: string, emailDate: Date): ParsedPayment | null {
  // Only parse incoming payments
  if (!isIncomingPayment(emailBody)) {
    return null;
  }

  const result: ParsedPayment = {
    amount: 0,
    currency: 'CZK',
    variableSymbol: null,
    senderName: null,
    senderAccount: null,
    message: null,
    transactionCode: null,
    transactionDate: null,
    rawEmail: emailBody
  };

  try {
    // Extract amount
    // Pattern: "zvýšil o částku 141 900,00 CZK" or "zvýšil o částku 1 234,56 EUR"
    const amountMatch = emailBody.match(/zvýšil o částku ([\d\s]+,\d{2})\s*(CZK|EUR)/);
    if (amountMatch) {
      // Remove spaces and convert comma to decimal point
      const amountStr = amountMatch[1].replace(/\s/g, '').replace(',', '.');
      result.amount = parseFloat(amountStr);
      result.currency = amountMatch[2];
    }

    // Extract variable symbol
    // Pattern: "Variabilní symbol: 202601"
    const vsMatch = emailBody.match(/Variabilní symbol:\s*(\d+)/);
    if (vsMatch) {
      result.variableSymbol = vsMatch[1];
    }

    // Extract sender name and account
    // Pattern: "Příchozí úhrada z účtu Trezor Company s.r.o číslo 2501309857/2010"
    const senderMatch = emailBody.match(/Příchozí úhrada z účtu\s+(.+?)\s+číslo\s+(\d+\/\d+)/);
    if (senderMatch) {
      result.senderName = senderMatch[1].trim();
      result.senderAccount = senderMatch[2];
    }

    // Extract message for recipient
    // Pattern: "Zpráva pro příjemce: F202601 Vitalij Dovhanyč"
    const messageMatch = emailBody.match(/Zpráva pro příjemce:\s*(.+?)(?:\n|$)/);
    if (messageMatch) {
      result.message = messageMatch[1].trim();
    }

    // Extract transaction code
    // Pattern: "Kód transakce: 146872844642"
    const codeMatch = emailBody.match(/Kód transakce:\s*(\d+)/);
    if (codeMatch) {
      result.transactionCode = codeMatch[1];
    }

    // Extract transaction date
    // Pattern: "Datum zaúčtování: 09.01.2026"
    const dateMatch = emailBody.match(/Datum zaúčtování:\s*(\d{2})\.(\d{2})\.(\d{4})/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1; // JS months are 0-indexed
      const year = parseInt(dateMatch[3]);
      result.transactionDate = new Date(year, month, day);
    } else {
      // Fallback to email date
      result.transactionDate = emailDate;
    }

    // Validate we got at least an amount
    if (result.amount <= 0) {
      console.warn('Air Bank parser: Could not extract valid amount');
      return null;
    }

    return result;
  } catch (error) {
    console.error('Air Bank parser error:', error);
    return null;
  }
}

// Export bank identifier
export const BANK_TYPE = 'airbank';
export const EXPECTED_SENDER = 'info@airbank.cz';
