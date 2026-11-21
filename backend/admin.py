from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import generate_unique_user_code, hash_password, require_admin
from serializers import staff_out

# Every route in this file needs an admin token.
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def active_bank_or_400(db: Session, bank_id: int) -> models.Bank:
    bank = db.get(models.Bank, bank_id)
    if not bank or not bank.is_active:
        raise HTTPException(status_code=400, detail="Choose a valid, active bank")
    return bank


def user_admin_out(user: models.User, balance, bank_name) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "user_code": user.user_code,
        "bank_name": bank_name,
        "balance": float(balance or 0),
        "created_at": user.created_at,
    }


@router.get("/overview", response_model=schemas.OverviewOut)
def overview(db: Session = Depends(get_db)):
    return {
        "banks": db.query(func.count(models.Bank.id)).scalar(),
        "users": db.query(func.count(models.User.id)).scalar(),
        "ops_members": db.query(func.count(models.Staff.id))
        .filter(models.Staff.role == "OPS")
        .scalar(),
        "transactions": db.query(func.count(models.Transaction.id)).scalar(),
        "flagged_cases": db.query(func.count(models.FraudCase.id)).scalar(),
        "open_cases": db.query(func.count(models.FraudCase.id))
        .filter(models.FraudCase.status == "OPEN")
        .scalar(),
    }


# ---------------- Banks ----------------
@router.get("/banks", response_model=list[schemas.BankAdminOut])
def list_banks(db: Session = Depends(get_db)):
    banks = db.query(models.Bank).order_by(models.Bank.name).all()
    user_counts = dict(
        db.query(models.User.bank_id, func.count(models.User.id))
        .group_by(models.User.bank_id)
        .all()
    )
    ops_counts = dict(
        db.query(models.Staff.bank_id, func.count(models.Staff.id))
        .filter(models.Staff.role == "OPS")
        .group_by(models.Staff.bank_id)
        .all()
    )
    return [
        {
            "id": b.id,
            "name": b.name,
            "code": b.code,
            "is_active": b.is_active,
            "users": user_counts.get(b.id, 0),
            "ops_members": ops_counts.get(b.id, 0),
        }
        for b in banks
    ]


@router.post("/banks", response_model=schemas.BankOut, status_code=201)
def create_bank(data: schemas.BankCreate, db: Session = Depends(get_db)):
    clash = (
        db.query(models.Bank)
        .filter((models.Bank.name == data.name.strip()) | (models.Bank.code == data.code))
        .first()
    )
    if clash:
        raise HTTPException(status_code=400, detail="A bank with this name or code already exists")

    bank = models.Bank(name=data.name.strip(), code=data.code)
    db.add(bank)
    db.commit()
    db.refresh(bank)
    return bank


@router.patch("/banks/{bank_id}", response_model=schemas.BankOut)
def set_bank_active(bank_id: int, data: schemas.BankUpdate, db: Session = Depends(get_db)):
    bank = db.get(models.Bank, bank_id)
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    # An inactive bank cannot be chosen at signup or for new ops members.
    # Its existing users and ops members keep working.
    bank.is_active = data.is_active
    db.commit()
    db.refresh(bank)
    return bank


# ---------------- Bank operations team ----------------
@router.get("/staff", response_model=list[schemas.StaffOut])
def list_staff(bank_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Staff)
    if bank_id is not None:
        query = query.filter(models.Staff.bank_id == bank_id)
    return [staff_out(db, s) for s in query.order_by(models.Staff.id).all()]


@router.post("/staff", response_model=schemas.StaffOut, status_code=201)
def create_staff(
    data: schemas.StaffCreate,
    db: Session = Depends(get_db),
    admin: models.Staff = Depends(require_admin),
):
    bank = active_bank_or_400(db, data.bank_id)

    taken = db.query(models.Staff).filter(models.Staff.username == data.username).first()
    if taken:
        raise HTTPException(status_code=400, detail="Username already taken")

    member = models.Staff(
        name=data.name.strip(),
        username=data.username,
        password_hash=hash_password(data.password),
        role="OPS",
        bank_id=bank.id,
        created_by=admin.id,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return staff_out(db, member)


def get_ops_member(db: Session, staff_id: int) -> models.Staff:
    member = db.get(models.Staff, staff_id)
    if not member:
        raise HTTPException(status_code=404, detail="Staff member not found")
    if member.role != "OPS":
        raise HTTPException(status_code=400, detail="Admin accounts cannot be changed here")
    return member


@router.patch("/staff/{staff_id}", response_model=schemas.StaffOut)
def set_staff_active(
    staff_id: int,
    data: schemas.StaffUpdate,
    db: Session = Depends(get_db),
):
    member = get_ops_member(db, staff_id)
    member.is_active = data.is_active
    db.commit()
    db.refresh(member)
    return staff_out(db, member)


@router.post("/staff/{staff_id}/reset-password")
def reset_staff_password(
    staff_id: int,
    data: schemas.StaffPasswordReset,
    db: Session = Depends(get_db),
):
    member = get_ops_member(db, staff_id)
    member.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": f"Password reset for {member.username}"}


# ---------------- Users ----------------
@router.get("/users", response_model=list[schemas.UserAdminOut])
def list_users(db: Session = Depends(get_db)):
    rows = (
        db.query(models.User, models.Account.balance, models.Bank.name)
        .outerjoin(models.Account, models.Account.user_id == models.User.id)
        .outerjoin(models.Bank, models.Bank.id == models.User.bank_id)
        .order_by(models.User.id)
        .all()
    )
    return [user_admin_out(u, balance, bank_name) for u, balance, bank_name in rows]


@router.post("/users", response_model=schemas.UserAdminOut, status_code=201)
def create_user(data: schemas.SignupRequest, db: Session = Depends(get_db)):
    bank = active_bank_or_400(db, data.bank_id)

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
    account = models.Account(user_id=user.id)
    db.add(account)
    db.commit()
    db.refresh(user)
    db.refresh(account)
    return user_admin_out(user, account.balance, bank.name)


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    data: schemas.PasswordReset,
    db: Session = Depends(get_db),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": f"Password reset for {user.name}"}