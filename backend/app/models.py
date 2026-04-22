from sqlalchemy import Boolean, Column, Float, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class StoreInfo(Base):
    __tablename__ = "store_info"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    tagline = Column(String)
    location = Column(String)
    currency = Column(String)

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    price = Column(Float)
    category = Column(String, index=True)
    subcategoryId = Column(Integer)
    inStock = Column(Boolean, default=True)
    image = Column(String)
    unit = Column(String)

class BranchStock(Base):
    __tablename__ = "branch_stock"

    id = Column(Integer, primary_key=True, index=True)
    branch = Column(String, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True)
    stock_count = Column(Integer, default=0)
    updated_at = Column(String, nullable=True)

    product = relationship("Product")

class BranchReview(Base):
    __tablename__ = "branch_reviews"

    id = Column(Integer, primary_key=True, index=True)
    branch = Column(String, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    rating = Column(Integer)
    comment = Column(String, nullable=True)
    created_at = Column(String)

    order = relationship("Order")
    user = relationship("User")

class CustomerFlag(Base):
    __tablename__ = "customer_flags"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), index=True)
    branch = Column(String, index=True)
    reason = Column(String)
    created_at = Column(String)

    user = relationship("User")
    order = relationship("Order")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)
    verification_token_expires = Column(String, nullable=True)
    reset_password_token = Column(String, nullable=True)
    reset_password_expires = Column(String, nullable=True)

    favorites = relationship("Favorite", back_populates="user")
    orders = relationship("Order", back_populates="user")
    addresses = relationship("Address", back_populates="user")
    payment_methods = relationship("PaymentMethod", back_populates="user")

class Address(Base):
    __tablename__ = "addresses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    label = Column(String)  # Home, Work, etc.
    full_name = Column(String)
    phone = Column(String)
    street = Column(String)
    apartment = Column(String, nullable=True)
    city = Column(String)
    district = Column(String)
    is_default = Column(Boolean, default=False)

    user = relationship("User", back_populates="addresses")

class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    provider = Column(String)  # Visa, MasterCard, MTN, Airtel
    last_four = Column(String)
    expiry_date = Column(String)
    is_default = Column(Boolean, default=False)

    user = relationship("User", back_populates="payment_methods")

class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    original_price = Column(Float)
    created_at = Column(String)

    user = relationship("User", back_populates="favorites")
    product = relationship("Product")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    total = Column(Float)
    items = Column(String) # Storing items as a serialized JSON string or similar
    status = Column(String, default="Pending")
    tracking_number = Column(String, nullable=True)
    address_id = Column(Integer, ForeignKey("addresses.id"), nullable=True)
    payment_method_id = Column(Integer, ForeignKey("payment_methods.id"), nullable=True)
    fulfillment_type = Column(String, default="pickup")
    pickup_branch = Column(String, nullable=True)
    pickup_time = Column(String, nullable=True)
    deposit_amount = Column(Float, default=0)
    deposit_method = Column(String, nullable=True)
    assigned_staff = Column(String, nullable=True)
    created_at = Column(String)
    updated_at = Column(String, nullable=True)

    user = relationship("User", back_populates="orders")
    address = relationship("Address")
    payment_method = relationship("PaymentMethod")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String) # Order, Promo, Restock
    title = Column(String)
    message = Column(String)
    is_read = Column(Boolean, default=False)
    link = Column(String, nullable=True)
    created_at = Column(String)

    user = relationship("User")

class RestockSubscription(Base):
    __tablename__ = "restock_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    created_at = Column(String)

    user = relationship("User")
    product = relationship("Product")

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    subject = Column(String)
    message = Column(String)
    status = Column(String, default="Open")
    created_at = Column(String)

    user = relationship("User")
