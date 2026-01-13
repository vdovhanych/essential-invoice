from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.payment import Payment
from app.models.payment_notification import PaymentNotification
from app.models.user import User
from app.schemas.payment import PaymentIngest, PaymentRead
from app.services.matching import match_payment

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/ingest", response_model=PaymentRead)
def ingest_payment(
    payload: PaymentIngest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentRead:
    payment = Payment(user_id=current_user.id, **payload.model_dump())
    db.add(payment)
    db.flush()

    matched_invoice = match_payment(db, payment)
    if matched_invoice:
        payment.invoice_id = matched_invoice.id
    elif not payment.variable_symbol:
        notification = PaymentNotification(user_id=current_user.id, payment_id=payment.id)
        db.add(notification)

    db.commit()
    db.refresh(payment)
    return payment
