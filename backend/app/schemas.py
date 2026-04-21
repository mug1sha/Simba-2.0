from typing import List, Optional
from pydantic import BaseModel

class ProductBase(BaseModel):
    id: int
    name: str
    price: float
    category: str
    subcategoryId: int
    inStock: bool
    image: str
    unit: str

class Product(ProductBase):
    class Config:
        from_attributes = True

class StoreInfoBase(BaseModel):
    name: str
    tagline: str
    location: str
    currency: str

class StoreInfo(StoreInfoBase):
    class Config:
        from_attributes = True

class StoreData(BaseModel):
    store: StoreInfo
    products: List[Product]

class UserCreate(BaseModel):
    email: str
    password: str

class User(BaseModel):
    id: int
    email: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class Favorite(BaseModel):
    id: int
    product_id: int

    class Config:
        from_attributes = True

class Order(BaseModel):
    id: int
    user_id: int
    total: float
    items: str
    created_at: str

    class Config:
        from_attributes = True
