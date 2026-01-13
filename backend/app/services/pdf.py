from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.models.invoice import Invoice


def render_invoice_pdf(invoice: Invoice) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle(f"Invoice {invoice.invoice_number}")

    pdf.drawString(40, 800, f"Invoice: {invoice.invoice_number}")
    pdf.drawString(40, 780, f"Client: {invoice.client.company_name}")
    pdf.drawString(40, 760, f"Total: {invoice.total} {invoice.currency}")

    y = 720
    for item in invoice.items:
        pdf.drawString(40, y, f"{item.description} - {item.quantity} x {item.unit_price}")
        y -= 20

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer.read()
