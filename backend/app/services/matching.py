from datetime import timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.payment import Payment


def match_payment(db: Session, payment: Payment) -> Invoice | None:
    if payment.variable_symbol:
        invoice = db.query(Invoice).filter(Invoice.invoice_number == payment.variable_symbol).first()
        if invoice:
            return invoice

    if payment.booked_date and payment.amount:
        start = payment.booked_date - timedelta(days=3)
        end = payment.booked_date + timedelta(days=3)
        return (
            db.query(Invoice)
            .filter(Invoice.total == Decimal(payment.amount))
            .filter(Invoice.issue_date.between(start, end))
            .first()
        )
    return None
