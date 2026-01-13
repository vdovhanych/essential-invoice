from datetime import datetime

from pydantic import BaseModel


class PaymentNotificationRead(BaseModel):
    id: int
    payment_id: int
    reason: str
    status: str
    created_at: datetime
    resolved_at: datetime | None = None

    class Config:
        from_attributes = True
