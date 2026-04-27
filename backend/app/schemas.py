from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel, EmailStr, field_validator
import re

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

class BranchStock(BaseModel):
    id: int
    branch: str
    product_id: int
    stock_count: int
    updated_at: Optional[str] = None
    product: Product

    class Config:
        from_attributes = True

class BranchReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5")
        return v

class BranchReview(BaseModel):
    id: int
    branch: str
    order_id: int
    user_id: int
    rating: int
    comment: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True

class BranchRating(BaseModel):
    branch: str
    average_rating: float
    review_count: int

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
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role: str = "customer"
    branch: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v

class User(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role: str = "customer"
    branch: Optional[str] = None
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

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "customer"

class LoginResponse(Token):
    user: User

class GoogleAuthRequest(BaseModel):
    credential: str
    role: str = "customer"
    intent: str = "login"

class AuthActionResponse(BaseModel):
    status: str
    message: str
    email: Optional[EmailStr] = None
    delivery: Optional[str] = None
    dev_link: Optional[str] = None

class ResendVerificationRequest(BaseModel):
    email: EmailStr

class RoleInvitePreview(BaseModel):
    email: Optional[EmailStr] = None
    role: str
    branch: Optional[str] = None
    expires_at: str

    class Config:
        from_attributes = True

class RoleInviteCreateRequest(BaseModel):
    email: Optional[EmailStr] = None

class DevManagerInviteCreateRequest(BaseModel):
    branch: str
    email: Optional[EmailStr] = None

class RoleInviteLink(BaseModel):
    email: Optional[EmailStr] = None
    role: str
    branch: Optional[str] = None
    expires_at: str
    invite_url: str

class RoleInviteAcceptRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    branch: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v

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
    fulfillment_type: Optional[str] = "pickup"
    pickup_branch: Optional[str] = None
    pickup_time: Optional[str] = None
    deposit_amount: Optional[float] = 0
    deposit_method: Optional[str] = None
    assigned_staff: Optional[str] = None
    assigned_staff_user_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
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
    address_id: Optional[int] = None
    payment_method_id: Optional[int] = None
    fulfillment_type: Optional[str] = "pickup"
    pickup_branch: Optional[str] = None
    pickup_time: Optional[str] = None
    deposit_amount: Optional[float] = 0
    deposit_method: Optional[str] = None

    @field_validator("pickup_time")
    @classmethod
    def pickup_time_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v

        if not re.fullmatch(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}", v):
            raise ValueError("Pickup time must use format YYYY-MM-DD HH:MM")

        try:
            pickup_dt = datetime.strptime(v, "%Y-%m-%d %H:%M")
        except ValueError as exc:
            raise ValueError("Pickup time must be a valid date and time") from exc

        now = datetime.now().replace(second=0, microsecond=0)
        tomorrow_end = (now + timedelta(days=1)).replace(hour=23, minute=59)

        if pickup_dt < now:
            raise ValueError("Pickup time cannot be in the past")
        if pickup_dt > tomorrow_end:
            raise ValueError("Pickup time cannot be later than tomorrow")

        return v

class BranchAssignRequest(BaseModel):
    staff_user_id: int

class BranchStaffMember(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    branch: Optional[str] = None

    @property
    def display_name(self) -> str:
        full_name = " ".join(part for part in [self.first_name, self.last_name] if part).strip()
        return full_name or self.email

    class Config:
        from_attributes = True

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

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v

class AIChatRequest(BaseModel):
    message: str
    lang: Optional[str] = "EN"
    user_context: Optional["AIChatUserContext"] = None

class AIChatResponse(BaseModel):
    response: str
    products: List[Product] = []

class AIChatLocation(BaseModel):
    latitude: float
    longitude: float

class AIChatUserContext(BaseModel):
    location: Optional[AIChatLocation] = None
