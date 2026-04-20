from sqlalchemy.orm import Session
from . import models, schemas

def get_store_info(db: Session):
    return db.query(models.StoreInfo).first()

def get_products(db: Session, category: str = None, search: str = None, skip: int = 0, limit: int = 100):
    query = db.query(models.Product)
    if category:
        query = query.filter(models.Product.category == category)
    if search:
        query = query.filter(models.Product.name.contains(search))
    return query.offset(skip).limit(limit).all()

def get_categories(db: Session):
    categories = db.query(models.Product.category).distinct().all()
    return [c[0] for c in categories]

def get_product(db: Session, product_id: int):
    return db.query(models.Product).filter(models.Product.id == product_id).first()
