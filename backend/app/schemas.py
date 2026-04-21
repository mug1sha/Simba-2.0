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
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None

class User(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_verified: bool = False
    addresses: List["Address"] = []
    payment_methods: List["PaymentMethod"] = []
    favorites: List["Favorite"] = []
    orders: List["Order"] = []

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class AddressBase(BaseModel):
    label: str
    full_name: str
    phone: str
    street: str
    apartment: Optional[str] = None
    city: str
    district: str
    is_default: bool = False

class AddressCreate(AddressBase):
    pass

class Address(AddressBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class PaymentMethodBase(BaseModel):
    provider: str
    last_four: str
    expiry_date: str
    is_default: bool = False

class PaymentMethodCreate(PaymentMethodBase):
    pass

class PaymentMethod(PaymentMethodBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class Favorite(BaseModel):
    id: int
    product_id: int
    original_price: float
    created_at: str
    product: Product

    class Config:
        from_attributes = True

class Order(BaseModel):
    id: int
    user_id: int
    total: float
    items: str
    status: str
    tracking_number: Optional[str] = None
    address_id: Optional[int] = None
    payment_method_id: Optional[int] = None
    created_at: str
    updated_at: Optional[str] = None
    
    address: Optional[Address] = None
    payment_method: Optional[PaymentMethod] = None

    class Config:
        from_attributes = True

class OrderUpdate(BaseModel):
    status: str
    tracking_number: Optional[str] = None

class OrderCreate(BaseModel):
    total: float
    items: str
    address_id: int
    payment_method_id: int

class Notification(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    is_read: bool
    link: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True

class NotificationRead(BaseModel):
    is_read: bool

class SupportTicketCreate(BaseModel):
    subject: str
    message: str

class SupportTicket(BaseModel):
    id: int
    user_id: Optional[int] = None
    subject: str
    message: str
    status: str
    created_at: str

    class Config:
        from_attributes = True

class ForgotPasswordRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
