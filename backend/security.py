import math
import os
import secrets
import string
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import models
from database import get_db

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is missing in backend/.env")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# PIN protection settings (change these to tune it)
PIN_MAX_ATTEMPTS = 3      # wrong PINs in a row before the PIN is locked
PIN_LOCK_MINUTES = 15     # how long the lock lasts

bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(subject_id: int, role: str = "USER") -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(subject_id), "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def generate_unique_user_code(db: Session) -> str:
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "MP" + "".join(secrets.choice(alphabet) for _ in range(6))
        exists = db.query(models.User).filter(models.User.user_code == code).first()
        if not exists:
            return code


def _decode(creds: HTTPAuthorizationCredentials) -> dict:
    try:
        return jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    payload = _decode(creds)
    # Tokens made before roles existed have no "role" and belong to customers.
    if payload.get("role", "USER") != "USER":
        raise HTTPException(status_code=403, detail="Staff accounts cannot use customer features")
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_current_staff(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.Staff:
    payload = _decode(creds)
    if payload.get("role") not in ("ADMIN", "OPS"):
        raise HTTPException(status_code=403, detail="Staff access required")
    try:
        staff_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Checked in the database on every request, so a deactivated member is locked out at once.
    staff = db.get(models.Staff, staff_id)
    if not staff or not staff.is_active or staff.role != payload["role"]:
        raise HTTPException(status_code=401, detail="Account not found or deactivated")
    return staff


def require_admin(staff: models.Staff = Depends(get_current_staff)) -> models.Staff:
    if staff.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return staff


# ---------------- PIN checking ----------------
def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def pin_locked_seconds(user: models.User) -> int:
    """Seconds left on a PIN lock (0 when the PIN is not locked)."""
    if user.pin_locked_until and user.pin_locked_until > _utcnow():
        return int((user.pin_locked_until - _utcnow()).total_seconds()) + 1
    return 0


def check_pin_or_raise(db: Session, user: models.User, pin: str) -> None:
    """Verify the user's PIN, count wrong tries and lock the PIN after too many.

    428 = no PIN set yet, 423 = PIN locked, 400 = wrong PIN.
    (Never 401: the app logs people out when it sees a 401.)
    """
    # Lock the user row so two simultaneous wrong tries cannot both be counted as the first one.
    db.refresh(user, with_for_update=True)

    if not user.pin_hash:
        raise HTTPException(status_code=428, detail="Set your PIN first")

    remaining = pin_locked_seconds(user)
    if remaining > 0:
        minutes = max(1, math.ceil(remaining / 60))
        raise HTTPException(
            status_code=423,
            detail=f"PIN locked after too many wrong attempts. Try again in {minutes} minute(s).",
        )

    if not verify_password(pin, user.pin_hash):
        user.pin_failed_attempts = (user.pin_failed_attempts or 0) + 1
        if user.pin_failed_attempts >= PIN_MAX_ATTEMPTS:
            user.pin_locked_until = _utcnow() + timedelta(minutes=PIN_LOCK_MINUTES)
            user.pin_failed_attempts = 0
            db.commit()
            raise HTTPException(
                status_code=423,
                detail=f"Incorrect PIN. Too many wrong attempts, your PIN is locked for {PIN_LOCK_MINUTES} minutes.",
            )
        left = PIN_MAX_ATTEMPTS - user.pin_failed_attempts
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect PIN. {left} attempt{'s' if left != 1 else ''} left.",
        )

    # Correct PIN: clear any earlier wrong tries
    if user.pin_failed_attempts or user.pin_locked_until:
        user.pin_failed_attempts = 0
        user.pin_locked_until = None
        db.commit()