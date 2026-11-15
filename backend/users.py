from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


def mask_phone(phone: str) -> str:
    return phone[:2] + "******" + phone[-2:]


def to_search_out(user: models.User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "phone_masked": mask_phone(user.phone),
        "user_code": user.user_code,
    }


@router.get("/search", response_model=list[schemas.UserSearchOut])
def search_users(
    q: str = Query(min_length=2, max_length=50),
    db: Session = Depends(get_db),
    me: models.User = Depends(get_current_user),
):
    q = q.strip()
    query = db.query(models.User).filter(models.User.id != me.id)

    if q.isdigit():
        # A phone number must be typed in full, so nobody can browse numbers.
        if len(q) != 10:
            return []
        query = query.filter(models.User.phone == q)
    else:
        query = query.filter(models.User.name.contains(q, autoescape=True))

    users = query.order_by(models.User.name).limit(10).all()
    return [to_search_out(u) for u in users]


@router.get("/by-code/{code}", response_model=schemas.UserSearchOut)
def user_by_code(
    code: str,
    db: Session = Depends(get_db),
    me: models.User = Depends(get_current_user),
):
    code = code.strip()
    if code.lower().startswith("minipay:"):
        code = code[len("minipay:"):]
    code = code.upper()

    user = db.query(models.User).filter(models.User.user_code == code).first()
    if not user:
        raise HTTPException(status_code=404, detail="No MiniPay user found for this QR code")
    if user.id == me.id:
        raise HTTPException(status_code=400, detail="This is your own QR code")
    return to_search_out(user)