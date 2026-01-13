from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class UserRead(UserBase):
    id: int
    role: str
    invoice_sequence_start: int
    invoice_sequence_padding: int
    secondary_email_mode: Literal["cc", "bcc"]

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    invoice_sequence_start: Optional[int] = Field(default=None, ge=1)
    invoice_sequence_padding: Optional[int] = Field(default=None, ge=1, le=6)
    secondary_email_mode: Optional[Literal["cc", "bcc"]] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
