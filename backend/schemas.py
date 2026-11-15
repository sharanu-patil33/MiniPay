from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=r"^\d{10}$")
    password: str = Field(min_length=6, max_length=64)


class LoginRequest(BaseModel):
    phone: str = Field(pattern=r"^\d{10}$")
    password: str = Field(min_length=1, max_length=64)


class UserOut(BaseModel):
    id: int
    name: str
    phone: str
    user_code: str

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class MeOut(BaseModel):
    id: int
    name: str
    phone: str
    user_code: str
    balance: float


class QrOut(BaseModel):
    user_code: str
    qr_payload: str
    qr_image: str  # data URL, can be used directly as <img src="...">


class UserSearchOut(BaseModel):
    id: int
    name: str
    phone_masked: str
    user_code: str


class PaymentRequest(BaseModel):
    receiver_id: int
    amount: Decimal = Field(gt=0, le=100000, max_digits=12, decimal_places=2)
    note: str | None = Field(default=None, max_length=255)
    idempotency_key: str = Field(min_length=8, max_length=64)


class PaymentOut(BaseModel):
    transaction_id: int
    status: str
    decision: str | None
    amount: float
    receiver_name: str
    current_balance: float
    message: str
    created_at: datetime


class TransactionOut(BaseModel):
    id: int
    direction: str  # "sent" or "received"
    other_party: str
    amount: float
    status: str
    note: str | None
    created_at: datetime