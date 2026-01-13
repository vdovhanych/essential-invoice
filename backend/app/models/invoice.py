from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.base import Base


class InvoiceStatus(str, Enum):
    DRAFT = "Draft"
    SENT = "Sent"
    PAID = "Paid"
    OVERDUE = "Overdue"
    CANCELLED = "Cancelled"


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (UniqueConstraint("user_id", "invoice_number", name="uq_invoice_number_user"),)

    id = Column(Integer, primary_key=True)
    invoice_number = Column(String(32), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    status = Column(String(20), nullable=False, default=InvoiceStatus.DRAFT)
    currency = Column(String(3), nullable=False, default="CZK")
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    payment_terms = Column(String(255))
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    tax = Column(Numeric(12, 2), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)
    qr_payment_code = Column(String(512))
    sent_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    client = relationship("Client")
    user = relationship("User", back_populates="invoices")
    items = relationship("InvoiceItem", cascade="all, delete-orphan", back_populates="invoice")

    @property
    def client_name(self) -> str:
        if self.client:
            return self.client.company_name
        return ""
