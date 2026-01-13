from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.schemas.invoice import InvoiceCreate, InvoiceRead
from app.utils.qr import build_spayd

router = APIRouter(prefix="/invoices", tags=["invoices"])


def next_invoice_number(db: Session) -> str:
    year = date.today().year
    count = db.query(func.count(Invoice.id)).filter(Invoice.invoice_number.like(f"{year}%")).scalar() or 0
    return f"{year}{count + 1:04d}"


@router.post("", response_model=InvoiceRead)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)) -> InvoiceRead:
    invoice_number = next_invoice_number(db)
    subtotal = sum(Decimal(str(item.total)) for item in payload.items)
    tax = Decimal("0.00")
    total = subtotal + tax

    invoice = Invoice(
        invoice_number=invoice_number,
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
def list_invoices(db: Session = Depends(get_db)) -> list[InvoiceRead]:
    return db.query(Invoice).order_by(Invoice.created_at.desc()).all()


@router.get("/{invoice_id}", response_model=InvoiceRead)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)) -> InvoiceRead:
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice
