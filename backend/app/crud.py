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
from .email_service import build_invite_link, generate_token, send_verification_email, send_reset_password_email
from .groq_service import ask_groq

VERIFICATION_TOKEN_EXPIRE_HOURS = 24
RESET_TOKEN_EXPIRE_HOURS = 1
SIMBA_BRANCHES = [
    "Simba Kicukiro",
    "Simba Kigali Heights",
    "Simba Kimironko",
    "Simba Gishushu",
    "Simba Gacuriro",
    "Simba Kisimenti",
    "Simba Gikondo",
    "Simba Sonatube",
    "Simba UTC",
    "Simba Rebero",
    "Simba Centenary",
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


def branch_slug(branch: str) -> str:
    return (
        branch.lower()
        .replace("simba", "")
        .replace("/", " ")
        .replace("-", " ")
        .strip()
        .replace(" ", "")
    )


def user_display_name(user: models.User | None) -> str:
    if not user:
        return ""
    full_name = " ".join(part for part in [user.first_name, user.last_name] if part).strip()
    return full_name or user.email

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
    normalized = normalize_email(email)
    return db.query(models.User).filter(models.User.email == normalized).first()

def create_user(db: Session, user: schemas.UserCreate):
    """Initialize new user with hashed password and verification token."""
    hashed_password = get_password_hash(user.password)
    v_token = generate_token()
    role = user.role if user.role in {"customer", "branch_manager", "branch_staff"} else "customer"
    db_user = models.User(
        email=normalize_email(user.email),
        hashed_password=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        role=role,
        branch=user.branch if role != "customer" else None,
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

def normalize_email(email: str | None) -> str | None:
    if not email:
        return None
    return email.strip().lower()

def is_invite_expired(invite: models.RoleInvite) -> bool:
    return datetime.utcnow() > datetime.fromisoformat(invite.expires_at)

def get_role_invite_by_token(db: Session, token: str):
    return db.query(models.RoleInvite).filter(models.RoleInvite.token == token).first()

def get_active_role_invite(db: Session, token: str):
    invite = get_role_invite_by_token(db, token)
    if not invite or invite.used_at or is_invite_expired(invite):
        return None
    return invite

def serialize_role_invite(invite: models.RoleInvite):
    return {
        "email": invite.email,
        "role": invite.role,
        "branch": invite.branch,
        "expires_at": invite.expires_at,
        "invite_url": build_invite_link(invite.token),
    }

def create_role_invite(
    db: Session,
    role: str,
    branch: str | None = None,
    email: str | None = None,
    created_by_user_id: int | None = None,
    expires_hours: int = 72,
):
    if role not in {"branch_manager", "branch_staff"}:
        raise ValueError("Invalid invite role")

    invite = models.RoleInvite(
        token=generate_token(),
        email=normalize_email(email),
        role=role,
        branch=branch,
        created_by_user_id=created_by_user_id,
        created_at=datetime.utcnow().isoformat(),
        expires_at=(datetime.utcnow() + timedelta(hours=expires_hours)).isoformat(),
        used_at=None,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite

def list_active_role_invites(db: Session, role: str | None = None):
    query = db.query(models.RoleInvite).filter(models.RoleInvite.used_at.is_(None))
    if role:
        query = query.filter(models.RoleInvite.role == role)
    invites = query.order_by(models.RoleInvite.created_at.desc()).all()
    return [invite for invite in invites if not is_invite_expired(invite)]

def accept_role_invite(db: Session, token: str, req: schemas.RoleInviteAcceptRequest):
    invite = get_active_role_invite(db, token)
    if not invite:
        return None, "This invite link is invalid or has expired"

    email = normalize_email(req.email)
    if invite.email and email != invite.email:
        return None, "This invite can only be used with the invited email address"

    existing_user = get_user_by_email(db, email)
    if existing_user:
        return None, "An account with this email already exists"

    selected_branch = req.branch.strip() if req.branch else invite.branch
    if invite.role in {"branch_manager", "branch_staff"}:
        if not selected_branch:
            return None, "Please choose a branch"
        if selected_branch not in SIMBA_BRANCHES:
            return None, "Unknown branch"

    user = models.User(
        email=email,
        hashed_password=get_password_hash(req.password),
        first_name=req.first_name,
        last_name=req.last_name,
        phone=req.phone,
        role=invite.role,
        branch=selected_branch,
        is_verified=True,
        verification_token=None,
        verification_token_expires=None,
    )
    db.add(user)
    db.flush()

    invite.used_at = datetime.utcnow().isoformat()
    invite.used_by_user_id = user.id
    db.commit()
    db.refresh(user)
    return user, None

def delete_demo_branch_operations_users(db: Session):
    demo_users = db.query(models.User).filter(
        models.User.email.like("%@simba.demo"),
        models.User.role.in_(["branch_manager", "branch_staff"]),
    ).all()
    if not demo_users:
        return

    demo_user_ids = [user.id for user in demo_users]
    db.query(models.Order).filter(models.Order.assigned_staff_user_id.in_(demo_user_ids)).update(
        {
            models.Order.assigned_staff_user_id: None,
            models.Order.assigned_staff: None,
        },
        synchronize_session=False,
    )
    for user in demo_users:
        db.delete(user)
    db.commit()

def seed_initial_manager_invites(db: Session):
    for branch in SIMBA_BRANCHES:
        existing_manager = db.query(models.User).filter(
            models.User.role == "branch_manager",
            models.User.branch == branch,
        ).first()
        if existing_manager:
            continue

        active_invite = next(
            (
                invite for invite in list_active_role_invites(db, role="branch_manager")
                if invite.branch == branch
            ),
            None,
        )
        if active_invite:
            continue
        create_role_invite(db, role="branch_manager", branch=branch, expires_hours=24 * 14)

def list_branch_staff(db: Session, branch: str):
    return (
        db.query(models.User)
        .filter(models.User.role == "branch_staff", models.User.branch == branch)
        .order_by(models.User.first_name.asc(), models.User.last_name.asc(), models.User.email.asc())
        .all()
    )

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

def get_wishlist_products(db: Session, user_id: int, limit: int = 12):
    """Return the user's saved wishlist products, newest first."""
    favorites = (
        db.query(models.Favorite)
        .join(models.Product)
        .filter(models.Favorite.user_id == user_id)
        .order_by(models.Favorite.created_at.desc())
        .limit(limit)
        .all()
    )
    return [fav.product for fav in favorites if fav.product]

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
            link="/customer"
        )
    return db_order

def get_branch_orders(db: Session, user: models.User, status: str | None = None):
    query = db.query(models.Order).filter(
        models.Order.fulfillment_type == "pickup",
        models.Order.pickup_branch == user.branch,
    )
    if user.role == "branch_staff":
        query = query.filter(models.Order.assigned_staff_user_id == user.id)
    if status:
        query = query.filter(models.Order.status == status)
    return query.order_by(models.Order.created_at.desc()).all()

def accept_branch_order(db: Session, order_id: int, manager_user: models.User):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.pickup_branch == manager_user.branch,
        models.Order.fulfillment_type == "pickup",
    ).first()
    if not order or order.status != "Pending":
        return None

    order.status = "Accepted"
    order.updated_at = str(datetime.utcnow())
    db.commit()
    db.refresh(order)
    create_notification(
        db,
        user_id=order.user_id,
        ntype="Order",
        title=f"Order #{order.id} accepted",
        message=f"The branch manager at {order.pickup_branch} accepted your order and will assign it to staff shortly.",
        link="/customer",
    )
    return order

def assign_branch_order(db: Session, order_id: int, staff_user_id: int, manager_user: models.User):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.pickup_branch == manager_user.branch,
        models.Order.fulfillment_type == "pickup",
    ).first()
    staff_user = db.query(models.User).filter(
        models.User.id == staff_user_id,
        models.User.role == "branch_staff",
        models.User.branch == manager_user.branch,
    ).first()
    if not order or not staff_user or order.status != "Accepted":
        return None

    order.assigned_staff_user_id = staff_user.id
    order.assigned_staff = user_display_name(staff_user)
    order.status = "Assigned"
    order.updated_at = str(datetime.utcnow())
    db.commit()
    db.refresh(order)
    create_notification(
        db,
        user_id=order.user_id,
        ntype="Order",
        title=f"Order #{order.id} assigned to branch staff",
        message=f"Your pickup order at {order.pickup_branch} is now assigned and queued for preparation.",
        link="/customer",
    )
    return order

def mark_branch_order_preparing(db: Session, order_id: int, staff_user: models.User):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.pickup_branch == staff_user.branch,
        models.Order.assigned_staff_user_id == staff_user.id,
        models.Order.fulfillment_type == "pickup",
    ).first()
    if not order or order.status != "Assigned":
        return None

    order.status = "Preparing"
    order.updated_at = str(datetime.utcnow())
    db.commit()
    db.refresh(order)
    create_notification(
        db,
        user_id=order.user_id,
        ntype="Order",
        title=f"Order #{order.id} is being prepared",
        message=f"The branch team at {order.pickup_branch} started preparing your order.",
        link="/customer",
    )
    return order

def mark_branch_order_ready(db: Session, order_id: int, staff_user: models.User):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.pickup_branch == staff_user.branch,
        models.Order.assigned_staff_user_id == staff_user.id,
        models.Order.fulfillment_type == "pickup",
    ).first()
    if not order or order.status != "Preparing":
        return None

    order.status = "Ready for Pick-up"
    order.updated_at = str(datetime.utcnow())
    db.commit()
    db.refresh(order)
    create_notification(
        db,
        user_id=order.user_id,
        ntype="Order",
        title=f"Order #{order.id} is ready for pick-up",
        message=f"Your order is ready at {order.pickup_branch}.",
        link="/customer",
    )
    return order

def complete_branch_order(db: Session, order_id: int, manager_user: models.User):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.pickup_branch == manager_user.branch,
        models.Order.fulfillment_type == "pickup",
    ).first()
    if not order or order.status != "Ready for Pick-up":
        return None

    order.status = "Completed"
    order.updated_at = str(datetime.utcnow())
    db.commit()
    db.refresh(order)
    create_notification(
        db,
        user_id=order.user_id,
        ntype="Order",
        title=f"Order #{order.id} completed",
        message=f"Your pick-up at {order.pickup_branch} is complete. Thank you for shopping with Simba.",
        link="/customer",
    )
    return order

def create_or_update_branch_review(db: Session, user_id: int, order_id: int, review: schemas.BranchReviewCreate):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == user_id,
    ).first()
    if (
        not order
        or order.fulfillment_type != "pickup"
        or not order.pickup_branch
        or order.status in {"Cancelled", "Returned"}
        or order.status not in {"Completed", "Picked Up"}
    ):
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

def flag_customer_no_show(db: Session, order_id: int, branch: str | None = None):
    query = db.query(models.Order).filter(models.Order.id == order_id)
    if branch:
        query = query.filter(models.Order.pickup_branch == branch)
    order = query.first()
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
    if not db_order or db_order.status not in {"Pending", "Accepted", "Assigned"}:
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

def _format_user_address(address: models.Address) -> str:
    parts = [address.label, address.street]
    if address.apartment:
        parts.append(address.apartment)
    parts.extend([address.district, address.city])
    return ", ".join(part for part in parts if part)

def _build_user_profile_context(user: models.User | None, browser_location: dict | None = None) -> dict:
    full_name = ""
    if user:
        full_name = " ".join(part for part in [user.first_name, user.last_name] if part).strip()

    addresses = user.addresses if user else []
    default_address = next((address for address in addresses if address.is_default), None) or (addresses[0] if addresses else None)
    address_lines = [_format_user_address(address) for address in addresses]
    account_phone = user.phone if user and user.phone else None
    address_phone = default_address.phone if default_address and default_address.phone else None
    browser_location_text = None
    if browser_location and isinstance(browser_location.get("latitude"), (int, float)) and isinstance(browser_location.get("longitude"), (int, float)):
        browser_location_text = f"{browser_location['latitude']:.5f}, {browser_location['longitude']:.5f}"

    return {
        "full_name": full_name or (default_address.full_name if default_address else None),
        "phone": account_phone or address_phone,
        "default_address": _format_user_address(default_address) if default_address else None,
        "address_lines": address_lines,
        "browser_location": browser_location_text,
        "city": default_address.city if default_address else None,
        "district": default_address.district if default_address else None,
        "email": user.email if user else None,
    }

def get_ai_support_response(
    db: Session,
    message: str,
    user_id: int = None,
    user: models.User | None = None,
    lang: str = "EN",
    browser_location: dict | None = None,
):
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
            "wishlist": "Your wishlist currently includes: {list}.",
            "wishlist_empty": "Your wishlist is empty right now. Save a few products and I can use them for better recommendations.",
            "wishlist_auth": "Log in first and I can read your wishlist to help with recommendations and saved items.",
            "hits": "Some of our current hits include {list}! You can't go wrong with these. 🔥",
            "delivery": "We offer express delivery across Kigali! RWF 2,000 flat rate, or FREE for orders over RWF 50,000. 🚚",
            "pickup": "For demo checkout, Simba uses branch pick-up. Choose a Kigali branch, choose a pick-up time, then confirm with a RWF {deposit:,.0f} MTN MoMo deposit. Your order is sent to branch staff immediately.",
            "branches": "You can pick up from these Simba branches: {list}.",
            "deposit": "Your order requires a RWF {deposit:,.0f} MTN MoMo deposit to confirm. This is a demo payment screen, then you pay the balance when you pick up.",
            "pay": "We accept MTN MoMo, Airtel Money, and all major cards securely at checkout. 📱💳",
            "help": "I'm here to help! I can check prices, suggest products, or tell you about our delivery options. What's on your mind? 😊",
            "profile_auth": "Log in first and I can read your saved Simba profile details like your name, phone number, and addresses.",
            "profile_name": "Your saved Simba name is {value}.",
            "profile_phone": "The phone number on your Simba profile is {value}.",
            "profile_address": "Your saved Simba address is {value}.",
            "profile_addresses": "Your saved Simba addresses are: {value}.",
            "profile_location": "Your current saved location is approximately {coords}.{suffix}",
            "profile_location_saved": "Your saved delivery area is {value}.",
            "profile_missing": "I couldn't find a saved {field} on your Simba profile yet.",
        },
        "RW": {
            "cats": "Dufite ibyiciro {n}, birimo: {list} n'ibindi! Ni ikihe wifuza kureba? 🦁",
            "found": "Nabiboneye ibi: {list}. Haba hari icyo nshyira mu giseke cyawe? 🛒",
            "not_found": "Ntabwo nabonye ibicuruzwa bihuye na '{term}' ubu. Hari kindi nagushakira? 🔍",
            "recs": "Bishingiye ku byo ukunda, ndagusaba: {list}. Ni byiza cyane! ✨",
            "wishlist": "Ku rutonde rw'ibyo ukunda harimo: {list}.",
            "wishlist_empty": "Urutonde rw'ibyo ukunda rurimo ubusa ubu. Bika ibicuruzwa bike maze mbikoreshe mu kugusabira neza.",
            "wishlist_auth": "Banza winjire maze nsome urutonde rw'ibyo ukunda kugira ngo ngufashe neza.",
            "hits": "Bimwe mu bikunzwe cyane harimo {list}! Ibi ni byiza rwose. 🔥",
            "delivery": "Tugeza ibintu hose i Kigali vuba! Wishyura 2,000 macye, cyangwa ku buntu iyo uguze ibirengeje 50,000. 🚚",
            "pickup": "Muri demo, Simba ikoresha gufatira ku ishami. Hitamo ishami ryo muri Kigali, hitamo igihe cyo gufata, hanyuma wemeze na avansi ya MTN MoMo ya RWF {deposit:,.0f}. Komande ihita ijya ku bakozi b'ishami.",
            "branches": "Wafatira kuri aya mashami ya Simba: {list}.",
            "deposit": "Komande yawe isaba avansi ya MTN MoMo ya RWF {deposit:,.0f} kugira ngo yemezwe. Ni screen ya demo, hanyuma igisigaye ukishyura uje gufata komande.",
            "pay": "Twemera MTN MoMo, Airtel Money, n'amakarita yose mu kwishyura. 📱💳",
            "help": "Ndi hano ngo ndagufasha! Nshobora kureba ibiciro, kukubwira ibyo wagura, cyangwa uburyo tubigeza mu rugo. Ni iki ukeneye? 😊",
            "profile_auth": "Banza winjire kugira ngo nsome amakuru yawe ya Simba nka amazina, telefone, na aderesi zabitswe.",
            "profile_name": "Amazina yawe yabitswe kuri Simba ni {value}.",
            "profile_phone": "Numero ya telefone iri kuri konti yawe ya Simba ni {value}.",
            "profile_address": "Aderesi yawe yabitswe kuri Simba ni {value}.",
            "profile_addresses": "Aderesi zawe zabitswe kuri Simba ni: {value}.",
            "profile_location": "Aho wabitswe ubu hafi ni {coords}.{suffix}",
            "profile_location_saved": "Aho uherereye wabitseho ni {value}.",
            "profile_missing": "Ntabwo nabonye {field} yabitswe kuri konti yawe ya Simba.",
        },
        "FR": {
            "cats": "Nous avons {n} catégories, dont : {list} et plus ! Laquelle souhaitez-vous explorer ? 🦁",
            "found": "J'ai trouvé ceux-ci pour vous : {list}. Souhaitez-vous que j'en ajoute un à votre panier ? 🛒",
            "not_found": "Je n'ai trouvé aucun produit correspondant à '{term}' pour le moment. Cherchez-vous autre chose ? 🔍",
            "recs": "D'après votre liste de souhaits, je vous recommande vivement : {list}. Ce sont des favoris pour une raison ! ✨",
            "wishlist": "Votre liste d'envies contient actuellement : {list}.",
            "wishlist_empty": "Votre liste d'envies est vide pour le moment. Enregistrez quelques produits et je m'en servirai pour mieux vous recommander.",
            "wishlist_auth": "Connectez-vous d'abord et je pourrai lire votre liste d'envies pour vous aider.",
            "hits": "Certains de nos succès actuels incluent {list} ! Vous ne pouvez pas vous tromper avec ceux-ci. 🔥",
            "delivery": "Nous offrons une livraison express dans tout Kigali ! Tarif forfaitaire de 2 000 RWF, ou GRATUIT pour les commandes supérieures à 50 000 RWF. 🚚",
            "pickup": "Pour la démo, Simba utilise le retrait en agence. Choisissez une agence à Kigali, une heure de retrait, puis confirmez avec un acompte MTN MoMo de RWF {deposit:,.0f}. La commande est envoyée immédiatement au personnel de l'agence.",
            "branches": "Vous pouvez retirer votre commande dans ces agences Simba : {list}.",
            "deposit": "Votre commande nécessite un acompte MTN MoMo de RWF {deposit:,.0f} pour être confirmée. C'est un écran de paiement simulé pour la démo, puis vous payez le solde au retrait.",
            "pay": "Nous acceptons MTN MoMo, Airtel Money et toutes les cartes majeures en toute sécurité lors du paiement. 📱💳",
            "help": "Je suis là pour vous aider ! Je peux vérifier les prix, suggérer des produits ou vous parler de nos options de livraison. Que puis-je faire pour vous ? 😊",
            "profile_auth": "Connectez-vous d'abord et je pourrai lire vos informations Simba enregistrées comme votre nom, votre numéro et vos adresses.",
            "profile_name": "Le nom enregistré sur votre compte Simba est {value}.",
            "profile_phone": "Le numéro de téléphone enregistré sur votre compte Simba est {value}.",
            "profile_address": "Votre adresse Simba enregistrée est {value}.",
            "profile_addresses": "Vos adresses Simba enregistrées sont : {value}.",
            "profile_location": "Votre position enregistrée actuelle est approximativement {coords}.{suffix}",
            "profile_location_saved": "Votre zone de livraison enregistrée est {value}.",
            "profile_missing": "Je n'ai pas trouvé de {field} enregistré sur votre profil Simba.",
        }
    }
    
    T = templates.get(lang, templates["EN"])
    profile_fields = {
        "EN": {
            "name": "name",
            "phone": "phone number",
            "address": "address",
            "location": "location",
        },
        "RW": {
            "name": "amazina",
            "phone": "numero ya telefone",
            "address": "aderesi",
            "location": "aho uherereye",
        },
        "FR": {
            "name": "nom",
            "phone": "numéro de téléphone",
            "address": "adresse",
            "location": "position",
        },
    }
    P = profile_fields.get(lang, profile_fields["EN"])
    wishlist_products = get_wishlist_products(db, user_id=user_id, limit=6) if user_id else []
    profile_context = _build_user_profile_context(user, browser_location) if user else _build_user_profile_context(None, browser_location)

    profile_terms = [
        "my name", "who am i", "my phone", "my number", "my contact", "my address", "my addresses",
        "my location", "my profile", "my details",
        "amazina yanjye", "telefone yanjye", "numero yanjye", "aderesi yanjye", "aho ndi", "umwirondoro wanjye",
        "mon nom", "mon numéro", "mon telephone", "mon téléphone", "mon adresse", "ma position", "mon profil",
    ]
    if any(term in msg for term in profile_terms):
        location_query = any(term in msg for term in ["location", "aho ndi", "position", "where am i"])
        if not user_id and location_query and profile_context["browser_location"]:
            return {
                "response": T["profile_location"].format(coords=profile_context["browser_location"], suffix=""),
                "products": [],
            }
        if not user_id:
            return {"response": T["profile_auth"], "products": []}

        if any(term in msg for term in ["name", "who am i", "amazina", "nom"]):
            if profile_context["full_name"]:
                return {"response": T["profile_name"].format(value=profile_context["full_name"]), "products": []}
            return {"response": T["profile_missing"].format(field=P["name"]), "products": []}

        if any(term in msg for term in ["phone", "number", "contact", "telefone", "numero", "numéro"]):
            if profile_context["phone"]:
                return {"response": T["profile_phone"].format(value=profile_context["phone"]), "products": []}
            return {"response": T["profile_missing"].format(field=P["phone"]), "products": []}

        if any(term in msg for term in ["address", "addresses", "aderesi", "adresse"]):
            if len(profile_context["address_lines"]) > 1:
                return {"response": T["profile_addresses"].format(value="; ".join(profile_context["address_lines"][:3])), "products": []}
            if profile_context["default_address"]:
                return {"response": T["profile_address"].format(value=profile_context["default_address"]), "products": []}
            return {"response": T["profile_missing"].format(field=P["address"]), "products": []}

        if location_query:
            if profile_context["browser_location"]:
                suffix = ""
                if profile_context["default_address"]:
                    suffix = f" {T['profile_location_saved'].format(value=profile_context['default_address'])}"
                return {
                    "response": T["profile_location"].format(coords=profile_context["browser_location"], suffix=suffix),
                    "products": [],
                }
            if profile_context["default_address"]:
                return {"response": T["profile_location_saved"].format(value=profile_context["default_address"]), "products": []}
            return {"response": T["profile_missing"].format(field=P["location"]), "products": []}

        details = []
        if profile_context["full_name"]:
            details.append(T["profile_name"].format(value=profile_context["full_name"]))
        if profile_context["phone"]:
            details.append(T["profile_phone"].format(value=profile_context["phone"]))
        if profile_context["default_address"]:
            details.append(T["profile_address"].format(value=profile_context["default_address"]))
        if profile_context["browser_location"]:
            details.append(T["profile_location"].format(coords=profile_context["browser_location"], suffix=""))
        if details:
            return {"response": " ".join(details), "products": []}
        return {"response": T["profile_missing"].format(field=P["address"]), "products": []}

    wishlist_terms = [
        "wishlist", "wish list", "favorites", "saved", "save for later",
        "ibyifuzo", "ibyo ukunda", "favoris", "liste d'envies"
    ]
    if any(k in msg for k in wishlist_terms):
        if not user_id:
            return {"response": T["wishlist_auth"], "products": []}
        if not wishlist_products:
            return {"response": T["wishlist_empty"], "products": []}
        listed = [f"{p.name} (RWF {p.price:,.0f})" for p in wishlist_products[:4]]
        return {"response": T["wishlist"].format(list="; ".join(listed)), "products": wishlist_products[:4]}

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
    if wishlist_products:
        seen_ids = {product.id for product in relevant_products}
        relevant_products = wishlist_products + [product for product in relevant_products if product.id not in seen_ids]
        relevant_products = relevant_products[:160]

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
                    "If wishlist context is present, use it for personalization and for questions about saved or favorite items. "
                    "Infer common shopping needs: for breakfast, suggest items like milk, bread, cereal, tea, coffee, juice, oats, jam, or honey if present. "
                    "For a direct product question like fresh milk, select matching milk products. "
                    "You also know Simba's pickup operations: demo checkout is pickup-first, customers choose one Kigali branch, choose a pickup time, and confirm with a RWF 500 MTN MoMo deposit. "
                    f"Real pickup branches are {', '.join(SIMBA_BRANCHES)}. "
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
            {
                "role": "system",
                "content": (
                    "Authenticated customer profile context:\n"
                    + (
                        "\n".join(
                            [
                                f"- full_name={profile_context['full_name'] or 'unknown'}",
                                f"- email={profile_context['email'] or 'unknown'}",
                                f"- phone={profile_context['phone'] or 'unknown'}",
                                f"- default_address={profile_context['default_address'] or 'unknown'}",
                                f"- all_addresses={'; '.join(profile_context['address_lines']) if profile_context['address_lines'] else 'none'}",
                                f"- current_browser_location={profile_context['browser_location'] or 'unknown'}",
                            ]
                        )
                        if user_id
                        else "- No authenticated profile context available."
                    )
                ),
            },
            {
                "role": "system",
                "content": (
                    "Wishlist context:\n"
                    + (
                        "\n".join(
                            [
                                f"- id={p.id}; name={p.name}; price=RWF {p.price:,.0f}; category={p.category}; unit={p.unit}; "
                                f"{'in stock' if p.inStock else 'out of stock'}"
                                for p in wishlist_products
                            ]
                        )
                        if wishlist_products
                        else "- No authenticated wishlist context available."
                    )
                ),
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
