import os
from datetime import datetime, timedelta
from typing import Callable
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from . import models
from .database import get_db

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "SUPER_SECRET_KEY_REPLACE_IN_PROD")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
APP_ENV = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

if APP_ENV in {"production", "prod"} and SECRET_KEY == "SUPER_SECRET_KEY_REPLACE_IN_PROD":
    raise RuntimeError("SECRET_KEY must be set to a strong unique value in production")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

ROLE_CUSTOMER = "customer"
ROLE_BRANCH_MANAGER = "branch_manager"
ROLE_BRANCH_STAFF = "branch_staff"

import bcrypt

def verify_password(plain_password: str, hashed_password: str):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_google_token(credential: str):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google authentication is not configured on the server",
        )
    try:
        token_data = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Google credential")

    if token_data.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Google issuer")
    if not token_data.get("email"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account email missing")
    if not token_data.get("email_verified", False):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account email is not verified")

    return token_data

def get_user_from_token(token: str, db: Session):
    from . import crud

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    return user

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    return get_user_from_token(token, db)

def require_roles(*allowed_roles: str) -> Callable:
    def dependency(user: models.User = Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this resource",
            )
        return user

    return dependency
