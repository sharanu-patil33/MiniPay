import os

from dotenv import load_dotenv

import models
from database import SessionLocal
from security import hash_password

load_dotenv()

DEFAULT_BANKS = [
    ("State Bank of India", "SBI"),
    ("HDFC Bank", "HDFC"),
    ("ICICI Bank", "ICICI"),
    ("Canara Bank", "CANARA"),
]


def seed_banks():
    """Create the default banks only when the banks table is empty."""
    db = SessionLocal()
    try:
        if db.query(models.Bank).first():
            return
        for name, code in DEFAULT_BANKS:
            db.add(models.Bank(name=name, code=code))
        db.commit()
        print("seed: default banks created")
    finally:
        db.close()


def seed_admin():
    """Create the first admin from .env, only if no admin exists yet."""
    username = os.getenv("ADMIN_USERNAME")
    password = os.getenv("ADMIN_PASSWORD")
    if not username or not password:
        print("seed: ADMIN_USERNAME / ADMIN_PASSWORD not set in .env, admin not created")
        return

    db = SessionLocal()
    try:
        existing = db.query(models.Staff).filter(models.Staff.role == "ADMIN").first()
        if existing:
            return
        db.add(
            models.Staff(
                name=username,
                username=username,
                password_hash=hash_password(password),
                role="ADMIN",
            )
        )
        db.commit()
        print(f"seed: admin '{username}' created")
    finally:
        db.close()