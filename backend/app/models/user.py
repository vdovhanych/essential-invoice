from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.orm import relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="user")
    invoice_sequence_start = Column(Integer, nullable=False, default=1)
    invoice_sequence_padding = Column(Integer, nullable=False, default=4)
    secondary_email_mode = Column(String(8), nullable=False, default="cc")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    clients = relationship("Client", back_populates="user")
    invoices = relationship("Invoice", back_populates="user")
    payments = relationship("Payment", back_populates="user")
    email_logs = relationship("EmailLog", back_populates="user")
    payment_notifications = relationship("PaymentNotification", back_populates="user")
