import PDFDocument from "pdfkit";
import type { Client, Invoice } from "./store.js";

const formatCents = (value: number) => (value / 100).toFixed(2);

export const createInvoicePdf = async (
  invoice: Invoice,
  client: Client,
  qrCode?: Buffer,
  issuer?: {
    name?: string;
    address?: string;
    ico?: string;
    dic?: string;
    bankAccount?: string;
  }
): Promise<Buffer> => {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    doc.fontSize(20).text(`Invoice ${invoice.invoiceNumber}`, { align: "left" });
    doc.moveDown();

    if (issuer?.name) {
      doc.fontSize(12).text(`Supplier: ${issuer.name}`);
      if (issuer.address) doc.text(issuer.address);
      if (issuer.ico) doc.text(`IČO: ${issuer.ico}`);
      if (issuer.dic) doc.text(`DIČ: ${issuer.dic}`);
      if (issuer.bankAccount) doc.text(`Bank account: ${issuer.bankAccount}`);
      doc.moveDown();
    }

    doc.fontSize(12).text(`Client: ${client.companyName}`);
    doc.text(`Primary email: ${client.primaryEmail}`);
    if (client.secondaryEmail) doc.text(`Secondary email: ${client.secondaryEmail}`);
    if (client.address) doc.text(`Address: ${client.address}`);
    if (client.ico) doc.text(`IČO: ${client.ico}`);
    if (client.dic) doc.text(`DIČ: ${client.dic}`);
    doc.moveDown();

    doc.text(`Issue date: ${invoice.issueDate}`);
    doc.text(`Due date: ${invoice.dueDate}`);
    doc.text(`Status: ${invoice.status}`);
    doc.text(`Currency: ${invoice.currency}`);
    if (invoice.paymentTerms) doc.text(`Payment terms: ${invoice.paymentTerms}`);
    doc.moveDown();

    doc.fontSize(12).text("Items", { underline: true });
    doc.moveDown(0.5);

    invoice.items.forEach((item) => {
      doc
        .fontSize(10)
        .text(
          `${item.description} | Qty: ${item.quantity} | Unit: ${formatCents(
            item.unitPriceCents
          )} | Total: ${formatCents(item.lineTotalCents)}`
        );
    });

    doc.moveDown();
    doc.fontSize(12).text(`Subtotal: ${formatCents(invoice.subtotalCents)} ${invoice.currency}`);
    doc.text(`VAT: ${formatCents(invoice.vatCents)} ${invoice.currency}`);
    doc.text(`Total: ${formatCents(invoice.totalCents)} ${invoice.currency}`);

    if (qrCode) {
      doc.image(qrCode, doc.page.width - 170, 50, { width: 120 });
      doc.fontSize(8).text("QR platba", doc.page.width - 170, 175, { width: 120, align: "center" });
    }

    doc.end();
  });
};
