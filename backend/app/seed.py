import json
import os
from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from . import models

def seed_data():
    # Create tables
    models.Base.metadata.create_all(bind=engine)
    
    # Load JSON data
    json_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../simba_products (1).json'))
    with open(json_path, 'r') as f:
        data = json.load(f)

    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(models.StoreInfo).first():
            print("Database already seeded.")
            return

        # Seed Store Info
        store_data = data['store']
        db_store = models.StoreInfo(
            name=store_data['name'],
            tagline=store_data['tagline'],
            location=store_data['location'],
            currency=store_data['currency']
        )
        db.add(db_store)

        # Seed Products
        products_data = data['products']
        for p in products_data:
            db_product = models.Product(
                id=p['id'],
                name=p['name'],
                price=p['price'],
                category=p['category'],
                subcategoryId=p['subcategoryId'],
                inStock=p['inStock'],
                image=p['image'],
                unit=p['unit']
            )
            db.add(db_product)

        db.commit()
        print(f"Successfully seeded {len(products_data)} products.")
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
