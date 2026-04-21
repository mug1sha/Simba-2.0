import json
import os
from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from . import models

def seed_data():
    # Create tables
    models.Base.metadata.create_all(bind=engine)
    
    # Try different paths for the JSON file (Local vs Render)
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), '../../simba_products (1).json')), # From app/
        os.path.abspath(os.path.join(os.getcwd(), '../simba_products (1).json')), # From backend/ root
        os.path.abspath(os.path.join(os.getcwd(), 'simba_products (1).json')) # Current dir
    ]
    
    json_path = None
    for path in possible_paths:
        if os.path.exists(path):
            json_path = path
            break
            
    if not json_path:
        print("Could not find simba_products (1).json")
        return

    print(f"Loading data from: {json_path}")
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
            id=1, # Fixed ID for store info
            name=store_data['name'],
            tagline=store_data['tagline'],
            location=store_data['location'],
            currency=store_data['currency']
        )
        db.merge(db_store)

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
            db.merge(db_product)

        db.commit()
        print(f"Successfully seeded {len(products_data)} products.")
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
