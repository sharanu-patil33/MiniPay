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
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=schemas.TokenOut, status_code=201)
def signup(data: schemas.SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.phone == data.phone).first()
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    user = models.User(
        name=data.name.strip(),
        phone=data.phone,
        password_hash=hash_password(data.password),
        user_code=generate_unique_user_code(db),
    )
    db.add(user)
    db.flush()  # gives user.id before commit
    db.add(models.Account(user_id=user.id))
    db.commit()
    db.refresh(user)

    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": user,
    }


@router.post("/login", response_model=schemas.TokenOut)
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.phone == data.phone).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid phone number or password")

    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=schemas.MeOut)
def me(user: models.User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "user_code": user.user_code,
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