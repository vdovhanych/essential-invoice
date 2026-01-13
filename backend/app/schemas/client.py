from typing import Optional

from pydantic import BaseModel, EmailStr


class ClientBase(BaseModel):
    company_name: str
    primary_email: EmailStr
    secondary_email: Optional[EmailStr] = None
    address: Optional[str] = None
    ico: Optional[str] = None
    dic: Optional[str] = None
    contact_person: Optional[str] = None


class ClientCreate(ClientBase):
    pass


class ClientRead(ClientBase):
    id: int

    class Config:
        from_attributes = True
