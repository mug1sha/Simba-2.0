from datetime import datetime
from sqlalchemy.orm import Session
from . import models, schemas
from .auth import get_password_hash

def get_store_info(db: Session):
    return db.query(models.StoreInfo).first()

def get_products(db: Session, category: str = None, search: str = None, skip: int = 0, limit: int = 100):
    query = db.query(models.Product)
    if category:
        query = query.filter(models.Product.category == category)
    if search:
        search_words = search.split()
        for word in search_words:
            query = query.filter(models.Product.name.ilike(f"%{word}%"))
    return query.offset(skip).limit(limit).all()

def get_categories(db: Session):
    categories = db.query(models.Product.category).distinct().all()
    return [c[0] for c in categories]

def get_product(db: Session, product_id: int):
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_favorites(db: Session, user_id: int):
    return db.query(models.Favorite).filter(models.Favorite.user_id == user_id).all()

def add_favorite(db: Session, user_id: int, product_id: int):
    db_favorite = models.Favorite(user_id=user_id, product_id=product_id)
    db.add(db_favorite)
    db.commit()
    db.refresh(db_favorite)
    return db_favorite

def get_orders(db: Session, user_id: int):
    return db.query(models.Order).filter(models.Order.user_id == user_id).all()

def create_order(db: Session, user_id: int, total: float, items: str):
    db_order = models.Order(user_id=user_id, total=total, items=items, created_at=str(datetime.utcnow()))
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order
