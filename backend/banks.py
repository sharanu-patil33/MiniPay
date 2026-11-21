from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/banks", tags=["banks"])


@router.get("", response_model=list[schemas.BankOut])
def list_banks(db: Session = Depends(get_db)):
    return (
        db.query(models.Bank)
        .filter(models.Bank.is_active.is_(True))
        .order_by(models.Bank.name)
        .all()
    )