import os
from typing import List, Optional
from fastapi import FastAPI, Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import crud, models, schemas, auth
from .database import SessionLocal, engine, get_db, ensure_runtime_schema
from .email_service import read_dev_mailbox

APP_ENV = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower()
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()]
if not CORS_ORIGINS and APP_ENV not in {"production", "prod"}:
    CORS_ORIGINS = ["http://127.0.0.1:8080", "http://localhost:8080", "http://localhost:8083", "http://localhost:5173"]
if not CORS_ORIGINS:
    raise RuntimeError("CORS_ORIGINS must be configured in production")

# Create tables
models.Base.metadata.create_all(bind=engine)
ensure_runtime_schema()

app = FastAPI(title="Simba Backend API", version="2.0.0")

def is_production():
    return APP_ENV in {"production", "prod"}

def auth_action_response(status_text: str, message: str, email: str = None, delivery: dict = None):
    delivery = delivery or {}
    return {
        "status": status_text,
        "message": message,
        "email": email,
        "delivery": delivery.get("delivery"),
        "dev_link": None if is_production() else delivery.get("preview_url"),
    }

# --- STARTUP & CORA ---
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        if not db.query(models.StoreInfo).first():
            from .seed import seed_data
            seed_data()
        crud.seed_branch_stock(db)
    finally:
        db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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
@app.post("/api/auth/register", response_model=schemas.AuthActionResponse, tags=["Auth"])
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = crud.get_user_by_email(db, email=user.email)
    if existing_user and existing_user.is_verified:
        raise HTTPException(status_code=400, detail="Email already registered")
    if existing_user and not existing_user.is_verified:
        db_user, delivery = crud.send_user_verification(db, email=user.email)
        return auth_action_response(
            "verification_required",
            "This account already exists but is not verified. A new verification link was sent.",
            email=db_user.email,
            delivery=delivery,
        )
    db_user, delivery = crud.create_user(db, user)
    return auth_action_response(
        "verification_required",
        "Account created. Verify your email before logging in.",
        email=db_user.email,
        delivery=delivery,
    )

@app.post("/api/auth/login", response_model=schemas.Token, tags=["Auth"])
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email address before logging in")
        
    return {"access_token": auth.create_access_token(data={"sub": user.email}), "token_type": "bearer"}

@app.get("/api/auth/verify-email", tags=["Auth"])
@app.post("/api/auth/verify-email", tags=["Auth"])
def verify_email(token: str, db: Session = Depends(get_db)):
    if not crud.verify_email(db, token):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    return {"status": "Verified successfully"}

@app.post("/api/auth/resend-verification", response_model=schemas.AuthActionResponse, tags=["Auth"])
def resend_verification(req: schemas.ResendVerificationRequest, db: Session = Depends(get_db)):
    user, delivery = crud.send_user_verification(db, email=req.email)
    if user and user.is_verified:
        return auth_action_response("already_verified", "This email is already verified.", email=user.email)
    return auth_action_response(
        "verification_sent",
        "If an unverified account exists, a verification link was sent.",
        email=req.email if user else None,
        delivery=delivery,
    )

@app.post("/api/auth/forgot-password", response_model=schemas.AuthActionResponse, tags=["Auth"])
def forgot_password(req: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    # Always return success to prevent email enumeration
    delivery = crud.forgot_password_request(db, email=req.email)
    return auth_action_response(
        "reset_sent",
        "If an account exists, a reset link was sent.",
        email=req.email if delivery else None,
        delivery=delivery,
    )

@app.post("/api/auth/reset-password", tags=["Auth"])
def reset_password(req: schemas.PasswordResetConfirm, db: Session = Depends(get_db)):
    if not crud.reset_password(db, token=req.token, new_password=req.new_password):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    return {"status": "Password reset successful"}

@app.get("/api/dev/mailbox", tags=["Development"])
def dev_mailbox():
    if is_production():
        raise HTTPException(status_code=404, detail="Not found")
    return {"mailbox": read_dev_mailbox()}

# --- USER PROFILE & SETTINGS ---
@app.get("/api/user/profile", response_model=schemas.User, tags=["Profile"])
def read_profile(user: models.User = Depends(auth.get_current_user)):
    return user

@app.patch("/api/user/profile", response_model=schemas.User, tags=["Profile"])
def update_profile(user_update: schemas.UserUpdate, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.update_user(db, user_id=user.id, user_update=user_update)

@app.post("/api/user/change-password", tags=["Profile"])
def change_password(
    req: schemas.PasswordChangeRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirmation do not match")
    if not auth.verify_password(req.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if auth.verify_password(req.new_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    user.hashed_password = auth.get_password_hash(req.new_password)
    user.reset_password_token = None
    user.reset_password_expires = None
    db.commit()
    return {"status": "password_changed"}

@app.get("/api/user/notifications", response_model=List[schemas.Notification], tags=["Alerts"])
def read_notifications(db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.get_notifications(db, user_id=user.id)

@app.patch("/api/user/notifications/{notification_id}/read", tags=["Alerts"])
def mark_read(notification_id: int, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    notification = crud.mark_notification_as_read(db, user_id=user.id, notification_id=notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification

# --- WISHLIST & RECS ---
@app.get("/api/user/favorites", response_model=List[schemas.Favorite], tags=["Shopping"])
def read_favorites(db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Favorite).filter(models.Favorite.user_id == user.id).all()

@app.post("/api/user/favorites", response_model=schemas.Favorite, tags=["Shopping"])
def add_favorite(product_id: int, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    favorite = crud.add_favorite(db, user_id=user.id, product_id=product_id)
    if not favorite:
        raise HTTPException(status_code=404, detail="Product not found")
    return favorite

@app.delete("/api/user/favorites/{product_id}", tags=["Shopping"])
def delete_favorite(product_id: int, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    if not crud.remove_favorite(db, user_id=user.id, product_id=product_id):
        raise HTTPException(status_code=404, detail="Favorite not found")
    return {"status": "deleted"}

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

@app.post("/api/user/orders/{order_id}/return", response_model=schemas.Order, tags=["Orders"])
def return_order(order_id: int, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    order = crud.request_order_return(db, user_id=user.id, order_id=order_id)
    if not order:
        raise HTTPException(status_code=400, detail="Return request failed")
    return order

@app.post("/api/user/orders/{order_id}/branch-review", response_model=schemas.BranchReview, tags=["Reviews"])
def submit_branch_review(
    order_id: int,
    review: schemas.BranchReviewCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    db_review = crud.create_or_update_branch_review(db, user_id=user.id, order_id=order_id, review=review)
    if not db_review:
        raise HTTPException(status_code=400, detail="Review is only available after successful pick-up")
    return db_review

@app.get("/api/user/orders/{order_id}/branch-review", response_model=Optional[schemas.BranchReview], tags=["Reviews"])
def read_branch_review(order_id: int, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    return crud.get_branch_review_for_order(db, user_id=user.id, order_id=order_id)

@app.get("/api/branches/ratings", response_model=List[schemas.BranchRating], tags=["Reviews"])
def branch_ratings(db: Session = Depends(get_db)):
    return crud.get_branch_ratings(db)

# --- BRANCH OPERATIONS DEMO ---
BRANCH_STAFF = ["Aline", "Eric", "Grace", "Jean", "Patrick"]

@app.get("/api/branch/staff", response_model=List[str], tags=["Branch Operations"])
def branch_staff():
    return BRANCH_STAFF

@app.get("/api/branch/orders", response_model=List[schemas.Order], tags=["Branch Operations"])
def branch_orders(
    branch: Optional[str] = None,
    staff_member: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return crud.get_branch_orders(db, branch=branch, staff_member=staff_member)

@app.post("/api/branch/orders/{order_id}/assign", response_model=schemas.Order, tags=["Branch Operations"])
def branch_assign_order(order_id: int, req: schemas.BranchAssignRequest, db: Session = Depends(get_db)):
    order = crud.assign_branch_order(db, order_id=order_id, staff_member=req.staff_member)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.post("/api/branch/orders/{order_id}/start", response_model=schemas.Order, tags=["Branch Operations"])
def branch_start_order(order_id: int, db: Session = Depends(get_db)):
    order = crud.update_branch_order_status(db, order_id=order_id, status_text="Preparing")
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.post("/api/branch/orders/{order_id}/ready", response_model=schemas.Order, tags=["Branch Operations"])
def branch_ready_order(order_id: int, db: Session = Depends(get_db)):
    order = crud.update_branch_order_status(db, order_id=order_id, status_text="Ready for Pick-up")
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.post("/api/branch/orders/{order_id}/picked-up", response_model=schemas.Order, tags=["Branch Operations"])
def branch_picked_up_order(order_id: int, db: Session = Depends(get_db)):
    order = crud.update_branch_order_status(db, order_id=order_id, status_text="Picked Up")
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.post("/api/branch/orders/{order_id}/no-show", tags=["Branch Operations"])
def branch_no_show_order(order_id: int, db: Session = Depends(get_db)):
    flag = crud.flag_customer_no_show(db, order_id=order_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"status": "flagged", "reason": flag.reason}

@app.get("/api/branch/stock", response_model=List[schemas.BranchStock], tags=["Branch Operations"])
def branch_stock(branch: str, search: Optional[str] = None, db: Session = Depends(get_db)):
    crud.seed_branch_stock(db)
    return crud.get_branch_stock(db, branch=branch, search=search)

@app.post("/api/branch/stock/{product_id}/out-of-stock", response_model=schemas.BranchStock, tags=["Branch Operations"])
def branch_mark_out_of_stock(product_id: int, branch: str, db: Session = Depends(get_db)):
    stock = crud.set_branch_stock(db, branch=branch, product_id=product_id, stock_count=0)
    if not stock:
        raise HTTPException(status_code=404, detail="Product not found")
    return stock

# --- STOREFRONT ---
@app.get("/api/products", response_model=List[schemas.Product], tags=["Catalog"])
def read_products(
    category: Optional[str] = None, 
    search: Optional[str] = None, 
    skip: int = 0, 
    limit: int = 1000, 
    db: Session = Depends(get_db)
):
    return crud.get_products(db, category=category, search=search, skip=skip, limit=limit)

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

@app.post("/api/support/ai-chat", response_model=schemas.AIChatResponse, tags=["Support"])
def ai_chat(
    req: schemas.AIChatRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    # Optional auth for personalization
    # We try to get the user if a token is present, but don't fail if not
    user_id = None
    if authorization and authorization.lower().startswith("bearer "):
        try:
            token = authorization.split(" ", 1)[1]
            payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
            email = payload.get("sub")
            user = crud.get_user_by_email(db, email=email) if email else None
            user_id = user.id if user else None
        except Exception:
            user_id = None
        
    return crud.get_ai_support_response(db, message=req.message, user_id=user_id, lang=req.lang)

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

@app.delete("/api/user/payments/{payment_id}", tags=["Profile"])
def delete_payment(payment_id: int, db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    if not crud.delete_payment_method(db, user_id=user.id, payment_id=payment_id):
        raise HTTPException(status_code=404, detail="Payment method not found")
    return {"status": "deleted"}
