
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session

from database import get_db, engine, Base
import models  # noqa: F401  (registers the tables)
from auth import router as auth_router
from banks import router as banks_router
from users import router as users_router
from payments import router as payments_router
from admin import router as admin_router
from ops import router as ops_router
from seed import seed_admin, seed_banks


# Create tables that do not already exist.
Base.metadata.create_all(bind=engine)
seed_banks()
seed_admin()


# Add the payment PIN column to existing databases if it is missing.
inspector = inspect(engine)
user_columns = {
    column["name"] for column in inspector.get_columns("users")
}

if "pin_hash" not in user_columns:
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN pin_hash VARCHAR(255) NULL")
        )


app = FastAPI(title="MiniPay - UPI Fraud Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(banks_router)
app.include_router(users_router)
app.include_router(payments_router)
app.include_router(admin_router)
app.include_router(ops_router)


@app.get("/")
def root():
    return {"message": "MiniPay API is running"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
