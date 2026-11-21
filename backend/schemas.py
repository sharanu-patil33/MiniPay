from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=r"^\d{10}$")
    password: str = Field(min_length=6, max_length=64)
    bank_id: int


class LoginRequest(BaseModel):
    # Users type their phone number, staff type their username.
    identifier: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=15)  # old field name, still accepted
    password: str = Field(min_length=1, max_length=64)

    @model_validator(mode="after")
    def need_identifier(self):
        value = (self.identifier or self.phone or "").strip()
        if not value:
            raise ValueError("Enter your phone number or username")
        self.identifier = value
        return self


class UserOut(BaseModel):
    id: int
    name: str
    phone: str
    user_code: str

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str
    role: str = "USER"          # USER, OPS or ADMIN
    name: str | None = None
    bank_name: str | None = None
    user: UserOut | None = None  # only filled for customers


class MeOut(BaseModel):
    id: int
    name: str
    phone: str
    user_code: str
    bank_name: str | None = None
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
    direction: str  # "sent" or "received"
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


# ---------------- Banks ----------------
class BankOut(BaseModel):
    id: int
    name: str
    code: str
    is_active: bool

    model_config = {"from_attributes": True}


class BankCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    code: str = Field(min_length=2, max_length=10, pattern=r"^[A-Za-z0-9]+$")

    @field_validator("code")
    @classmethod
    def upper_code(cls, value: str) -> str:
        return value.upper()


class BankUpdate(BaseModel):
    is_active: bool


class BankAdminOut(BaseModel):
    id: int
    name: str
    code: str
    is_active: bool
    users: int
    ops_members: int


# ---------------- Staff and admin ----------------
class StaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=64)
    bank_id: int

    @field_validator("username")
    @classmethod
    def not_only_digits(cls, value: str) -> str:
        # An all-digit login is treated as a customer phone number
        if value.isdigit():
            raise ValueError("Username must contain at least one letter")
        return value


class StaffOut(BaseModel):
    id: int
    name: str
    username: str
    role: str
    is_active: bool
    bank_id: int | None = None
    bank_name: str | None = None
    created_at: datetime


class StaffUpdate(BaseModel):
    is_active: bool


class StaffPasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=64)


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=6, max_length=64)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=64)
    new_password: str = Field(min_length=8, max_length=64)


class UserAdminOut(BaseModel):
    id: int
    name: str
    phone: str
    user_code: str
    bank_name: str | None = None
    balance: float
    created_at: datetime


class OverviewOut(BaseModel):
    banks: int
    users: int
    ops_members: int
    transactions: int
    flagged_cases: int
    open_cases: int


# ---------------- Operations cases ----------------
class CaseOut(BaseModel):
    case_id: int
    transaction_id: int
    amount: float
    sender_name: str
    receiver_name: str
    bank_name: str | None
    case_status: str
    txn_status: str
    decision: str | None
    risk_score: float | None
    reason: str | None
    assigned_to: str | None
    created_at: datetime
    checks: list[CheckOut] = []