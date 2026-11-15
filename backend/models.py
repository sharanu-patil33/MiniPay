from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Numeric, Float, DateTime, ForeignKey, Text
)
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(15), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    user_code = Column(String(20), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("Account", back_populates="user", uselist=False)


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    balance = Column(Numeric(12, 2), nullable=False, default=10000)  # simulated money

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
    decision = Column(String(10))          # APPROVE / REVIEW / BLOCK
    risk_score = Column(Float)
    ip_address = Column(String(45))
    location = Column(String(100))
    device_id = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    risk_results = relationship("RiskResult", back_populates="transaction")


class RiskResult(Base):
    """One row per fraud check (6 rows per transaction)."""
    __tablename__ = "risk_results"

    id = Column(Integer, primary_key=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False, index=True)
    check_name = Column(String(30), nullable=False)  # amount, location, velocity, behavior, merchant, device_ip
    score = Column(Float, nullable=False)
    reason = Column(String(255))
    thread_name = Column(String(100))
    started_at = Column(DATETIME(fsp=6))   # microsecond precision
    ended_at = Column(DATETIME(fsp=6))

    transaction = relationship("Transaction", back_populates="risk_results")


class TransactionEvent(Base):
    """Append-only history of every state change."""
    __tablename__ = "transaction_events"

    id = Column(Integer, primary_key=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False, index=True)
    event_type = Column(String(40), nullable=False)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class FraudCase(Base):
    """A blocked or reviewed transaction becomes a flagged case."""
    __tablename__ = "fraud_cases"

    id = Column(Integer, primary_key=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), unique=True, nullable=False)
    reason = Column(String(255))
    status = Column(String(20), nullable=False, default="OPEN")
    created_at = Column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String(20), nullable=False)  # sender / receiver / ops
    message = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)