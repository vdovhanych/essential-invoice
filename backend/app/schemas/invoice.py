from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class InvoiceItemBase(BaseModel):
    description: str
    quantity: float
    unit_price: float
    total: float


class InvoiceItemCreate(InvoiceItemBase):
    pass


class InvoiceItemRead(InvoiceItemBase):
    id: int

    class Config:
        from_attributes = True


class InvoiceBase(BaseModel):
    client_id: int
    currency: str
    issue_date: date
    due_date: date
    payment_terms: Optional[str] = None


class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate]


class InvoiceRead(InvoiceBase):
    id: int
    invoice_number: str
    status: str
    subtotal: float
    tax: float
    total: float
    qr_payment_code: Optional[str] = None
    items: List[InvoiceItemRead]

    class Config:
        from_attributes = True
