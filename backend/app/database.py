import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./simba.db")

connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def ensure_runtime_schema():
    """Apply tiny compatibility fixes for local SQLite DBs created before migrations existed."""
    if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        return

    with engine.begin() as conn:
        user_columns = {
            row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()
        }
        if "verification_token_expires" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN verification_token_expires VARCHAR"))

        order_columns = {
            row[1] for row in conn.execute(text("PRAGMA table_info(orders)")).fetchall()
        }
        if "fulfillment_type" not in order_columns:
            conn.execute(text("ALTER TABLE orders ADD COLUMN fulfillment_type VARCHAR DEFAULT 'pickup'"))
        if "pickup_branch" not in order_columns:
            conn.execute(text("ALTER TABLE orders ADD COLUMN pickup_branch VARCHAR"))
        if "pickup_time" not in order_columns:
            conn.execute(text("ALTER TABLE orders ADD COLUMN pickup_time VARCHAR"))
        if "deposit_amount" not in order_columns:
            conn.execute(text("ALTER TABLE orders ADD COLUMN deposit_amount FLOAT DEFAULT 0"))
        if "deposit_method" not in order_columns:
            conn.execute(text("ALTER TABLE orders ADD COLUMN deposit_method VARCHAR"))
        if "assigned_staff" not in order_columns:
            conn.execute(text("ALTER TABLE orders ADD COLUMN assigned_staff VARCHAR"))
