from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])

MESSAGES = {
    "COMPLETED": "Payment successful",
    "FAILED": "Payment failed: insufficient balance",
    "BLOCKED": "Payment blocked by fraud checks",
}


def add_event(db: Session, txn_id: int, event_type: str, details: str = ""):
    db.add(models.TransactionEvent(transaction_id=txn_id, event_type=event_type, details=details))


def build_response(db: Session, txn: models.Transaction) -> dict:
    receiver = db.get(models.User, txn.receiver_id)
    sender_acc = (
        db.query(models.Account).filter(models.Account.user_id == txn.sender_id).first()
    )
    return {
        "transaction_id": txn.id,
        "status": txn.status,
        "decision": txn.decision,
        "amount": float(txn.amount),
        "receiver_name": receiver.name,
        "current_balance": float(sender_acc.balance),
        "message": MESSAGES.get(txn.status, txn.status),
        "created_at": txn.created_at,
    }


@router.post("", response_model=schemas.PaymentOut)
def send_money(
    data: schemas.PaymentRequest,
    request: Request,
    db: Session = Depends(get_db),
    me: models.User = Depends(get_current_user),
):
    # 1. Idempotency: the same key always returns the same result, never a second payment.
    existing = (
        db.query(models.Transaction)
        .filter(models.Transaction.idempotency_key == data.idempotency_key)
        .first()
    )
    if existing:
        if existing.sender_id != me.id:
            raise HTTPException(status_code=409, detail="Request key already used")
        return build_response(db, existing)

    # 2. Basic validation
    if data.receiver_id == me.id:
        raise HTTPException(status_code=400, detail="You cannot send money to yourself")
    receiver = db.get(models.User, data.receiver_id)
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    # 3. Create the transaction record
    txn = models.Transaction(
        idempotency_key=data.idempotency_key,
        sender_id=me.id,
        receiver_id=receiver.id,
        amount=data.amount,
        note=data.note,
        status="INITIATED",
        ip_address=request.client.host if request.client else None,
    )
    db.add(txn)
    try:
        db.flush()
    except IntegrityError:
        # Two identical requests arrived at the same moment; return the first one.
        db.rollback()
        existing = (
            db.query(models.Transaction)
            .filter(models.Transaction.idempotency_key == data.idempotency_key)
            .first()
        )
        if existing and existing.sender_id == me.id:
            return build_response(db, existing)
        raise HTTPException(status_code=409, detail="Request key already used")

    add_event(db, txn.id, "INITIATED", f"amount={data.amount}")

    # 4. Lock both accounts (always in id order, so two payments cannot deadlock)
    ids = sorted([me.id, receiver.id])
    accounts = (
        db.query(models.Account)
        .filter(models.Account.user_id.in_(ids))
        .order_by(models.Account.user_id)
        .with_for_update()
        .all()
    )
    by_user = {a.user_id: a for a in accounts}
    sender_acc = by_user[me.id]
    receiver_acc = by_user[receiver.id]

    # 5. Balance check
    if sender_acc.balance < data.amount:
        txn.status = "FAILED"
        add_event(db, txn.id, "FAILED", "Insufficient balance")
        db.commit()
        db.refresh(txn)
        return build_response(db, txn)

    txn.status = "VALIDATED"
    add_event(db, txn.id, "VALIDATED", "Receiver and balance verified")

    # ---------------------------------------------------------------
    # Step 7 will add the 6 fraud checks here (before any money moves).
    # If the decision is BLOCK: set status "BLOCKED", create a FraudCase,
    # commit and return without touching the balances.
    # ---------------------------------------------------------------

    # 6. Move the money
    sender_acc.balance = sender_acc.balance - data.amount
    txn.status = "DEBIT_CONFIRMED"
    add_event(db, txn.id, "DEBIT_CONFIRMED", "Sender debited")

    receiver_acc.balance = receiver_acc.balance + data.amount
    txn.status = "COMPLETED"
    add_event(db, txn.id, "COMPLETED", "Receiver credited")

    db.commit()
    db.refresh(txn)
    return build_response(db, txn)


@router.get("/history", response_model=list[schemas.TransactionOut])
def history(
    db: Session = Depends(get_db),
    me: models.User = Depends(get_current_user),
):
    rows = (
        db.query(models.Transaction)
        .filter(or_(models.Transaction.sender_id == me.id, models.Transaction.receiver_id == me.id))
        .order_by(models.Transaction.id.desc())
        .limit(50)
        .all()
    )

    other_ids = {t.receiver_id if t.sender_id == me.id else t.sender_id for t in rows}
    names = {}
    if other_ids:
        names = {u.id: u.name for u in db.query(models.User).filter(models.User.id.in_(other_ids))}

    result = []
    for t in rows:
        sent = t.sender_id == me.id
        other_id = t.receiver_id if sent else t.sender_id
        result.append(
            {
                "id": t.id,
                "direction": "sent" if sent else "received",
                "other_party": names.get(other_id, "Unknown"),
                "amount": float(t.amount),
                "status": t.status,
                "note": t.note,
                "created_at": t.created_at,
            }
        )
    return result