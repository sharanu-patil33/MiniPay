import math
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from sqlalchemy import func

import models
from database import SessionLocal

# ---------------------------------------------------------------
# Settings (change these to tune the engine)
# ---------------------------------------------------------------
WEIGHTS = {
    "amount": 0.20,
    "location": 0.15,
    "velocity": 0.20,
    "behavior": 0.15,
    "merchant": 0.15,
    "device_ip": 0.15,
}
REVIEW_THRESHOLD = 35   # final score >= 35 -> REVIEW
BLOCK_THRESHOLD = 60    # final score >= 60 -> BLOCK
WORST_CHECK_FACTOR = 0.7  # final = max(weighted average, 0.7 * worst single check)
FAILED_CHECK_SCORE = 50   # score used if a check crashes

LOOPBACK_IPS = {None, "", "127.0.0.1", "::1", "localhost"}

T = models.Transaction


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def clamp(value: float) -> float:
    return max(0.0, min(100.0, float(value)))


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def parse_location(text):
    try:
        lat, lon = text.split(",")
        return float(lat), float(lon)
    except Exception:
        return None


# ---------------------------------------------------------------
# The six checks. Each returns (score 0-100, reason).
# Each one gets its own database session (sessions are not thread-safe).
# ---------------------------------------------------------------
def check_amount(ctx, db):
    amount = float(ctx["amount"])
    balance = float(ctx["balance"])

    if amount <= 1000:
        score = 0
    elif amount <= 5000:
        score = 10
    elif amount <= 20000:
        score = 30
    elif amount <= 50000:
        score = 50
    else:
        score = 70
    reasons = [f"amount Rs {amount:,.0f}"]

    count, avg = (
        db.query(func.count(T.id), func.avg(T.amount))
        .filter(T.sender_id == ctx["sender_id"], T.status == "COMPLETED")
        .one()
    )
    if count >= 3 and avg:
        ratio = amount / float(avg)
        if ratio > 10:
            score += 40
            reasons.append(f"{ratio:.0f}x the sender's average payment")
        elif ratio > 5:
            score += 25
            reasons.append(f"{ratio:.0f}x the sender's average payment")

    if balance > 0 and amount >= 0.9 * balance:
        score += 15
        reasons.append("uses over 90% of the balance")

    return clamp(score), "; ".join(reasons)


def check_location(ctx, db):
    lat, lon = ctx["latitude"], ctx["longitude"]
    if lat is None or lon is None:
        return 25, "Location not shared, cannot verify"

    prev = (
        db.query(T)
        .filter(
            T.sender_id == ctx["sender_id"],
            T.status == "COMPLETED",
            T.location.isnot(None),
            T.id != ctx["txn_id"],
        )
        .order_by(T.id.desc())
        .first()
    )
    if not prev:
        return 5, "First payment with a known location"

    prev_loc = parse_location(prev.location)
    if not prev_loc:
        return 5, "Previous location unreadable"

    dist = haversine_km(lat, lon, prev_loc[0], prev_loc[1])
    seconds = max((ctx["now"] - prev.created_at).total_seconds(), 1)
    hours = seconds / 3600
    speed = dist / hours

    if dist >= 100 and speed > 900:
        return 90, f"Impossible travel: {dist:.0f} km in {seconds / 60:.0f} min"
    if dist >= 500 and hours <= 24:
        return 60, f"{dist:.0f} km from the last payment within 24 hours"
    if dist >= 50:
        return 15, f"{dist:.0f} km from the last payment location"
    return 5, f"Close to the last payment location ({dist:.0f} km)"


def check_velocity(ctx, db):
    now = ctx["now"]
    sid = ctx["sender_id"]

    def attempts_since(delta):
        return (
            db.query(func.count(T.id))
            .filter(T.sender_id == sid, T.id != ctx["txn_id"], T.created_at >= now - delta)
            .scalar()
        )

    c1 = attempts_since(timedelta(minutes=1))
    c5 = attempts_since(timedelta(minutes=5))
    c60 = attempts_since(timedelta(hours=1))

    if c1 >= 2:
        score, why = 80, "3 or more payments within 1 minute"
    elif c5 >= 4:
        score, why = 70, "5 or more payments within 5 minutes"
    elif c60 >= 9:
        score, why = 60, "10 or more payments within 1 hour"
    elif c5 >= 2:
        score, why = 30, "3 payments within 5 minutes"
    elif c60 >= 3:
        score, why = 15, "4 payments within 1 hour"
    else:
        score, why = 0, "Normal payment frequency"

    total = (
        db.query(func.coalesce(func.sum(T.amount), 0))
        .filter(
            T.sender_id == sid,
            T.id != ctx["txn_id"],
            T.created_at >= now - timedelta(hours=1),
            T.status == "COMPLETED",
        )
        .scalar()
    )
    if float(total) + float(ctx["amount"]) > 50000:
        score += 30
        why += "; over Rs 50,000 sent in the last hour"

    return clamp(score), f"{why} (previous attempts: {c1} in 1 min, {c5} in 5 min, {c60} in 1 h)"


def check_merchant(ctx, db):
    now = ctx["now"]
    rid, sid = ctx["receiver_id"], ctx["sender_id"]
    amount = float(ctx["amount"])
    score = 0
    reasons = []

    receiver = db.get(models.User, rid)
    age_hours = (now - receiver.created_at).total_seconds() / 3600
    if age_hours < 24:
        score += 30
        reasons.append("receiver account is less than 1 day old")

    blocked = (
        db.query(func.count(T.id))
        .filter(T.receiver_id == rid, T.status == "BLOCKED", T.id != ctx["txn_id"])
        .scalar()
    )
    if blocked:
        score += min(60, 30 * blocked)
        reasons.append(f"receiver was the target of {blocked} blocked payment(s)")

    senders = (
        db.query(func.count(func.distinct(T.sender_id)))
        .filter(T.receiver_id == rid, T.created_at >= now - timedelta(hours=1))
        .scalar()
    )
    if senders >= 5:
        score += 40
        reasons.append(f"{senders} different senders paid this receiver in the last hour")

    paid_before = (
        db.query(T.id)
        .filter(T.sender_id == sid, T.receiver_id == rid, T.status == "COMPLETED")
        .first()
    )
    if not paid_before:
        if amount > 10000:
            score += 25
            reasons.append("first payment to this receiver and the amount is large")
        else:
            score += 5
            reasons.append("first payment to this receiver")

    return clamp(score), "; ".join(reasons) or "Known receiver, no warning signs"


def check_behavior(ctx, db):
    now = ctx["now"]
    sid, rid = ctx["sender_id"], ctx["receiver_id"]
    amount = float(ctx["amount"])
    score = 0
    reasons = []

    sender = db.get(models.User, sid)
    age_minutes = (now - sender.created_at).total_seconds() / 60

    if age_minutes < 24 * 60 and amount > 5000:
        score += 35
        reasons.append("new account (under 1 day) making a large payment")
    if age_minutes < 5:
        score += 20
        reasons.append("payment within 5 minutes of signing up")

    ist_hour = (now + timedelta(hours=5, minutes=30)).hour
    if 0 <= ist_hour < 5:
        score += 20
        reasons.append("payment at an unusual hour (midnight to 5 am IST)")

    duplicate = (
        db.query(T.id)
        .filter(
            T.sender_id == sid,
            T.receiver_id == rid,
            T.amount == ctx["amount"],
            T.id != ctx["txn_id"],
            T.created_at >= now - timedelta(minutes=10),
        )
        .first()
    )
    if duplicate:
        score += 40
        reasons.append("same amount sent to the same receiver within 10 minutes")

    return clamp(score), "; ".join(reasons) or "Normal behavior"


def check_device_ip(ctx, db):
    now = ctx["now"]
    sid = ctx["sender_id"]
    device = ctx["device_id"]
    ip = ctx["ip_address"]
    score = 0
    reasons = []

    has_history = (
        db.query(T.id)
        .filter(T.sender_id == sid, T.status == "COMPLETED", T.id != ctx["txn_id"])
        .first()
        is not None
    )

    if not device:
        score += 20
        reasons.append("no device id sent")
    else:
        if has_history:
            seen = (
                db.query(T.id)
                .filter(
                    T.sender_id == sid,
                    T.device_id == device,
                    T.status == "COMPLETED",
                    T.id != ctx["txn_id"],
                )
                .first()
            )
            if not seen:
                score += 40
                reasons.append("new device for this user")

        others = (
            db.query(func.count(func.distinct(T.sender_id)))
            .filter(
                T.device_id == device,
                T.sender_id != sid,
                T.created_at >= now - timedelta(hours=1),
            )
            .scalar()
        )
        if others >= 2:
            score += 70
            reasons.append(f"device used by {others} other accounts in the last hour")
        elif others == 1:
            score += 25
            reasons.append("device also used by another account in the last hour")

    if ip not in LOOPBACK_IPS:
        if has_history:
            seen_ip = (
                db.query(T.id)
                .filter(
                    T.sender_id == sid,
                    T.ip_address == ip,
                    T.status == "COMPLETED",
                    T.id != ctx["txn_id"],
                )
                .first()
            )
            if not seen_ip:
                score += 20
                reasons.append("new IP address for this user")

        ip_others = (
            db.query(func.count(func.distinct(T.sender_id)))
            .filter(
                T.ip_address == ip,
                T.sender_id != sid,
                T.created_at >= now - timedelta(hours=1),
            )
            .scalar()
        )
        if ip_others >= 3:
            score += 50
            reasons.append(f"IP used by {ip_others} other accounts in the last hour")

    return clamp(score), "; ".join(reasons) or "Known device and IP"


CHECKS = {
    "amount": check_amount,
    "location": check_location,
    "velocity": check_velocity,
    "behavior": check_behavior,
    "merchant": check_merchant,
    "device_ip": check_device_ip,
}


def _run_check(name, fn, ctx):
    started = utcnow()
    db = SessionLocal()
    try:
        score, reason = fn(ctx, db)
    except Exception as exc:  # a crashed check counts as medium risk, never as "safe"
        score = FAILED_CHECK_SCORE
        reason = f"Check could not run ({type(exc).__name__}); treated as medium risk"
    finally:
        db.close()
    ended = utcnow()
    return {
        "check_name": name,
        "score": float(score),
        "reason": reason[:255],
        "thread_name": threading.current_thread().name,
        "started_at": started,
        "ended_at": ended,
    }


def decide(final_score: float) -> str:
    if final_score >= BLOCK_THRESHOLD:
        return "BLOCK"
    if final_score >= REVIEW_THRESHOLD:
        return "REVIEW"
    return "APPROVE"


def run_fraud_checks(ctx: dict) -> dict:
    """Run all six checks at the same time and combine them into one decision."""
    ctx = dict(ctx)
    ctx["now"] = utcnow()

    with ThreadPoolExecutor(max_workers=len(CHECKS), thread_name_prefix="fraud-check") as pool:
        futures = [pool.submit(_run_check, name, fn, ctx) for name, fn in CHECKS.items()]
        results = [f.result() for f in futures]

    weighted = sum(r["score"] * WEIGHTS[r["check_name"]] for r in results)
    worst = max(r["score"] for r in results)
    final_score = round(max(weighted, WORST_CHECK_FACTOR * worst), 1)
    decision = decide(final_score)

    risky = [f"{r['check_name']}={r['score']:.0f}" for r in results if r["score"] >= 40]
    summary = ", ".join(risky) if risky else "no high-risk signals"

    return {
        "results": results,
        "final_score": final_score,
        "decision": decision,
        "summary": summary,
    }