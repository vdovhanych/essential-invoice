from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.payment import Payment


def match_payment(db: Session, payment: Payment) -> Invoice | None:
    if payment.variable_symbol:
        invoice = (
            db.query(Invoice)
            .filter(Invoice.invoice_number == payment.variable_symbol)
            .filter(Invoice.user_id == payment.user_id)
            .first()
        )
        if invoice:
            return invoice

    return None
