"""
Simba CRUD Operations
Handles all database interactions with transaction safety and clear logic separation.
"""
import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_
from . import models, schemas
from .auth import get_password_hash
from .email_service import generate_token, send_verification_email, send_reset_password_email
from .groq_service import ask_groq

VERIFICATION_TOKEN_EXPIRE_HOURS = 24
RESET_TOKEN_EXPIRE_HOURS = 1
SIMBA_BRANCHES = [
    "Simba Supermarket Remera",
    "Simba Supermarket Kimironko",
    "Simba Supermarket Kacyiru",
    "Simba Supermarket Nyamirambo",
    "Simba Supermarket Gikondo",
    "Simba Supermarket Kanombe",
    "Simba Supermarket Kinyinya",
    "Simba Supermarket Kibagabaga",
    "Simba Supermarket Nyanza",
]
PICKUP_DEPOSIT_AMOUNT = 500
SEARCH_STOPWORDS = {
    "a", "an", "and", "any", "are", "about", "at", "can", "could", "do", "does", "for", "from", "have",
    "how", "i", "is", "it", "me", "of", "on", "please", "show", "the", "to", "you", "your",
    "price", "cost", "find", "search", "buy", "need", "want", "with", "in", "stock", "fresh", "something",
    "igiciro", "angahe", "shaka", "mfite", "ndashaka", "prix", "coût", "combien", "trouver",
    "pour", "de", "du", "des", "le", "la", "les",
}


def extract_search_keywords(search: str) -> list[str]:
    return [
        word.strip(".,?!:;()[]{}\"'").lower()
        for word in search.split()
        if word.strip(".,?!:;()[]{}\"'").lower()
        and word.strip(".,?!:;()[]{}\"'").lower() not in SEARCH_STOPWORDS
    ]


def parse_groq_json(raw: str) -> dict | None:
    """Accept strict JSON or a fenced JSON object and return a dict."""
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            return json.loads(raw[start:end + 1])
        except json.JSONDecodeError:
            return None

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
        search_words = extract_search_keywords(search)
        if not search_words:
            search_words = [word.strip() for word in search.split() if word.strip()]
        for word in search_words:
            filters = [
                models.Product.name.ilike(f"%{word}%"),
                models.Product.category.ilike(f"%{word}%"),
                models.Product.unit.ilike(f"%{word}%"),
            ]
            if word.replace(".", "", 1).isdigit():
                filters.append(models.Product.price == float(word))
            query = query.filter(or_(*filters))
    return query.offset(skip).limit(limit).all()


def get_context_products(db: Session, message: str, limit: int = 12):
    """Collect likely catalog matches for AI context without over-constraining multi-item prompts."""
    seen = set()
    products = []
    for word in extract_search_keywords(message):
        for product in get_products(db, search=word, limit=4):
            if product.id in seen:
                continue
            seen.add(product.id)
            products.append(product)
            if len(products) >= limit:
                return products
    return products


def get_ai_catalog_products(db: Session, message: str, limit: int = 160):
    """Build a broad but bounded product context so Groq can infer needs like breakfast."""
    seen = set()
    products = []

    for product in get_context_products(db, message, limit=30):
        if product.id not in seen:
            seen.add(product.id)
            products.append(product)

    category_hints = {
        "breakfast": ["milk", "bread", "cereal", "coffee", "tea", "juice", "oats", "egg", "jam", "honey"],
        "morning": ["milk", "bread", "cereal", "coffee", "tea", "juice", "oats"],
        "baby": ["baby", "milk", "diaper", "lactogen"],
        "clean": ["soap", "detergent", "clean", "shampoo"],
    }
    hint_terms = []
    msg = message.lower()
    for trigger, terms in category_hints.items():
        if trigger in msg:
            hint_terms.extend(terms)

    for term in hint_terms:
        for product in get_products(db, search=term, limit=8):
            if product.id not in seen:
                seen.add(product.id)
                products.append(product)

    if len(products) < limit:
        for product in db.query(models.Product).filter(models.Product.inStock == True).limit(limit).all():
            if product.id not in seen:
                seen.add(product.id)
                products.append(product)
            if len(products) >= limit:
                break

    return products[:limit]

def get_categories(db: Session):
    """Get unique product categories available in the store."""
    categories = db.query(models.Product.category).distinct().all()
    return [c[0] for c in categories]

def get_product(db: Session, product_id: int):
    """Fetch a single product by its unique ID."""
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def seed_branch_stock(db: Session, default_count: int = 20):
    """Create a starting stock row for every product at every Simba branch."""
    products = db.query(models.Product).all()
    if not products:
        return

    existing_pairs = {
        (row.branch, row.product_id)
        for row in db.query(models.BranchStock.branch, models.BranchStock.product_id).all()
    }
    now = str(datetime.utcnow())
    created = 0
    for branch in SIMBA_BRANCHES:
        for product in products:
            if (branch, product.id) in existing_pairs:
                continue
            db.add(models.BranchStock(
                branch=branch,
                product_id=product.id,
                stock_count=default_count if product.inStock else 0,
                updated_at=now,
            ))
            created += 1
    if created:
        db.commit()

def get_branch_stock(db: Session, branch: str, search: str = None, limit: int = 80):
    query = db.query(models.BranchStock).join(models.Product).filter(models.BranchStock.branch == branch)
    if search:
        for word in extract_search_keywords(search):
            query = query.filter(or_(
                models.Product.name.ilike(f"%{word}%"),
                models.Product.category.ilike(f"%{word}%"),
            ))
    return query.order_by(models.Product.name.asc()).limit(limit).all()

def set_branch_stock(db: Session, branch: str, product_id: int, stock_count: int):
    stock = db.query(models.BranchStock).filter(
        models.BranchStock.branch == branch,
        models.BranchStock.product_id == product_id,
    ).first()
    if not stock:
        product = get_product(db, product_id)
        if not product:
            return None
        stock = models.BranchStock(branch=branch, product_id=product_id)
        db.add(stock)
    stock.stock_count = max(0, stock_count)
    stock.updated_at = str(datetime.utcnow())
    db.commit()
    db.refresh(stock)
    return stock

def decrement_branch_stock(db: Session, branch: str, items_json: str):
    try:
        items = json.loads(items_json or "[]")
    except json.JSONDecodeError:
        return

    for item in items:
        product_id = item.get("id")
        quantity = int(item.get("quantity", 1) or 1)
        if not product_id:
            continue
        stock = db.query(models.BranchStock).filter(
            models.BranchStock.branch == branch,
            models.BranchStock.product_id == product_id,
        ).first()
        if not stock:
            stock = models.BranchStock(branch=branch, product_id=product_id, stock_count=0)
            db.add(stock)
        stock.stock_count = max(0, (stock.stock_count or 0) - quantity)
        stock.updated_at = str(datetime.utcnow())
    db.commit()

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
        verification_token=v_token,
        verification_token_expires=(datetime.utcnow() + timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS)).isoformat()
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    delivery = send_verification_email(db_user.email, v_token)
    return db_user, delivery

def send_user_verification(db: Session, email: str):
    """Create a fresh verification token for an existing unverified account."""
    user = get_user_by_email(db, email)
    if not user:
        return None, None
    if user.is_verified:
        return user, {"delivery": None, "preview_url": None}

    token = generate_token()
    user.verification_token = token
    user.verification_token_expires = (datetime.utcnow() + timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS)).isoformat()
    db.commit()
    db.refresh(user)
    delivery = send_verification_email(user.email, token)
    return user, delivery

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
    if not user:
        return False
    if user.verification_token_expires:
        expires = datetime.fromisoformat(user.verification_token_expires)
        if datetime.utcnow() > expires:
            return False
    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    return True

def forgot_password_request(db: Session, email: str):
    """Generate a reset token and mock-send a reset email."""
    user = get_user_by_email(db, email)
    if user:
        token = generate_token()
        user.reset_password_token = token
        user.reset_password_expires = (datetime.utcnow() + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)).isoformat()
        db.commit()
        return send_reset_password_email(email, token)
    return None

def reset_password(db: Session, token: str, new_password: str):
    """Validate reset token and update user password if expiry is valid."""
    user = db.query(models.User).filter(
        models.User.reset_password_token == token
    ).first()
    if user:
        if not user.reset_password_expires:
            return False
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
        fulfillment_type=order.fulfillment_type or "pickup",
        pickup_branch=order.pickup_branch,
        pickup_time=order.pickup_time,
        deposit_amount=order.deposit_amount or 0,
        deposit_method=order.deposit_method,
        status="Pending", created_at=str(datetime.utcnow())
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    if db_order.pickup_branch:
        decrement_branch_stock(db, branch=db_order.pickup_branch, items_json=order.items)
    if db_order.pickup_branch:
        create_notification(
            db,
            user_id=user_id,
            ntype="Order",
            title=f"Pickup order sent to {db_order.pickup_branch}",
            message="Your pickup order is waiting for the branch manager to assign it to staff.",
            link="/profile"
        )
    return db_order

def get_branch_orders(db: Session, branch: str = None, staff_member: str = None):
    query = db.query(models.Order).filter(models.Order.fulfillment_type == "pickup")
    if branch:
        query = query.filter(models.Order.pickup_branch == branch)
    if staff_member:
        query = query.filter(models.Order.assigned_staff == staff_member)
    return query.order_by(models.Order.created_at.desc()).all()

def assign_branch_order(db: Session, order_id: int, staff_member: str):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        return None
    order.assigned_staff = staff_member
    order.status = "Assigned"
    order.updated_at = str(datetime.utcnow())
    db.commit()
    db.refresh(order)
    return order

def update_branch_order_status(db: Session, order_id: int, status_text: str):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        return None
    order.status = status_text
    order.updated_at = str(datetime.utcnow())
    db.commit()
    db.refresh(order)
    if status_text == "Ready for Pick-up":
        create_notification(
            db,
            user_id=order.user_id,
            ntype="Order",
            title=f"Order #{order.id} is ready for pick-up",
            message=f"Your order is ready at {order.pickup_branch}.",
            link="/profile"
        )
    return order

def create_or_update_branch_review(db: Session, user_id: int, order_id: int, review: schemas.BranchReviewCreate):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == user_id,
    ).first()
    if not order or order.status != "Picked Up" or not order.pickup_branch:
        return None

    existing = db.query(models.BranchReview).filter(
        models.BranchReview.order_id == order_id,
        models.BranchReview.user_id == user_id,
    ).first()
    if existing:
        existing.rating = review.rating
        existing.comment = review.comment
        existing.created_at = str(datetime.utcnow())
        db.commit()
        db.refresh(existing)
        return existing

    db_review = models.BranchReview(
        branch=order.pickup_branch,
        order_id=order_id,
        user_id=user_id,
        rating=review.rating,
        comment=review.comment,
        created_at=str(datetime.utcnow()),
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review

def get_branch_review_for_order(db: Session, user_id: int, order_id: int):
    return db.query(models.BranchReview).filter(
        models.BranchReview.order_id == order_id,
        models.BranchReview.user_id == user_id,
    ).first()

def get_branch_ratings(db: Session):
    ratings = []
    for branch in SIMBA_BRANCHES:
        reviews = db.query(models.BranchReview).filter(models.BranchReview.branch == branch).all()
        if reviews:
            average = round(sum(review.rating for review in reviews) / len(reviews), 1)
            count = len(reviews)
        else:
            average = 4.6
            count = 0
        ratings.append({
            "branch": branch,
            "average_rating": average,
            "review_count": count,
        })
    return ratings

def flag_customer_no_show(db: Session, order_id: int):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        return None
    existing = db.query(models.CustomerFlag).filter(
        models.CustomerFlag.order_id == order_id,
        models.CustomerFlag.reason == "Did not show up",
    ).first()
    if existing:
        return existing
    flag = models.CustomerFlag(
        user_id=order.user_id,
        order_id=order.id,
        branch=order.pickup_branch,
        reason="Did not show up",
        created_at=str(datetime.utcnow()),
    )
    order.status = "No-show"
    order.updated_at = str(datetime.utcnow())
    db.add(flag)
    db.commit()
    db.refresh(flag)
    return flag

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

def cancel_order(db: Session, user_id: int, order_id: int):
    """Cancel an order while it is still early in the fulfillment flow."""
    db_order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == user_id
    ).first()
    if not db_order or db_order.status not in {"Pending", "Assigned", "Preparing", "Processing"}:
        return None

    db_order.status = "Cancelled"
    db_order.updated_at = str(datetime.utcnow())
    db.commit()
    db.refresh(db_order)
    create_notification(
        db,
        user_id=user_id,
        ntype="Order",
        title=f"Order Cancelled: #{db_order.id}",
        message="Your order has been cancelled.",
        link="/profile"
    )
    return db_order

def request_order_return(db: Session, user_id: int, order_id: int):
    """Mark a delivered order as return requested."""
    db_order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == user_id
    ).first()
    if not db_order or db_order.status != "Delivered":
        return None

    db_order.status = "Return Requested"
    db_order.updated_at = str(datetime.utcnow())
    db.commit()
    db.refresh(db_order)
    create_notification(
        db,
        user_id=user_id,
        ntype="Order",
        title=f"Return Requested: #{db_order.id}",
        message="Your return request has been submitted for review.",
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

def mark_notification_as_read(db: Session, user_id: int, notification_id: int):
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == user_id
    ).first()
    if not notification:
        return None
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification

# --- ADDRESS & PAYMENT ---
def add_address(db: Session, user_id: int, address: schemas.AddressCreate):
    if address.is_default:
        db.query(models.Address).filter(models.Address.user_id == user_id).update({"is_default": False})
    db_address = models.Address(**address.dict(), user_id=user_id)
    db.add(db_address)
    db.commit()
    db.refresh(db_address)
    return db_address

def delete_address(db: Session, user_id: int, address_id: int):
    address = db.query(models.Address).filter(
        models.Address.id == address_id,
        models.Address.user_id == user_id
    ).first()
    if not address:
        return False
    db.delete(address)
    db.commit()
    return True

def add_payment_method(db: Session, user_id: int, payment: schemas.PaymentMethodCreate):
    if payment.is_default:
        db.query(models.PaymentMethod).filter(models.PaymentMethod.user_id == user_id).update({"is_default": False})
    db_payment = models.PaymentMethod(**payment.dict(), user_id=user_id)
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment

def delete_payment_method(db: Session, user_id: int, payment_id: int):
    payment = db.query(models.PaymentMethod).filter(
        models.PaymentMethod.id == payment_id,
        models.PaymentMethod.user_id == user_id
    ).first()
    if not payment:
        return False
    db.delete(payment)
    db.commit()
    return True

# --- SUPPORT & AI ---
def create_support_ticket(db: Session, user_id: int, ticket: schemas.SupportTicketCreate):
    db_ticket = models.SupportTicket(user_id=user_id, **ticket.dict(), created_at=str(datetime.utcnow()))
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

def get_support_tickets(db: Session, user_id: int):
    return db.query(models.SupportTicket).filter(models.SupportTicket.user_id == user_id).all()

def get_ai_support_response(db: Session, message: str, user_id: int = None, lang: str = "EN"):
    """
    Simba Smart Support Engine.
    Parses user intent and queries live database for localized product, price, and recommendation info.
    """
    msg = message.lower()
    
    # Translation Maps
    cat_map = {
        "Alcoholic Drinks": {"RW": "Ibinyobwa bisindisha", "FR": "Boissons alcoolisées"},
        "Baby Products": {"RW": "Iby'abana", "FR": "Produits bébé"},
        "Cleaning & Sanitary": {"RW": "Isuku", "FR": "Nettoyage & Sanitaire"},
        "Cosmetics & Personal Care": {"RW": "Isura n'Umubiri", "FR": "Cosmétiques & Soins"},
        "Food Products": {"RW": "Ibiribwa", "FR": "Produits alimentaires"},
        "General": {"RW": "Ibisanzwe", "FR": "Général"},
        "Kitchen Storage": {"RW": "Iby'igikoni", "FR": "Rangement Cuisine"},
        "Kitchenware & Electronics": {"RW": "ibikoresho by'igikoni", "FR": "Ustensiles & Électronique"},
        "Pet Care": {"RW": "Iby'amatungo", "FR": "Soins Animaux"},
        "Sports & Wellness": {"RW": "Imyitozo", "FR": "Sports & Bien-être"}
    }

    def t_cat(cat):
        return cat_map.get(cat, {}).get(lang, cat)

    # Responses by language
    templates = {
        "EN": {
            "cats": "We have {n} categories, including: {list} and more! Which one would you like to explore? 🦁",
            "found": "I found these for you: {list}. Would you like me to add one to your cart? 🛒",
            "not_found": "I couldn't find any products matching '{term}' right now. Is there something else I can look for? 🔍",
            "recs": "Based on your wishlist, I highly recommend: {list}. They are favorites for a reason! ✨",
            "hits": "Some of our current hits include {list}! You can't go wrong with these. 🔥",
            "delivery": "We offer express delivery across Kigali! RWF 2,000 flat rate, or FREE for orders over RWF 50,000. 🚚",
            "pickup": "For demo checkout, Simba uses branch pick-up. Choose a Kigali branch, choose a pick-up time, then confirm with a RWF {deposit:,.0f} MTN MoMo deposit. Your order is sent to branch staff immediately.",
            "branches": "You can pick up from these Simba branches: {list}.",
            "deposit": "Your order requires a RWF {deposit:,.0f} MTN MoMo deposit to confirm. This is a demo payment screen, then you pay the balance when you pick up.",
            "pay": "We accept MTN MoMo, Airtel Money, and all major cards securely at checkout. 📱💳",
            "help": "I'm here to help! I can check prices, suggest products, or tell you about our delivery options. What's on your mind? 😊"
        },
        "RW": {
            "cats": "Dufite ibyiciro {n}, birimo: {list} n'ibindi! Ni ikihe wifuza kureba? 🦁",
            "found": "Nabiboneye ibi: {list}. Haba hari icyo nshyira mu giseke cyawe? 🛒",
            "not_found": "Ntabwo nabonye ibicuruzwa bihuye na '{term}' ubu. Hari kindi nagushakira? 🔍",
            "recs": "Bishingiye ku byo ukunda, ndagusaba: {list}. Ni byiza cyane! ✨",
            "hits": "Bimwe mu bikunzwe cyane harimo {list}! Ibi ni byiza rwose. 🔥",
            "delivery": "Tugeza ibintu hose i Kigali vuba! Wishyura 2,000 macye, cyangwa ku buntu iyo uguze ibirengeje 50,000. 🚚",
            "pickup": "Muri demo, Simba ikoresha gufatira ku ishami. Hitamo ishami ryo muri Kigali, hitamo igihe cyo gufata, hanyuma wemeze na avansi ya MTN MoMo ya RWF {deposit:,.0f}. Komande ihita ijya ku bakozi b'ishami.",
            "branches": "Wafatira kuri aya mashami ya Simba: {list}.",
            "deposit": "Komande yawe isaba avansi ya MTN MoMo ya RWF {deposit:,.0f} kugira ngo yemezwe. Ni screen ya demo, hanyuma igisigaye ukishyura uje gufata komande.",
            "pay": "Twemera MTN MoMo, Airtel Money, n'amakarita yose mu kwishyura. 📱💳",
            "help": "Ndi hano ngo ndagufasha! Nshobora kureba ibiciro, kukubwira ibyo wagura, cyangwa uburyo tubigeza mu rugo. Ni iki ukeneye? 😊"
        },
        "FR": {
            "cats": "Nous avons {n} catégories, dont : {list} et plus ! Laquelle souhaitez-vous explorer ? 🦁",
            "found": "J'ai trouvé ceux-ci pour vous : {list}. Souhaitez-vous que j'en ajoute un à votre panier ? 🛒",
            "not_found": "Je n'ai trouvé aucun produit correspondant à '{term}' pour le moment. Cherchez-vous autre chose ? 🔍",
            "recs": "D'après votre liste de souhaits, je vous recommande vivement : {list}. Ce sont des favoris pour une raison ! ✨",
            "hits": "Certains de nos succès actuels incluent {list} ! Vous ne pouvez pas vous tromper avec ceux-ci. 🔥",
            "delivery": "Nous offrons une livraison express dans tout Kigali ! Tarif forfaitaire de 2 000 RWF, ou GRATUIT pour les commandes supérieures à 50 000 RWF. 🚚",
            "pickup": "Pour la démo, Simba utilise le retrait en agence. Choisissez une agence à Kigali, une heure de retrait, puis confirmez avec un acompte MTN MoMo de RWF {deposit:,.0f}. La commande est envoyée immédiatement au personnel de l'agence.",
            "branches": "Vous pouvez retirer votre commande dans ces agences Simba : {list}.",
            "deposit": "Votre commande nécessite un acompte MTN MoMo de RWF {deposit:,.0f} pour être confirmée. C'est un écran de paiement simulé pour la démo, puis vous payez le solde au retrait.",
            "pay": "Nous acceptons MTN MoMo, Airtel Money et toutes les cartes majeures en toute sécurité lors du paiement. 📱💳",
            "help": "Je suis là pour vous aider ! Je peux vérifier les prix, suggérer des produits ou vous parler de nos options de livraison. Que puis-je faire pour vous ? 😊"
        }
    }
    
    T = templates.get(lang, templates["EN"])

    # 1. Category Information
    if any(k in msg for k in ["category", "categories", "ibyiciro", "catégorie"]):
        cats = get_categories(db)
        cat_list = [t_cat(c) for c in cats[:5]]
        return {"response": T["cats"].format(n=len(cats), list=", ".join(cat_list)), "products": []}

    branch_terms = [
        "branch", "branches", "pickup", "pick-up", "pick up", "collect", "store", "location", "locations",
        "ishami", "amashami", "gufata", "aho", "agence", "agences", "retrait", "magasin", "lieu"
    ]
    deposit_terms = ["deposit", "momo deposit", "advance", "avansi", "acompte"]
    if any(k in msg for k in branch_terms):
        branch_list = ", ".join(SIMBA_BRANCHES)
        branch_products = get_context_products(db, message, limit=4)
        if branch_products:
            prod_list = [f"{p.name} (RWF {p.price:,.0f})" for p in branch_products]
            return {
                "response": f"{T['pickup'].format(deposit=PICKUP_DEPOSIT_AMOUNT)} {T['found'].format(list='; '.join(prod_list))}",
                "products": branch_products,
            }
        if any(k in msg for k in ["branch", "branches", "location", "locations", "ishami", "amashami", "agence", "agences", "magasin"]):
            return {"response": T["branches"].format(list=branch_list), "products": []}
        return {"response": T["pickup"].format(deposit=PICKUP_DEPOSIT_AMOUNT), "products": []}

    if any(k in msg for k in deposit_terms):
        return {"response": T["deposit"].format(deposit=PICKUP_DEPOSIT_AMOUNT), "products": []}

    # 2. Price/Product Search
    if any(k in msg for k in ["price", "cost", "how much", "find", "search", "igiciro", "angahe", "shaka", "prix", "coût", "combien", "trouver"]):
        words = extract_search_keywords(message)
        if words:
            search_term = " ".join(words)
            products = get_products(db, search=search_term, limit=3)
            if products:
                prod_list = [f"{p.name} (RWF {p.price:,.0f})" for p in products]
                return {"response": T["found"].format(list="; ".join(prod_list)), "products": products}
            return {"response": T["not_found"].format(term=search_term), "products": []}

    # 3. Recommendations
    if any(k in msg for k in ["recommend", "suggest", "to buy", "gusaba", "reka", "kurinda", "recommander", "suggérer", "acheter"]):
        if user_id:
            recs = get_recommendations(db, user_id=user_id, limit=3)
            if recs:
                prod_list = [p.name for p in recs]
                return {"response": T["recs"].format(list=", ".join(prod_list)), "products": recs}
        
        top = db.query(models.Product).limit(3).all()
        return {"response": T["hits"].format(list=", ".join([p.name for p in top])), "products": top}

    # 4. Delivery & Payment
    if any(k in msg for k in ["delivery", "shipping", "kugeza", "livraison", "expédition"]):
        return {"response": T["pickup"].format(deposit=PICKUP_DEPOSIT_AMOUNT), "products": []}
    
    if any(k in msg for k in ["pay", "momo", "card", "kwishyura", "payer", "carte"]):
        return {"response": T["pay"], "products": []}

    relevant_products = get_ai_catalog_products(db, message)

    product_context = "\n".join(
        [
            f"- id={p.id}; name={p.name}; price=RWF {p.price:,.0f}; category={p.category}; unit={p.unit}; "
            f"{'in stock' if p.inStock else 'out of stock'}"
            for p in relevant_products
        ]
    )

    groq_raw = ask_groq(
        [
            {
                "role": "system",
                "content": (
                    "You are Simba Supermarket's product matching assistant. "
                    "Use the catalog context to match the customer's request to relevant products. "
                    "Infer common shopping needs: for breakfast, suggest items like milk, bread, cereal, tea, coffee, juice, oats, jam, or honey if present. "
                    "For a direct product question like fresh milk, select matching milk products. "
                    "You also know Simba's pickup operations: demo checkout is pickup-first, customers choose one Kigali branch, choose a pickup time, and confirm with a RWF 500 MTN MoMo deposit. "
                    "Real pickup branches are Simba Supermarket Remera, Kimironko, Kacyiru, Nyamirambo, Gikondo, Kanombe, Kinyinya, Kibagabaga, and Nyanza. "
                    "Return JSON only with this exact shape: "
                    "{\"response\":\"short natural-language answer\",\"product_ids\":[123,456]}. "
                    "Use only ids from the catalog context. Return at most 6 product_ids. "
                    "If no relevant products exist, product_ids must be empty. "
                    f"Write the response in language code {lang}."
                ),
            },
            {
                "role": "system",
                "content": f"Catalog context:\n{product_context}",
            },
            {"role": "user", "content": message},
        ],
        temperature=0.1,
        max_tokens=450,
    )
    if groq_raw:
        try:
            parsed = parse_groq_json(groq_raw)
            if not parsed:
                raise ValueError("Groq did not return JSON")
            product_ids = parsed.get("product_ids", [])
            if not isinstance(product_ids, list):
                product_ids = []
            product_ids = [int(pid) for pid in product_ids[:6] if str(pid).isdigit()]
            matched_products = []
            if product_ids:
                products_by_id = {
                    product.id: product
                    for product in db.query(models.Product).filter(models.Product.id.in_(product_ids)).all()
                }
                matched_products = [products_by_id[pid] for pid in product_ids if pid in products_by_id]
            response_text = parsed.get("response") if isinstance(parsed.get("response"), str) else None
            if response_text:
                return {"response": response_text, "products": matched_products}
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    fallback_products = relevant_products[:4]
    if fallback_products:
        prod_list = [f"{p.name} (RWF {p.price:,.0f})" for p in fallback_products]
        return {"response": T["found"].format(list="; ".join(prod_list)), "products": fallback_products}

    return {"response": T["help"], "products": []}
