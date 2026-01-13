from datetime import date
from typing import Optional

from pydantic import BaseModel


class PaymentIngest(BaseModel):
    amount: float
    currency: str = "CZK"
    variable_symbol: Optional[str] = None
    sender: Optional[str] = None
    message: Optional[str] = None
    transaction_code: Optional[str] = None
    booked_date: Optional[date] = None


class PaymentRead(PaymentIngest):
    id: int
    invoice_id: Optional[int] = None

    class Config:
        from_attributes = True
