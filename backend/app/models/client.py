from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.db.base import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    company_name = Column(String(255), nullable=False)
    primary_email = Column(String(255), nullable=False)
    secondary_email = Column(String(255))
    address = Column(String(255))
    ico = Column(String(32))
    dic = Column(String(32))
    contact_person = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="clients")
