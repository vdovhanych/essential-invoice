from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.invoice import Invoice
from app.models.payment_notification import PaymentNotification
from app.models.user import User
from app.schemas.dashboard import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardSummary)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummary:
    invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id)
    total_invoices = invoices.count()
    totals_by_status = (
        db.query(Invoice.status, func.count(Invoice.id))
        .filter(Invoice.user_id == current_user.id)
        .group_by(Invoice.status)
        .all()
    )
    totals_map = {status: count for status, count in totals_by_status}
    open_notifications = (
        db.query(func.count(PaymentNotification.id))
        .filter(PaymentNotification.user_id == current_user.id)
        .filter(PaymentNotification.status == "open")
        .scalar()
        or 0
    )
    total_outstanding = (
        db.query(func.coalesce(func.sum(Invoice.total), 0))
        .filter(Invoice.user_id == current_user.id)
        .filter(Invoice.status != "Paid")
        .scalar()
    )
    return DashboardSummary(
        total_invoices=total_invoices,
        total_outstanding=float(total_outstanding or 0),
        by_status=totals_map,
        open_payment_notifications=int(open_notifications),
    )
