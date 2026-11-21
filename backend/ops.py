from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from payments import checks_for
from security import get_current_staff
from serializers import bank_name_of

router = APIRouter(prefix="/ops", tags=["operations"])


def scoped(query, staff: models.Staff):
    """Admin sees everything. An ops member sees their bank's cases that are theirs or unassigned."""
    if staff.role == "ADMIN":
        return query
    return query.filter(
        models.FraudCase.bank_id == staff.bank_id,
        or_(
            models.FraudCase.assigned_to == staff.id,
            models.FraudCase.assigned_to.is_(None),
        ),
    )


def case_out(db: Session, case: models.FraudCase, txn: models.Transaction, with_checks: bool) -> dict:
    sender = db.get(models.User, txn.sender_id)
    receiver = db.get(models.User, txn.receiver_id)
    assignee = db.get(models.Staff, case.assigned_to) if case.assigned_to else None
    return {
        "case_id": case.id,
        "transaction_id": txn.id,
        "amount": float(txn.amount),
        "sender_name": sender.name,
        "receiver_name": receiver.name,
        "bank_name": bank_name_of(db, case.bank_id),
        "case_status": case.status,
        "txn_status": txn.status,
        "decision": txn.decision,
        "risk_score": txn.risk_score,
        "reason": case.reason,
        "assigned_to": assignee.name if assignee else None,
        "created_at": case.created_at,
        "checks": checks_for(db, txn.id) if with_checks else [],
    }


@router.get("/cases", response_model=list[schemas.CaseOut])
def list_cases(
    status: str | None = Query(default=None, max_length=20),
    db: Session = Depends(get_db),
    staff: models.Staff = Depends(get_current_staff),
):
    query = db.query(models.FraudCase, models.Transaction).join(
        models.Transaction, models.Transaction.id == models.FraudCase.transaction_id
    )
    query = scoped(query, staff)
    if status:
        query = query.filter(models.FraudCase.status == status.upper())

    rows = query.order_by(models.FraudCase.id.desc()).limit(100).all()
    return [case_out(db, case, txn, with_checks=False) for case, txn in rows]


@router.get("/cases/{case_id}", response_model=schemas.CaseOut)
def case_detail(
    case_id: int,
    db: Session = Depends(get_db),
    staff: models.Staff = Depends(get_current_staff),
):
    query = (
        db.query(models.FraudCase, models.Transaction)
        .join(models.Transaction, models.Transaction.id == models.FraudCase.transaction_id)
        .filter(models.FraudCase.id == case_id)
    )
    row = scoped(query, staff).first()
    if not row:
        raise HTTPException(status_code=404, detail="Case not found")
    case, txn = row
    return case_out(db, case, txn, with_checks=True)