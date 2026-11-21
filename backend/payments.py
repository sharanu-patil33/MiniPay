import random

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from fraud_engine import run_fraud_checks, utcnow
from security import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])

MESSAGES = {
    "COMPLETED": "Payment successful",
    "FAILED": "Payment failed: insufficient balance",
    "BLOCKED": "Payment blocked by fraud checks",
}


def add_event(db: Session, txn_id: int, event_type: str, details: str = ""):
    db.add(models.TransactionEvent(transaction_id=txn_id, event_type=event_type, details=details))


def pick_ops_member(db: Session, bank_id):
    """Pick one active ops member of this bank at random (None if the bank has no active member)."""
    if bank_id is None:
        return None
    members = (
        db.query(models.Staff)
        .filter(
            models.Staff.role == "OPS",
            models.Staff.is_active.is_(True),
            models.Staff.bank_id == bank_id,
        )
        .all()
    )
    return random.choice(members) if members else None


def open_case(db: Session, txn: models.Transaction, sender: models.User, decision: str, summary: str):
    """Create the flagged case for the sender's bank and give it to a random ops member."""
    member = pick_ops_member(db, sender.bank_id)
    db.add(
        models.FraudCase(
            transaction_id=txn.id,
            reason=f"{decision}: {summary}"[:255],
            status="OPEN",
            bank_id=sender.bank_id,
            assigned_to=member.id if member else None,
            assigned_at=utcnow() if member else None,
        )
    )
    return member


def checks_for(db: Session, txn_id: int) -> list[dict]:
    rows = (
        db.query(models.RiskResult)
        .filter(models.RiskResult.transaction_id == txn_id)
        .order_by(models.RiskResult.id)
        .all()
    )
    out = []
    for r in rows:
        duration = None
        if r.started_at and r.ended_at:
            duration = int((r.ended_at - r.started_at).total_seconds() * 1000)
        out.append(
            {
                "check_name": r.check_name,
                "score": r.score,
                "reason": r.reason,
                "thread_name": r.thread_name,
                "duration_ms": duration,
            }
        )
    return out


def build_response(db: Session, txn: models.Transaction) -> dict:
    receiver = db.get(models.User, txn.receiver_id)
    sender_acc = (
        db.query(models.Account).filter(models.Account.user_id == txn.sender_id).first()
    )
    return {
        "transaction_id": txn.id,
        "status": txn.status,
        "decision": txn.decision,
        "risk_score": txn.risk_score,
        "amount": float(txn.amount),
        "receiver_name": receiver.name,
        "current_balance": float(sender_acc.balance),
        "message": MESSAGES.get(txn.status, txn.status),
        "created_at": txn.created_at,
        "checks": checks_for(db, txn.id),
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
    location = None
    if data.latitude is not None and data.longitude is not None:
        location = f"{data.latitude:.5f},{data.longitude:.5f}"

    txn = models.Transaction(
        idempotency_key=data.idempotency_key,
        sender_id=me.id,
        receiver_id=receiver.id,
        amount=data.amount,
        note=data.note,
        status="INITIATED",
        ip_address=request.client.host if request.client else None,
        location=location,
        device_id=data.device_id,
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

    # 6. Fraud assessment: six checks run at the same time, before any money moves
    ctx = {
        "txn_id": txn.id,
        "sender_id": me.id,
        "receiver_id": receiver.id,
        "amount": data.amount,
        "balance": sender_acc.balance,
        "ip_address": txn.ip_address,
        "device_id": data.device_id,
        "latitude": data.latitude,
        "longitude": data.longitude,
    }
    outcome = run_fraud_checks(ctx)

    txn.status = "FRAUD_ASSESSMENT"
    for r in outcome["results"]:
        db.add(
            models.RiskResult(
                transaction_id=txn.id,
                check_name=r["check_name"],
                score=r["score"],
                reason=r["reason"],
                thread_name=r["thread_name"],
                started_at=r["started_at"],
                ended_at=r["ended_at"],
            )
        )
    txn.risk_score = outcome["final_score"]
    txn.decision = outcome["decision"]
    add_event(
        db,
        txn.id,
        "FRAUD_ASSESSMENT",
        f"decision={outcome['decision']}, score={outcome['final_score']}, {outcome['summary']}",
    )

    if outcome["decision"] == "BLOCK":
        # Flagged transaction: no money moves, and the sender's bank team gets the case
        txn.status = "BLOCKED"
        member = open_case(db, txn, me, "BLOCK", outcome["summary"])
        db.add(
            models.Alert(
                transaction_id=txn.id,
                user_id=me.id,
                role="sender",
                message=f"Your payment of Rs {data.amount} to {receiver.name} was blocked by fraud checks."[:255],
            )
        )
        assigned = f"assigned to {member.name}" if member else "waiting for an operations member"
        db.add(
            models.Alert(
                transaction_id=txn.id,
                user_id=None,
                role="ops",
                message=f"Flagged transaction #{txn.id}: BLOCK, risk score {outcome['final_score']}, {assigned}"[:255],
            )
        )
        add_event(
            db,
            txn.id,
            "BLOCKED",
            f"Blocked by fraud checks, no money moved; case {assigned}",
        )
        db.commit()
        db.refresh(txn)
        return build_response(db, txn)

    if outcome["decision"] == "REVIEW":
        # Payment goes through, but a case is opened for the sender's bank team
        member = open_case(db, txn, me, "REVIEW", outcome["summary"])
        assigned = f"assigned to {member.name}" if member else "waiting for an operations member"
        db.add(
            models.Alert(
                transaction_id=txn.id,
                user_id=None,
                role="ops",
                message=f"Transaction #{txn.id} needs review, risk score {outcome['final_score']}, {assigned}"[:255],
            )
        )

    # 7. Move the money
    sender_acc.balance = sender_acc.balance - data.amount
    txn.status = "DEBIT_CONFIRMED"
    add_event(db, txn.id, "DEBIT_CONFIRMED", "Sender debited")

    receiver_acc.balance = receiver_acc.balance + data.amount
    txn.status = "COMPLETED"
    add_event(db, txn.id, "COMPLETED", "Receiver credited")

    db.commit()
    db.refresh(txn)
    return build_response(db, txn)


# Fixed paths must come before "/{transaction_id}"
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


@router.get("/flagged", response_model=list[schemas.FlaggedOut])
def flagged(
    db: Session = Depends(get_db),
    me: models.User = Depends(get_current_user),
):
    rows = (
        db.query(models.FraudCase, models.Transaction)
        .join(models.Transaction, models.Transaction.id == models.FraudCase.transaction_id)
        .filter(models.Transaction.sender_id == me.id)
        .order_by(models.FraudCase.id.desc())
        .limit(50)
        .all()
    )

    result = []
    for case, txn in rows:
        receiver = db.get(models.User, txn.receiver_id)
        result.append(
            {
                "transaction_id": txn.id,
                "amount": float(txn.amount),
                "receiver_name": receiver.name,
                "status": txn.status,
                "decision": txn.decision,
                "risk_score": txn.risk_score,
                "reason": case.reason,
                "case_status": case.status,
                "created_at": txn.created_at,
                "checks": checks_for(db, txn.id),
            }
        )
    return result


@router.get("/alerts", response_model=list[schemas.AlertOut])
def my_alerts(
    db: Session = Depends(get_db),
    me: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Alert)
        .filter(models.Alert.user_id == me.id)
        .order_by(models.Alert.id.desc())
        .limit(50)
        .all()
    )


@router.get("/{transaction_id}", response_model=schemas.PaymentOut)
def payment_detail(
    transaction_id: int,
    db: Session = Depends(get_db),
    me: models.User = Depends(get_current_user),
):
    txn = db.get(models.Transaction, transaction_id)
    if not txn or txn.sender_id != me.id:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return build_response(db, txn)