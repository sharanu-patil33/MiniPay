import models


def bank_name_of(db, bank_id):
    if bank_id is None:
        return None
    bank = db.get(models.Bank, bank_id)
    return bank.name if bank else None


def staff_out(db, staff: models.Staff) -> dict:
    return {
        "id": staff.id,
        "name": staff.name,
        "username": staff.username,
        "role": staff.role,
        "is_active": staff.is_active,
        "bank_id": staff.bank_id,
        "bank_name": bank_name_of(db, staff.bank_id),
        "created_at": staff.created_at,
    }