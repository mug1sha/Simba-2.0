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
