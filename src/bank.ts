export type ParsedPayment = {
  amountCents: number;
  currency: string;
  variableSymbol?: string;
  receivedAt: string;
  description?: string;
};

const parseAmountCents = (value: string) => {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return Math.round(parsed * 100);
};

export const parseAirBankEmail = (text: string): ParsedPayment | undefined => {
  const amountMatch = text.match(/([0-9]+(?:[.,][0-9]{2})?)\s*CZK/i);
  const amountCents = amountMatch ? parseAmountCents(amountMatch[1]) : undefined;
  if (!amountCents) {
    return undefined;
  }

  const variableSymbolMatch = text.match(/VS[:\s]+([0-9]{3,})/i);
  const dateMatch = text.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
  const receivedAt = dateMatch
    ? new Date(dateMatch[1].split(".").reverse().join("-")).toISOString()
    : new Date().toISOString();

  const descriptionMatch = text.match(/Zpr[aá]va pro p[rř]i[jj]emce[:\s]+(.+)/i);

  return {
    amountCents,
    currency: "CZK",
    variableSymbol: variableSymbolMatch?.[1],
    receivedAt,
    description: descriptionMatch?.[1]?.trim()
  };
};
