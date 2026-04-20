from sqlalchemy import Boolean, Column, Float, Integer, String
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
