import nodemailer from "nodemailer";
import type { AppConfig } from "./config.js";
import type { Client, Invoice } from "./store.js";

export const sendInvoiceEmail = async (params: {
  config: AppConfig;
  invoice: Invoice;
  client: Client;
  pdf: Buffer;
}) => {
  const { config, invoice, client, pdf } = params;

  if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
    throw new Error("SMTP configuration is missing");
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword
    }
  });

  const toRecipients = [client.primaryEmail, client.secondaryEmail].filter(Boolean) as string[];
  const fromAddress = config.adminEmail || config.smtpUser;

  return transporter.sendMail({
    from: fromAddress,
    to: toRecipients,
    subject: `Invoice ${invoice.invoiceNumber}`,
    text: `Hello ${client.companyName},\n\nPlease find invoice ${invoice.invoiceNumber} attached.\n`,
    attachments: [
      {
        filename: `invoice-${invoice.invoiceNumber}.pdf`,
        content: pdf
      }
    ]
  });
};
