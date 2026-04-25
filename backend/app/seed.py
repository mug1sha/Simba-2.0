import json
import os
from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from . import models

def seed_data(db: Session | None = None):
    # Create tables
    models.Base.metadata.create_all(bind=engine)
    
    # Try different paths for the JSON file (Local vs Render)
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/src/data/products.json')), # Tracked frontend catalog in monorepo
        os.path.abspath(os.path.join(os.path.dirname(__file__), '../../simba_products (1).json')), # From app/
        os.path.abspath(os.path.join(os.getcwd(), '../simba_products (1).json')), # From backend/ root
        os.path.abspath(os.path.join(os.getcwd(), 'simba_products (1).json')), # Current dir
        os.path.abspath(os.path.join(os.getcwd(), '../frontend/src/data/products.json')), # From backend/ root to frontend data
        os.path.abspath(os.path.join(os.getcwd(), 'frontend/src/data/products.json')), # Current dir to frontend data
    ]
    
    json_path = None
    for path in possible_paths:
        if os.path.exists(path):
            json_path = path
            break
            
    if not json_path:
        print("Could not find a product catalog JSON file for seeding.")
        return

    print(f"Loading data from: {json_path}")
    with open(json_path, 'r') as f:
        data = json.load(f)

    own_session = db is None
    db = db or SessionLocal()
    try:
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
        existing_product_ids = {
            product_id
            for (product_id,) in db.query(models.Product.id).all()
        }
        created_products = 0
        for p in products_data:
            if p['id'] in existing_product_ids:
                continue
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
            created_products += 1

        db.commit()
        if created_products:
            print(f"Successfully seeded {created_products} new products.")
        else:
            print("Database already seeded.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding data: {e}")
        raise
    finally:
        if own_session:
            db.close()

if __name__ == "__main__":
    seed_data()
