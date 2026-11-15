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