from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import (
    check_pin_or_raise,
    get_current_user,
    hash_password,
    pin_locked_seconds,
    verify_password,
)
from serializers import bank_name_of

router = APIRouter(prefix="/pin", tags=["pin"])


@router.get("/status", response_model=schemas.PinStatusOut)
def pin_status(user: models.User = Depends(get_current_user)):
    return {"has_pin": bool(user.pin_hash), "locked_seconds": pin_locked_seconds(user)}


@router.post("/set")
def set_pin(
    data: schemas.PinSet,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Set a new PIN, or replace the old one. Needs the login password, so a forgotten PIN can be reset."""
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect password")

    user.pin_hash = hash_password(data.pin)
    user.pin_failed_attempts = 0
    user.pin_locked_until = None
    db.commit()
    return {"message": "PIN saved"}


@router.post("/balance", response_model=schemas.BalanceOut)
def balance(
    data: schemas.PinVerify,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """The balance is only shown when the PIN is correct."""
    check_pin_or_raise(db, user, data.pin)
    return {
        "balance": float(user.account.balance),
        "bank_name": bank_name_of(db, user.bank_id),
    }