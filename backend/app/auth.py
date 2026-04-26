import os
from datetime import datetime, timedelta
from typing import Callable
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from . import models, crud
from .database import get_db

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "SUPER_SECRET_KEY_REPLACE_IN_PROD")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
APP_ENV = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower()

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

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
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

def require_roles(*allowed_roles: str) -> Callable:
    def dependency(user: models.User = Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this resource",
            )
        return user

    return dependency
