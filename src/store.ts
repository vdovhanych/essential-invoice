import { randomUUID } from "node:crypto";

export type Client = {
  id: string;
  companyName: string;
  primaryEmail: string;
  secondaryEmail?: string;
  address?: string;
  ico?: string;
  dic?: string;
  contactName?: string;
  contactPhone?: string;
  createdAt: string;
};

export type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  vatRate?: number;
  lineTotalCents: number;
};

export type Invoice = {
  id: string;
  clientId: string;
  invoiceNumber: string;
  status: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  paymentTerms?: string;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  qrPaymentCode?: string;
  sentAt?: string;
  createdAt: string;
  items: InvoiceItem[];
};

export type Payment = {
  id: string;
  amountCents: number;
  currency: string;
  variableSymbol?: string;
  description?: string;
  receivedAt: string;
  source: string;
  matchedInvoiceId?: string;
  createdAt: string;
};

export type CreateClientInput = Omit<Client, "id" | "createdAt">;
export type UpdateClientInput = Partial<CreateClientInput>;

export type CreateInvoiceInput = Omit<
  Invoice,
  | "id"
  | "createdAt"
  | "subtotalCents"
  | "vatCents"
  | "totalCents"
  | "qrPaymentCode"
  | "items"
> & {
  items: Array<
    Omit<InvoiceItem, "id" | "lineTotalCents"> & {
      vatRate?: number;
    }
  >;
};

export type UpdateInvoiceInput = Partial<
  Omit<CreateInvoiceInput, "clientId"> & { items: CreateInvoiceInput["items"] }
>;

export const calculateInvoiceTotals = (
  items: CreateInvoiceInput["items"]
): { items: InvoiceItem[]; subtotalCents: number; vatCents: number; totalCents: number } => {
  let subtotalCents = 0;
  let vatCents = 0;

  const mapped = items.map((item) => {
    const baseTotal = Math.round(item.quantity * item.unitPriceCents);
    const lineVat = item.vatRate ? Math.round((baseTotal * item.vatRate) / 100) : 0;
    const lineTotal = baseTotal + lineVat;
    subtotalCents += baseTotal;
    vatCents += lineVat;
    return {
      id: randomUUID(),
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      vatRate: item.vatRate,
      lineTotalCents: lineTotal
    };
  });

  return {
    items: mapped,
    subtotalCents,
    vatCents,
    totalCents: subtotalCents + vatCents
  };
};

export const createStore = () => {
  const clients = new Map<string, Client>();
  const invoices = new Map<string, Invoice>();
  const payments = new Map<string, Payment>();

  return {
    listClients: () => Array.from(clients.values()),
    getClient: (id: string) => clients.get(id),
    createClient: (input: CreateClientInput) => {
      const client: Client = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...input
      };
      clients.set(client.id, client);
      return client;
    },
    updateClient: (id: string, input: UpdateClientInput) => {
      const existing = clients.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...input };
      clients.set(id, updated);
      return updated;
    },
    deleteClient: (id: string) => {
      const existing = clients.get(id);
      if (!existing) return false;
      clients.delete(id);
      Array.from(invoices.values()).forEach((invoice) => {
        if (invoice.clientId === id) {
          invoices.delete(invoice.id);
        }
      });
      return true;
    },
    listInvoices: () => Array.from(invoices.values()),
    listInvoicesByClient: (clientId: string) =>
      Array.from(invoices.values()).filter((invoice) => invoice.clientId === clientId),
    getInvoice: (id: string) => invoices.get(id),
    createInvoice: (input: CreateInvoiceInput, qrPaymentCode?: string) => {
      const totals = calculateInvoiceTotals(input.items);
      const invoice: Invoice = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        clientId: input.clientId,
        invoiceNumber: input.invoiceNumber,
        status: input.status,
        currency: input.currency,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        paymentTerms: input.paymentTerms,
        subtotalCents: totals.subtotalCents,
        vatCents: totals.vatCents,
        totalCents: totals.totalCents,
        qrPaymentCode,
        sentAt: input.sentAt,
        items: totals.items
      };
      invoices.set(invoice.id, invoice);
      return invoice;
    },
    updateInvoice: (id: string, input: UpdateInvoiceInput, qrPaymentCode?: string) => {
      const existing = invoices.get(id);
      if (!existing) return undefined;
      let updatedItems = existing.items;
      let subtotalCents = existing.subtotalCents;
      let vatCents = existing.vatCents;
      let totalCents = existing.totalCents;

      if (input.items) {
        const totals = calculateInvoiceTotals(input.items);
        updatedItems = totals.items;
        subtotalCents = totals.subtotalCents;
        vatCents = totals.vatCents;
        totalCents = totals.totalCents;
      }

      const updated: Invoice = {
        ...existing,
        ...input,
        qrPaymentCode: qrPaymentCode ?? existing.qrPaymentCode,
        items: updatedItems,
        subtotalCents,
        vatCents,
        totalCents
      };

      invoices.set(id, updated);
      return updated;
    },
    deleteInvoice: (id: string) => invoices.delete(id),
    listPayments: () => Array.from(payments.values()),
    getPayment: (id: string) => payments.get(id),
    createPayment: (input: Omit<Payment, "id" | "createdAt" | "matchedInvoiceId">) => {
      const payment: Payment = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...input
      };
      payments.set(payment.id, payment);
      return payment;
    },
    matchPaymentsToInvoices: () => {
      const matched: Array<{ paymentId: string; invoiceId: string }> = [];
      payments.forEach((payment) => {
        if (payment.matchedInvoiceId || !payment.variableSymbol) {
          return;
        }
        const invoice = Array.from(invoices.values()).find(
          (entry) =>
            entry.invoiceNumber === payment.variableSymbol &&
            entry.totalCents === payment.amountCents &&
            entry.currency === payment.currency &&
            entry.status !== "paid"
        );
        if (!invoice) {
          return;
        }
        const updatedInvoice: Invoice = { ...invoice, status: "paid" };
        invoices.set(invoice.id, updatedInvoice);
        payments.set(payment.id, { ...payment, matchedInvoiceId: invoice.id });
        matched.push({ paymentId: payment.id, invoiceId: invoice.id });
      });
      return matched;
    },
    manualMatchPayment: (paymentId: string, invoiceId: string) => {
      const payment = payments.get(paymentId);
      const invoice = invoices.get(invoiceId);
      if (!payment || !invoice) {
        return undefined;
      }
      const updatedInvoice: Invoice = { ...invoice, status: "paid" };
      invoices.set(invoice.id, updatedInvoice);
      payments.set(payment.id, { ...payment, matchedInvoiceId: invoice.id });
      return { paymentId, invoiceId };
    }
  };
};

export type Store = ReturnType<typeof createStore>;
