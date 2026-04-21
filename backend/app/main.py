import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import crud, models, schemas, auth
from .database import SessionLocal, engine, get_db

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Simba Backend API")

@app.get("/")
def read_root():
    return {"status": "Simba API is Live!"}

@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        # Check if store info exists
        if not db.query(models.StoreInfo).first():
            print("Database empty, starting auto-seed...")
            try:
                from .seed import seed_data
                seed_data()
            except Exception as e:
                print(f"Startup seeding error (likely another worker is seeding): {e}")
    finally:
        db.close()

# Allow configuring CORS via environment variables
cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db, user)

@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/user/favorites", response_model=List[schemas.Favorite])
def read_favorites(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_favorites(db, user_id=current_user.id)

@app.post("/api/user/favorites", response_model=schemas.Favorite)
def add_favorite(product_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.add_favorite(db, user_id=current_user.id, product_id=product_id)

@app.get("/api/user/orders", response_model=List[schemas.Order])
def read_orders(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_orders(db, user_id=current_user.id)

@app.post("/api/user/orders", response_model=schemas.Order)
def add_order(order_data: dict, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.create_order(db, user_id=current_user.id, total=order_data["total"], items=str(order_data["items"]))

@app.get("/api/store", response_model=schemas.StoreInfo)
def read_store(db: Session = Depends(get_db)):
    store_info = crud.get_store_info(db)
    if store_info is None:
        raise HTTPException(status_code=404, detail="Store information not found")
    return store_info

@app.get("/api/products", response_model=List[schemas.Product])
def read_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db)
):
    products = crud.get_products(db, category=category, search=search, skip=skip, limit=limit)
    return products

@app.get("/api/categories", response_model=List[str])
def read_categories(db: Session = Depends(get_db)):
    return crud.get_categories(db)

@app.get("/api/products/{product_id}", response_model=schemas.Product)
def read_product(product_id: int, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product
