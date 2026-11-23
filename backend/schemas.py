
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=r"^\d{10}$")
    password: str = Field(min_length=6, max_length=64)
    pin: str = Field(pattern=r"^(\d{4}|\d{6})$")


class LoginRequest(BaseModel):
    phone: str = Field(pattern=r"^\d{10}$")
    password: str = Field(min_length=1, max_length=64)


class SetPinRequest(BaseModel):
    pin: str = Field(pattern=r"^(\d{4}|\d{6})$")


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
    qr_image: str


class UserSearchOut(BaseModel):
    id: int
    name: str
    phone_masked: str
    user_code: str


class PaymentRequest(BaseModel):
    receiver_id: int
    amount: Decimal = Field(gt=0, le=100000, max_digits=12, decimal_places=2)
    pin: str = Field(pattern=r"^(\d{4}|\d{6})$")
    note: str | None = Field(default=None, max_length=255)
    idempotency_key: str = Field(min_length=8, max_length=64)
    device_id: str | None = Field(default=None, max_length=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def location_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Send both latitude and longitude, or neither")
        return self


class CheckOut(BaseModel):
    check_name: str
    score: float
    reason: str | None
    thread_name: str | None
    duration_ms: int | None


class PaymentOut(BaseModel):
    transaction_id: int
    status: str
    decision: str | None
    risk_score: float | None
    amount: float
    receiver_name: str
    current_balance: float
    message: str
    created_at: datetime
    checks: list[CheckOut] = []


class TransactionOut(BaseModel):
    id: int
    direction: str
    other_party: str
    amount: float
    status: str
    note: str | None
    created_at: datetime


class FlaggedOut(BaseModel):
    transaction_id: int
    amount: float
    receiver_name: str
    status: str
    decision: str | None
    risk_score: float | None
    reason: str | None
    case_status: str
    created_at: datetime
    checks: list[CheckOut] = []


class AlertOut(BaseModel):
    id: int
    transaction_id: int
    role: str
    message: str
    created_at: datetime
