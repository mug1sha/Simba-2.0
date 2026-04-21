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

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    favorites = relationship("Favorite", back_populates="user")
    orders = relationship("Order", back_populates="user")

class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))

    user = relationship("User", back_populates="favorites")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    total = Column(Float)
    items = Column(String) # Storing items as a serialized JSON string or similar
    created_at = Column(String)

    user = relationship("User", back_populates="orders")
