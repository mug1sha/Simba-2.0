"""
Simba CRUD Operations
Handles all database interactions with transaction safety and clear logic separation.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_
from . import models, schemas
from .auth import get_password_hash
from .email_service import generate_token, send_verification_email, send_reset_password_email

# --- STORE ---
def get_store_info(db: Session):
    """Retrieve site-wide configuration and metadata."""
    return db.query(models.StoreInfo).first()

# --- PRODUCTS ---
def get_products(db: Session, category: str = None, search: str = None, skip: int = 0, limit: int = 100):
    """Fetch products with optional category filtering and multi-word search."""
    query = db.query(models.Product)
    if category:
        query = query.filter(models.Product.category == category)
    if search:
        search_words = search.split()
        for word in search_words:
            query = query.filter(models.Product.name.ilike(f"%{word}%"))
    return query.offset(skip).limit(limit).all()

def get_categories(db: Session):
    """Get unique product categories available in the store."""
    categories = db.query(models.Product.category).distinct().all()
    return [c[0] for c in categories]

def get_product(db: Session, product_id: int):
    """Fetch a single product by its unique ID."""
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def update_product_stock(db: Session, product_id: int, inStock: bool):
    """Update stock status and trigger restock notifications if item returns to inventory."""
    db_product = get_product(db, product_id)
    if db_product:
        old_stock = db_product.inStock
        db_product.inStock = inStock
        db.commit()
        db.refresh(db_product)
        
        if not old_stock and inStock:
            subs = db.query(models.RestockSubscription).filter(models.RestockSubscription.product_id == product_id).all()
            for sub in subs:
                create_notification(
                    db,
                    user_id=sub.user_id,
                    ntype="Restock",
                    title="Item Restocked! 🔥",
                    message=f"Good news! '{db_product.name}' is back in stock and ready for delivery.",
                    link="/"
                )
                db.delete(sub)
            db.commit()
    return db_product

def update_product_price(db: Session, product_id: int, new_price: float):
    """Update product price and trigger notifications for users who favorited at a higher price."""
    db_product = get_product(db, product_id)
    if not db_product: return None
    
    old_price = db_product.price
    db_product.price = new_price
    db.commit()
    db.refresh(db_product)
    
    if new_price < old_price:
        # Notify fans
        fans = db.query(models.Favorite).filter(models.Favorite.product_id == product_id).all()
        for fan in fans:
            if new_price < fan.original_price:
                create_notification(
                    db,
                    user_id=fan.user_id,
                    ntype="Promo",
                    title="Price Drop Alert! 📉",
                    message=f"'{db_product.name}' is now RWF {new_price:,.0f} (was RWF {old_price:,.0f})!",
                    link="/profile"
                )
    return db_product

# --- AUTH & USERS ---
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    """Initialize new user with hashed password and verification token."""
    hashed_password = get_password_hash(user.password)
    v_token = generate_token()
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        is_verified=False,
        verification_token=v_token
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    send_verification_email(db_user.email, v_token)
    return db_user

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    """Update user personal details."""
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        update_data = user_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_user, key, value)
        db.commit()
        db.refresh(db_user)
    return db_user

def verify_email(db: Session, token: str):
    """Confirm user email via verification token."""
    user = db.query(models.User).filter(models.User.verification_token == token).first()
    if user:
        user.is_verified = True
        user.verification_token = None
        db.commit()
        return True
    return False

def forgot_password_request(db: Session, email: str):
    """Generate a reset token and mock-send a reset email."""
    user = get_user_by_email(db, email)
    if user:
        token = generate_token()
        user.reset_password_token = token
        user.reset_password_expires = str(datetime.utcnow() + timedelta(hours=1))
        db.commit()
        send_reset_password_email(email, token)
        return True
    return False

def reset_password(db: Session, token: str, new_password: str):
    """Validate reset token and update user password if expiry is valid."""
    user = db.query(models.User).filter(
        models.User.reset_password_token == token
    ).first()
    if user:
        # Simple expiry check
        expires = datetime.fromisoformat(user.reset_password_expires)
        if datetime.utcnow() < expires:
            user.hashed_password = get_password_hash(new_password)
            user.reset_password_token = None
            user.reset_password_expires = None
            db.commit()
            return True
    return False

# --- FAVORITES & RECS ---
def add_favorite(db: Session, user_id: int, product_id: int):
    """Add product to user's wishlist and lock in current price for drop tracking."""
    product = get_product(db, product_id)
    if not product: return None
    
    existing = db.query(models.Favorite).filter(models.Favorite.user_id == user_id, models.Favorite.product_id == product_id).first()
    if existing: return existing

    db_favorite = models.Favorite(
        user_id=user_id, 
        product_id=product_id,
        original_price=product.price,
        created_at=str(datetime.utcnow())
    )
    db.add(db_favorite)
    db.commit()
    db.refresh(db_favorite)
    return db_favorite

def remove_favorite(db: Session, user_id: int, product_id: int):
    db_favorite = db.query(models.Favorite).filter(models.Favorite.user_id == user_id, models.Favorite.product_id == product_id).first()
    if db_favorite:
        db.delete(db_favorite)
        db.commit()
        return True
    return False

def get_recommendations(db: Session, user_id: int, limit: int = 4):
    """Personalized recs based on favorited categories."""
    fav_categories = db.query(models.Product.category).join(models.Favorite).filter(models.Favorite.user_id == user_id).distinct().all()
    fav_cat_list = [c[0] for c in fav_categories]
    
    if not fav_cat_list:
        return db.query(models.Product).limit(limit).all()
    
    favorited_ids = db.query(models.Favorite.product_id).filter(models.Favorite.user_id == user_id).all()
    fav_id_list = [f[0] for f in favorited_ids]
    
    return db.query(models.Product).filter(
        models.Product.category.in_(fav_cat_list),
        ~models.Product.id.in_(fav_id_list)
    ).limit(limit).all()

def get_price_drops(db: Session, user_id: int):
    """Fetch wishlist products that currently have a price lower than when favorited."""
    favorites = db.query(models.Favorite).filter(models.Favorite.user_id == user_id).all()
    drops = []
    for fav in favorites:
        product = db.query(models.Product).filter(models.Product.id == fav.product_id).first()
        if product and product.price < fav.original_price:
            drops.append(fav)
    return drops

def subscribe_restock(db: Session, user_id: int, product_id: int):
    """Register user for an alert when an item becomes available again."""
    existing = db.query(models.RestockSubscription).filter(
        models.RestockSubscription.user_id == user_id,
        models.RestockSubscription.product_id == product_id
    ).first()
    if existing: return existing
    
    sub = models.RestockSubscription(
        user_id=user_id,
        product_id=product_id,
        created_at=str(datetime.utcnow())
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub

# --- ORDERS ---
def create_order(db: Session, user_id: int, order: schemas.OrderCreate):
    """Register a new customer order."""
    db_order = models.Order(
        user_id=user_id, total=order.total, items=order.items, 
        address_id=order.address_id, payment_method_id=order.payment_method_id,
        status="Pending", created_at=str(datetime.utcnow())
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

def update_order_status(db: Session, order_id: int, status_update: schemas.OrderUpdate):
    """Update order lifecycle and notify the user of changes."""
    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if db_order:
        old_status = db_order.status
        db_order.status = status_update.status
        if status_update.tracking_number:
            db_order.tracking_number = status_update.tracking_number
        db_order.updated_at = str(datetime.utcnow())
        db.commit()
        
        if old_status != status_update.status:
            create_notification(
                db, user_id=db_order.user_id, ntype="Order",
                title=f"Order Update: #{db_order.id}",
                message=f"Status changed from {old_status} to {status_update.status}.",
                link="/profile"
            )
    return db_order

# --- ALERTS ---
def create_notification(db: Session, user_id: int, ntype: str, title: str, message: str, link: str = None):
    db_notification = models.Notification(
        user_id=user_id, type=ntype, title=title, message=message, 
        link=link, created_at=str(datetime.utcnow())
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    return db_notification

def get_notifications(db: Session, user_id: int):
    return db.query(models.Notification).filter(models.Notification.user_id == user_id).order_by(models.Notification.created_at.desc()).all()

# --- ADDRESS & PAYMENT ---
def add_address(db: Session, user_id: int, address: schemas.AddressCreate):
    if address.is_default:
        db.query(models.Address).filter(models.Address.user_id == user_id).update({"is_default": False})
    db_address = models.Address(**address.dict(), user_id=user_id)
    db.add(db_address)
    db.commit()
    db.refresh(db_address)
    return db_address

def add_payment_method(db: Session, user_id: int, payment: schemas.PaymentMethodCreate):
    if payment.is_default:
        db.query(models.PaymentMethod).filter(models.PaymentMethod.user_id == user_id).update({"is_default": False})
    db_payment = models.PaymentMethod(**payment.dict(), user_id=user_id)
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment

# --- SUPPORT ---
def create_support_ticket(db: Session, user_id: int, ticket: schemas.SupportTicketCreate):
    db_ticket = models.SupportTicket(user_id=user_id, **ticket.dict(), created_at=str(datetime.utcnow()))
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket
