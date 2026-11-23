
from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Float,
    DateTime,
    ForeignKey,
    Text,
    Boolean,
)
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import relationship

from database import Base


class Bank(Base):
    __tablename__ = "banks"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(10), unique=True, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(15), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    pin_hash = Column(String(255), nullable=True)
    user_code = Column(String(20), unique=True, nullable=False, index=True)
    bank_id = Column(Integer, ForeignKey("banks.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("Account", back_populates="user", uselist=False)


class Staff(Base):
    """Admin and bank operations team members (they log in with a username)."""

    __tablename__ = "staff"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(10), nullable=False, default="OPS")  # ADMIN or OPS
    is_active = Column(Boolean, nullable=False, default=True)
    bank_id = Column(Integer, ForeignKey("banks.id"))
    created_by = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    balance = Column(Numeric(12, 2), nullable=False, default=10000)

    user = relationship("User", back_populates="account")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    idempotency_key = Column(String(64), unique=True, nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    note = Column(String(255))
    status = Column(String(30), nullable=False, default="INITIATED")
    decision = Column(String(10))
    risk_score = Column(Float)
    ip_address = Column(String(45))
    location = Column(String(100))
    device_id = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    risk_results = relationship("RiskResult", back_populates="transaction")


class RiskResult(Base):
    __tablename__ = "risk_results"

    id = Column(Integer, primary_key=True)
    transaction_id = Column(
        Integer,
        ForeignKey("transactions.id"),
        nullable=False,
        index=True,
    )
    check_name = Column(String(30), nullable=False)
    score = Column(Float, nullable=False)
    reason = Column(String(255))
    thread_name = Column(String(100))
    started_at = Column(DATETIME(fsp=6))
    ended_at = Column(DATETIME(fsp=6))

    transaction = relationship("Transaction", back_populates="risk_results")


class TransactionEvent(Base):
    __tablename__ = "transaction_events"

    id = Column(Integer, primary_key=True)
    transaction_id = Column(
        Integer,
        ForeignKey("transactions.id"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(40), nullable=False)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class FraudCase(Base):
    """A blocked or reviewed transaction becomes a flagged case for the sender's bank."""

    __tablename__ = "fraud_cases"

    id = Column(Integer, primary_key=True)
    transaction_id = Column(
        Integer,
        ForeignKey("transactions.id"),
        unique=True,
        nullable=False,
    )
    reason = Column(String(255))
    status = Column(String(20), nullable=False, default="OPEN")
    bank_id = Column(Integer, ForeignKey("banks.id"))
    assigned_to = Column(Integer, ForeignKey("staff.id"))
    assigned_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String(20), nullable=False)
    message = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
