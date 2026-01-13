from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.client import Client
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.user import User
from app.schemas.invoice import InvoiceCreate, InvoiceRead
from app.services.pdf import render_invoice_pdf
from app.utils.qr import build_spayd

router = APIRouter(prefix="/invoices", tags=["invoices"])


def next_invoice_number(db: Session, user: User) -> str:
    year = date.today().year
    count = (
        db.query(func.count(Invoice.id))
        .filter(Invoice.user_id == user.id)
        .filter(Invoice.invoice_number.like(f"{year}%"))
        .scalar()
        or 0
    )
    next_number = count + user.invoice_sequence_start
    padding = user.invoice_sequence_padding
    return f"{year}{next_number:0{padding}d}"


@router.post("", response_model=InvoiceRead)
def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoiceRead:
    client = (
        db.query(Client)
        .filter(Client.id == payload.client_id)
        .filter(Client.user_id == current_user.id)
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    invoice_number = next_invoice_number(db, current_user)
    subtotal = sum(Decimal(str(item.total)) for item in payload.items)
    tax = Decimal("0.00")
    total = subtotal + tax

    invoice = Invoice(
        invoice_number=invoice_number,
        user_id=current_user.id,
        client_id=payload.client_id,
        currency=payload.currency,
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        payment_terms=payload.payment_terms,
        subtotal=subtotal,
        tax=tax,
        total=total,
        qr_payment_code=build_spayd(
            account="",
            amount=total,
            currency=payload.currency,
            variable_symbol=invoice_number,
            message=f"Invoice {invoice_number}",
        )
        if payload.currency == "CZK"
        else None,
    )
    db.add(invoice)
    db.flush()

    for item in payload.items:
        db_item = InvoiceItem(
            invoice_id=invoice.id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total=item.total,
        )
        db.add(db_item)

    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("", response_model=list[InvoiceRead])
def list_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InvoiceRead]:
    return (
        db.query(Invoice)
        .filter(Invoice.user_id == current_user.id)
        .order_by(Invoice.created_at.desc())
        .all()
    )


@router.get("/{invoice_id}", response_model=InvoiceRead)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoiceRead:
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .filter(Invoice.user_id == current_user.id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.get("/{invoice_id}/pdf")
def get_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .filter(Invoice.user_id == current_user.id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    pdf_bytes = render_invoice_pdf(invoice)
    headers = {"Content-Disposition": f'inline; filename="invoice-{invoice.invoice_number}.pdf"'}
    return StreamingResponse(iter([pdf_bytes]), media_type="application/pdf", headers=headers)
