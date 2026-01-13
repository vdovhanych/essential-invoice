from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.payment_notification import PaymentNotification
from app.models.user import User
from app.schemas.notification import PaymentNotificationRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[PaymentNotificationRead])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PaymentNotificationRead]:
    return (
        db.query(PaymentNotification)
        .filter(PaymentNotification.user_id == current_user.id)
        .order_by(PaymentNotification.created_at.desc())
        .all()
    )


@router.post("/{notification_id}/resolve", response_model=PaymentNotificationRead)
def resolve_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentNotificationRead:
    notification = (
        db.query(PaymentNotification)
        .filter(PaymentNotification.id == notification_id)
        .filter(PaymentNotification.user_id == current_user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.status = "resolved"
    notification.resolved_at = datetime.utcnow()
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification
