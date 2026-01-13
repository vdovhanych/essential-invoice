import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";
import type { AppConfig } from "../src/config.js";

describe("app routes", () => {
  let app: ReturnType<typeof createApp>;
  const config: AppConfig = {
    port: 3000,
    databaseUrl: "postgres://invoice:invoice@db:5432/invoice",
    jwtSecret: "change-me",
    adminEmail: "admin@example.com",
    adminPassword: "change-me",
    issuerName: "",
    issuerAddress: "",
    issuerIco: "",
    issuerDic: "",
    bankAccount: "123456789/0100",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    imapHost: "",
    imapPort: 993,
    imapUser: "",
    imapPassword: "",
    imapPollIntervalMinutes: 5,
    bankEmailSenderPattern: "noreply@airbank.cz",
    bankType: "airbank"
  };

  beforeEach(async () => {
    app = createApp({ config, store: createStore(), startImapPolling: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns health status", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("authenticates and creates a client invoice", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: config.adminEmail, password: config.adminPassword }
    });

    expect(login.statusCode).toBe(200);
    const token = login.json().token as string;
    expect(token).toBeTruthy();

    const clientResponse = await app.inject({
      method: "POST",
      url: "/clients",
      headers: { authorization: `Bearer ${token}` },
      payload: { companyName: "Acme Corp", primaryEmail: "billing@acme.test" }
    });

    expect(clientResponse.statusCode).toBe(200);
    const client = clientResponse.json();
    expect(client.companyName).toBe("Acme Corp");

    const invoiceResponse = await app.inject({
      method: "POST",
      url: "/invoices",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        clientId: client.id,
        invoiceNumber: "2024-001",
        issueDate: "2024-01-01",
        dueDate: "2024-01-15",
        items: [
          {
            description: "Consulting",
            quantity: 2,
            unitPriceCents: 5000,
            vatRate: 21
          }
        ]
      }
    });

    expect(invoiceResponse.statusCode).toBe(200);
    const invoice = invoiceResponse.json();
    expect(invoice.totalCents).toBe(12100);
    expect(invoice.qrPaymentCode).toContain("SPD*1.0*ACC:123456789/0100");
  });
});
