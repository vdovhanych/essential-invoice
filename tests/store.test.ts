import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals, createStore } from "../src/store.js";

describe("store calculations", () => {
  it("calculates invoice totals with VAT", () => {
    const totals = calculateInvoiceTotals([
      { description: "Service A", quantity: 1, unitPriceCents: 10000, vatRate: 21 },
      { description: "Service B", quantity: 2, unitPriceCents: 2500 }
    ]);

    expect(totals.subtotalCents).toBe(15000);
    expect(totals.vatCents).toBe(2100);
    expect(totals.totalCents).toBe(17100);
    expect(totals.items).toHaveLength(2);
  });
});

describe("store payments", () => {
  it("matches payments to invoices by variable symbol", () => {
    const store = createStore();
    const client = store.createClient({
      companyName: "Acme Corp",
      primaryEmail: "billing@acme.test"
    });
    const invoice = store.createInvoice({
      clientId: client.id,
      invoiceNumber: "INV-001",
      status: "sent",
      currency: "CZK",
      issueDate: "2024-01-01",
      dueDate: "2024-01-15",
      items: [
        {
          description: "Design",
          quantity: 1,
          unitPriceCents: 20000,
          vatRate: 21
        }
      ]
    });

    const payment = store.createPayment({
      amountCents: invoice.totalCents,
      currency: "CZK",
      variableSymbol: "INV-001",
      description: "Bank transfer",
      receivedAt: "2024-01-10",
      source: "bank"
    });

    const matched = store.matchPaymentsToInvoices();
    expect(matched).toEqual([{ paymentId: payment.id, invoiceId: invoice.id }]);
    expect(store.getInvoice(invoice.id)?.status).toBe("paid");
    expect(store.getPayment(payment.id)?.matchedInvoiceId).toBe(invoice.id);
  });

  it("allows manual matches when automatic fails", () => {
    const store = createStore();
    const client = store.createClient({
      companyName: "Beta LLC",
      primaryEmail: "finance@beta.test"
    });
    const invoice = store.createInvoice({
      clientId: client.id,
      invoiceNumber: "INV-002",
      status: "sent",
      currency: "CZK",
      issueDate: "2024-01-05",
      dueDate: "2024-01-20",
      items: [
        {
          description: "Hosting",
          quantity: 3,
          unitPriceCents: 3000
        }
      ]
    });

    const payment = store.createPayment({
      amountCents: invoice.totalCents,
      currency: "CZK",
      receivedAt: "2024-01-12",
      source: "bank"
    });

    const manual = store.manualMatchPayment(payment.id, invoice.id);
    expect(manual).toEqual({ paymentId: payment.id, invoiceId: invoice.id });
    expect(store.getInvoice(invoice.id)?.status).toBe("paid");
  });
});
