import Fastify from "fastify";
import jwt from "@fastify/jwt";
import QRCode from "qrcode";
import type { AppConfig } from "./config.js";
import {
  calculateInvoiceTotals,
  type CreateInvoiceInput,
  type Store
} from "./store.js";
import { createInvoicePdf } from "./pdf.js";
import { sendInvoiceEmail } from "./email.js";
import { pollBankInbox } from "./imap.js";

const formatAmount = (cents: number) => (cents / 100).toFixed(2);

export const buildQrPaymentCode = (params: {
  bankAccount: string;
  amountCents: number;
  variableSymbol: string;
  message: string;
  currency: string;
}) => {
  if (!params.bankAccount || params.currency !== "CZK") {
    return undefined;
  }
  return `SPD*1.0*ACC:${params.bankAccount}*AM:${formatAmount(
    params.amountCents
  )}*CC:${params.currency}*X-VS:${params.variableSymbol}*MSG:${params.message}`;
};

type CreateAppOptions = {
  config: AppConfig;
  store: Store;
  startImapPolling?: boolean;
};

export const createApp = ({ config, store, startImapPolling = true }: CreateAppOptions) => {
  const app = Fastify({ logger: true });

  app.register(jwt, {
    secret: config.jwtSecret
  });

  app.decorate("authenticate", async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/config", async () => ({
    port: config.port,
    bankType: config.bankType,
    imapPollIntervalMinutes: config.imapPollIntervalMinutes
  }));

  app.post("/auth/login", async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    if (body?.email === config.adminEmail && body?.password === config.adminPassword) {
      const token = app.jwt.sign({ sub: body.email });
      return { token };
    }
    reply.code(401);
    return { error: "Invalid credentials" };
  });

  app.post("/auth/logout", async () => ({ status: "ok" }));

  app.post("/auth/refresh", async (request, reply) => {
    try {
      await (request as any).jwtVerify();
      const token = app.jwt.sign({ sub: (request as any).user.sub });
      return { token };
    } catch (err) {
      reply.code(401);
      return { error: "Invalid token" };
    }
  });

  app.get(
    "/clients",
    { preHandler: (app as any).authenticate },
    async () => store.listClients()
  );

  app.post(
    "/clients",
    { preHandler: (app as any).authenticate },
    async (request, reply) => {
      const body = request.body as any;
      if (!body?.companyName || !body?.primaryEmail) {
        reply.code(400);
        return { error: "companyName and primaryEmail are required" };
      }
      return store.createClient(body);
    }
  );

  app.get(
    "/clients/:id",
    { preHandler: (app as any).authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const client = store.getClient(id);
      if (!client) {
        reply.code(404);
        return { error: "Client not found" };
      }
      return client;
    }
  );

  app.patch(
    "/clients/:id",
    { preHandler: (app as any).authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const updated = store.updateClient(id, request.body as any);
      if (!updated) {
        reply.code(404);
        return { error: "Client not found" };
      }
      return updated;
    }
  );

  app.delete(
    "/clients/:id",
    { preHandler: (app as any).authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = store.deleteClient(id);
      if (!deleted) {
        reply.code(404);
        return { error: "Client not found" };
      }
      return { status: "deleted" };
    }
  );

  app.get(
    "/clients/:id/invoices",
    { preHandler: (app as any).authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const client = store.getClient(id);
      if (!client) {
        reply.code(404);
        return { error: "Client not found" };
      }
      return store.listInvoicesByClient(id);
    }
  );

  app.get(
    "/invoices",
    { preHandler: (app as any).authenticate },
    async () => store.listInvoices()
  );

  app.post(
    "/invoices",
    { preHandler: (app as any).authenticate },
    async (request, reply) => {
      const body = request.body as Partial<CreateInvoiceInput>;
      if (!body?.clientId || !body?.invoiceNumber || !body?.issueDate || !body?.dueDate) {
        reply.code(400);
        return { error: "clientId, invoiceNumber, issueDate, and dueDate are required" };
      }
      if (!store.getClient(body.clientId)) {
        reply.code(404);
        return { error: "Client not found" };
      }
      if (!body.items?.length) {
        reply.code(400);
        return { error: "Invoice items are required" };
      }

      const invoiceInput: CreateInvoiceInput = {
        clientId: body.clientId,
        invoiceNumber: body.invoiceNumber,
        status: body.status ?? "draft",
        currency: body.currency ?? "CZK",
        issueDate: body.issueDate,
        dueDate: body.dueDate,
        paymentTerms: body.paymentTerms,
        sentAt: body.sentAt,
        items: body.items
      };

      const totals = calculateInvoiceTotals(invoiceInput.items);
      const qrPaymentCode = buildQrPaymentCode({
        bankAccount: config.bankAccount,
        amountCents: totals.totalCents,
        variableSymbol: body.invoiceNumber,
        message: `Invoice ${body.invoiceNumber}`,
        currency: invoiceInput.currency
      });

      return store.createInvoice(invoiceInput, qrPaymentCode);
    }
  );

  app.get(
    "/invoices/:id",
    { preHandler: (app as any).authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const invoice = store.getInvoice(id);
      if (!invoice) {
        reply.code(404);
        return { error: "Invoice not found" };
      }
      return invoice;
    }
  );

  app.patch(
    "/invoices/:id",
    { preHandler: (app as any).authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const existing = store.getInvoice(id);
      if (!existing) {
        reply.code(404);
        return { error: "Invoice not found" };
      }

      const totals = body?.items ? calculateInvoiceTotals(body.items) : undefined;
      const qrPaymentCode = buildQrPaymentCode({
        bankAccount: config.bankAccount,
        amountCents: totals?.totalCents ?? existing.totalCents,
        variableSymbol: existing.invoiceNumber,
        message: `Invoice ${existing.invoiceNumber}`,
        currency: existing.currency
      });

      const updated = store.updateInvoice(id, body, qrPaymentCode);
      if (!updated) {
        reply.code(404);
        return { error: "Invoice not found" };
      }
      return updated;
    }
  );

  app.delete(
    "/invoices/:id",
    { preHandler: (app as any).authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = store.deleteInvoice(id);
      if (!deleted) {
        reply.code(404);
        return { error: "Invoice not found" };
      }
      return { status: "deleted" };
    }
  );

  app.post(
    "/invoices/:id/send",
    { preHandler: (app as any).authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const invoice = store.getInvoice(id);
      if (!invoice) {
        reply.code(404);
        return { error: "Invoice not found" };
      }
      const client = store.getClient(invoice.clientId);
      if (!client) {
        reply.code(404);
        return { error: "Client not found" };
      }

      const qrBuffer = invoice.qrPaymentCode
        ? await QRCode.toBuffer(invoice.qrPaymentCode)
        : undefined;

      const pdf = await createInvoicePdf(invoice, client, qrBuffer, {
        name: config.issuerName || undefined,
        address: config.issuerAddress || undefined,
        ico: config.issuerIco || undefined,
        dic: config.issuerDic || undefined,
        bankAccount: config.bankAccount || undefined
      });

      try {
        await sendInvoiceEmail({ config, invoice, client, pdf });
      } catch (error) {
        reply.code(500);
        return { error: (error as Error).message };
      }

      store.updateInvoice(invoice.id, { sentAt: new Date().toISOString() });
      return { status: "sent" };
    }
  );

  app.get(
    "/invoices/:id/pdf",
    { preHandler: (app as any).authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const invoice = store.getInvoice(id);
      if (!invoice) {
        reply.code(404);
        return { error: "Invoice not found" };
      }
      const client = store.getClient(invoice.clientId);
      if (!client) {
        reply.code(404);
        return { error: "Client not found" };
      }

      const qrBuffer = invoice.qrPaymentCode
        ? await QRCode.toBuffer(invoice.qrPaymentCode)
        : undefined;

      const pdf = await createInvoicePdf(invoice, client, qrBuffer, {
        name: config.issuerName || undefined,
        address: config.issuerAddress || undefined,
        ico: config.issuerIco || undefined,
        dic: config.issuerDic || undefined,
        bankAccount: config.bankAccount || undefined
      });

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `inline; filename=invoice-${invoice.invoiceNumber}.pdf`);
      return reply.send(pdf);
    }
  );

  app.get(
    "/payments",
    { preHandler: (app as any).authenticate },
    async () => store.listPayments()
  );

  app.post(
    "/payments/match",
    { preHandler: (app as any).authenticate },
    async () => ({ matched: store.matchPaymentsToInvoices() })
  );

  app.post(
    "/payments/manual-match",
    { preHandler: (app as any).authenticate },
    async (request, reply) => {
      const body = request.body as { paymentId?: string; invoiceId?: string };
      if (!body?.paymentId || !body?.invoiceId) {
        reply.code(400);
        return { error: "paymentId and invoiceId are required" };
      }
      const matched = store.manualMatchPayment(body.paymentId, body.invoiceId);
      if (!matched) {
        reply.code(404);
        return { error: "Payment or invoice not found" };
      }
      return matched;
    }
  );

  app.get(
    "/dashboard/summary",
    { preHandler: (app as any).authenticate },
    async () => {
      const invoices = store.listInvoices();
      const clients = store.listClients();
      const totalOutstandingCents = invoices
        .filter((invoice) => invoice.status !== "paid")
        .reduce((sum, invoice) => sum + invoice.totalCents, 0);
      return {
        clients: clients.length,
        invoices: invoices.length,
        outstandingCents: totalOutstandingCents,
        outstanding: formatAmount(totalOutstandingCents)
      };
    }
  );

  if (startImapPolling && config.imapHost && config.imapUser && config.imapPassword) {
    const poll = async () => {
      try {
        await pollBankInbox(config, store);
        store.matchPaymentsToInvoices();
      } catch (error) {
        app.log.error({ error }, "IMAP poll failed");
      }
    };
    poll();
    setInterval(poll, config.imapPollIntervalMinutes * 60_000);
  }

  return app;
};
