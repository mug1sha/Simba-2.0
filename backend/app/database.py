import os
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from dotenv import load_dotenv
import fcntl

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./simba.db")

connect_args = {"check_same_thread": False, "timeout": 30} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def sqlite_startup_lock():
    """Serialize SQLite startup writes across multiple worker processes."""
    if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        yield
        return

    if SQLALCHEMY_DATABASE_URL.startswith("sqlite:///"):
        raw_path = SQLALCHEMY_DATABASE_URL.replace("sqlite:///", "", 1)
        db_path = Path(raw_path)
        if not db_path.is_absolute():
            db_path = Path.cwd() / db_path
        lock_path = db_path.with_suffix(f"{db_path.suffix}.startup.lock")
    else:
        lock_path = Path("/tmp/simba.startup.lock")

    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with open(lock_path, "w", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)

def ensure_runtime_schema():
    """Apply tiny compatibility fixes for local SQLite DBs created before migrations existed."""
    if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        return

    with engine.begin() as conn:
        user_columns = {
            row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()
        }
        if "role" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'customer'"))
        if "branch" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN branch VARCHAR"))
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
        if "delivery_location" not in order_columns:
            conn.execute(text("ALTER TABLE orders ADD COLUMN delivery_location VARCHAR"))
        if "deposit_amount" not in order_columns:
            conn.execute(text("ALTER TABLE orders ADD COLUMN deposit_amount FLOAT DEFAULT 0"))
        if "deposit_method" not in order_columns:
            conn.execute(text("ALTER TABLE orders ADD COLUMN deposit_method VARCHAR"))
        if "assigned_staff" not in order_columns:
            conn.execute(text("ALTER TABLE orders ADD COLUMN assigned_staff VARCHAR"))
        if "assigned_staff_user_id" not in order_columns:
            conn.execute(text("ALTER TABLE orders ADD COLUMN assigned_staff_user_id INTEGER"))

        branch_stock_columns = conn.execute(text("PRAGMA table_info(branch_stock)")).fetchall()
        if branch_stock_columns:
            conn.execute(text("""
                DELETE FROM branch_stock
                WHERE id NOT IN (
                    SELECT MAX(id)
                    FROM branch_stock
                    GROUP BY branch, product_id
                )
            """))
            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_stock_branch_product
                ON branch_stock (branch, product_id)
            """))
