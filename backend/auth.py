
import base64
import io

import qrcode
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import (
    create_access_token,
    generate_unique_user_code,
    get_current_staff,
    get_current_user,
    hash_password,
    verify_password,
)
from serializers import bank_name_of, staff_out

router = APIRouter(prefix="/auth", tags=["auth"])

BAD_LOGIN = "Invalid username/phone number or password"


@router.post("/signup", response_model=schemas.TokenOut, status_code=201)
def signup(data: schemas.SignupRequest, db: Session = Depends(get_db)):
    bank = db.get(models.Bank, data.bank_id)
    if not bank or not bank.is_active:
        raise HTTPException(status_code=400, detail="Please choose a valid bank")

    existing = db.query(models.User).filter(models.User.phone == data.phone).first()
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    user = models.User(
        name=data.name.strip(),
        phone=data.phone,
        password_hash=hash_password(data.password),
        user_code=generate_unique_user_code(db),
        bank_id=bank.id,
    )

    db.add(user)
    db.flush()
    db.add(models.Account(user_id=user.id))
    db.commit()
    db.refresh(user)

    return {
        "access_token": create_access_token(user.id, "USER"),
        "token_type": "bearer",
        "role": "USER",
        "name": user.name,
        "bank_name": bank.name,
        "user": user,
    }


@router.post("/login", response_model=schemas.TokenOut)
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    """One login for everyone: digits = customer phone number, anything else = staff username."""

    identifier = data.identifier.strip()

    if identifier.isdigit():
        user = db.query(models.User).filter(
            models.User.phone == identifier
        ).first()

        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=401, detail=BAD_LOGIN)

        return {
            "access_token": create_access_token(user.id, "USER"),
            "token_type": "bearer",
            "role": "USER",
            "name": user.name,
            "bank_name": bank_name_of(db, user.bank_id),
            "user": user,
        }

    staff = db.query(models.Staff).filter(
        models.Staff.username == identifier
    ).first()

    if (
        not staff
        or not staff.is_active
        or not verify_password(data.password, staff.password_hash)
    ):
        raise HTTPException(status_code=401, detail=BAD_LOGIN)

    return {
        "access_token": create_access_token(staff.id, staff.role),
        "token_type": "bearer",
        "role": staff.role,
        "name": staff.name,
        "bank_name": bank_name_of(db, staff.bank_id),
        "user": None,
    }


@router.get("/me", response_model=schemas.MeOut)
def me(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "user_code": user.user_code,
        "bank_name": bank_name_of(db, user.bank_id),
        "balance": float(user.account.balance),
    }


@router.get("/me/qr", response_model=schemas.QrOut)
def my_qr(user: models.User = Depends(get_current_user)):
    payload = f"minipay:{user.user_code}"

    img = qrcode.make(payload)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")

    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return {
        "user_code": user.user_code,
        "qr_payload": payload,
        "qr_image": f"data:image/png;base64,{encoded}",
    }


@router.get("/staff/me", response_model=schemas.StaffOut)
def staff_me(
    staff: models.Staff = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    return staff_out(db, staff)


@router.post("/staff/change-password")
def staff_change_password(
    data: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    staff: models.Staff = Depends(get_current_staff),
):
    if not verify_password(data.current_password, staff.password_hash):
        raise HTTPException(
            status_code=400,
            detail="Current password is wrong",
        )

    staff.password_hash = hash_password(data.new_password)
    db.commit()

    return {"message": "Password changed"}
