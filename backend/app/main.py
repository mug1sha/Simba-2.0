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

app = FastAPI(title="Simba Backend API", version="2.0.0")

# --- STARTUP & CORA ---
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        if not db.query(models.StoreInfo).first():
            from .seed import seed_data
            seed_data()
    finally:
        db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Live", "system": "Simba 2.0"}

@app.get("/api/store", response_model=schemas.StoreInfo, tags=["Catalog"])
def read_store(db: Session = Depends(get_db)):
    store = crud.get_store_info(db)
    if not store:
        raise HTTPException(status_code=404, detail="Store info not found")
    return store

# --- AUTHENTICATION ---
@app.post("/api/auth/register", response_model=schemas.User, tags=["Auth"])
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if crud.get_user_by_email(db, email=user.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db, user)

@app.post("/api/auth/login", response_model=schemas.Token, tags=["Auth"])
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    return {"access_token": auth.create_access_token(data={"sub": user.email}), "token_type": "bearer"}

@app.post("/api/auth/verify-email", tags=["Auth"])
def verify_email(token: str, db: Session = Depends(get_db)):
    if not crud.verify_email(db, token):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    return {"status": "Verified successfully"}

@app.post("/api/auth/forgot-password", tags=["Auth"])
def forgot_password(req: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    # Always return success to prevent email enumeration
    crud.forgot_password_request(db, email=req.email)
    return {"status": "If an account exists, a reset link was sent"}

@app.post("/api/auth/reset-password", tags=["Auth"])
def reset_password(req: schemas.PasswordResetConfirm, db: Session = Depends(get_db)):
    if not crud.reset_password(db, token=req.token, new_password=req.new_password):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    return {"status": "Password reset successful"}

# --- USER PROFILE & SETTINGS ---
@app.get("/api/user/profile", response_model=schemas.User, tags=["Profile"])
def read_profile(user: models.User = Depends(auth.get_current_user)):
    return user

@app.patch("/api/user/profile", response_model=schemas.User, tags=["Profile"])
def update_profile(user_update: schemas.UserUpdate, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.update_user(db, user_id=user.id, user_update=user_update)

@app.get("/api/user/notifications", response_model=List[schemas.Notification], tags=["Alerts"])
def read_notifications(db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.get_notifications(db, user_id=user.id)

@app.patch("/api/user/notifications/{notification_id}/read", tags=["Alerts"])
def mark_read(notification_id: int, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.mark_notification_as_read(db, notification_id=notification_id)

# --- WISHLIST & RECS ---
@app.get("/api/user/favorites", response_model=List[schemas.Favorite], tags=["Shopping"])
def read_favorites(db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    # Assuming crud.get_favorites exists or is trivial
    return db.query(models.Favorite).filter(models.Favorite.user_id == user.id).all()

@app.get("/api/user/favorites/price-drops", response_model=List[schemas.Favorite], tags=["Shopping"])
def read_price_drops(db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.get_price_drops(db, user_id=user.id)

@app.get("/api/user/recommendations", response_model=List[schemas.Product], tags=["Shopping"])
def read_recommendations(db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.get_recommendations(db, user_id=user.id)

@app.post("/api/user/products/{product_id}/notify", tags=["Shopping"])
def subscribe_restock(product_id: int, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.subscribe_restock(db, user_id=user.id, product_id=product_id)

# --- ORDERS & CHECKOUT ---
@app.post("/api/user/orders", response_model=schemas.Order, tags=["Orders"])
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.create_order(db, user_id=user.id, order=order)

@app.post("/api/user/orders/{order_id}/cancel", tags=["Orders"])
def cancel_order(order_id: int, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    cancel = crud.cancel_order(db, user_id=user.id, order_id=order_id)
    if not cancel: raise HTTPException(status_code=400, detail="Cancellation failed")
    return cancel

# --- STOREFRONT ---
@app.get("/api/products", response_model=List[schemas.Product], tags=["Catalog"])
def read_products(category: Optional[str] = None, search: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_products(db, category=category, search=search)

@app.get("/api/categories", response_model=List[str], tags=["Catalog"])
def read_categories(db: Session = Depends(get_db)):
    return crud.get_categories(db)

# --- HELP & SUPPORT ---
@app.post("/api/user/support", response_model=schemas.SupportTicket, tags=["Support"])
def submit_ticket(ticket: schemas.SupportTicketCreate, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.create_support_ticket(db, user_id=user.id, ticket=ticket)

@app.get("/api/user/support", response_model=List[schemas.SupportTicket], tags=["Support"])
def list_tickets(db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.get_support_tickets(db, user_id=user.id)

# --- ADDRESS & PAYMENT ---
@app.post("/api/user/addresses", response_model=schemas.Address, tags=["Profile"])
def add_address(address: schemas.AddressCreate, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.add_address(db, user_id=user.id, address=address)

@app.delete("/api/user/addresses/{address_id}", tags=["Profile"])
def delete_address(address_id: int, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    if not crud.delete_address(db, user_id=user.id, address_id=address_id):
        raise HTTPException(status_code=404, detail="Address not found")
    return {"status": "deleted"}

@app.post("/api/user/payments", response_model=schemas.PaymentMethod, tags=["Profile"])
def add_payment(payment: schemas.PaymentMethodCreate, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.add_payment_method(db, user_id=user.id, payment=payment)
