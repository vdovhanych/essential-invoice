from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, func

from app.db.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="CZK")
    variable_symbol = Column(String(32))
    sender = Column(String(255))
    message = Column(String(255))
    transaction_code = Column(String(64))
    booked_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
