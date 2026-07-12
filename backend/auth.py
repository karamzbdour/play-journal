import os
import re
from typing import Optional
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator

# Load environment variables
load_dotenv()

# Environment variables
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")

# Security schema for route protection
security = HTTPBearer()

# --- Pydantic Models for Input Validation ---

class UserSignUp(BaseModel):
    email: str = Field(..., description="User's email address")
    password: str = Field(..., description="User's password (must be strong)")
    full_name: Optional[str] = Field(None, description="Optional user full name")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v = v.strip().lower()
        # Clean and robust email validation regex
        email_regex = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
        if not re.match(email_regex, v):
            raise ValueError("Invalid email format")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        # Enforce security policies:
        # Minimum 8 characters, at least one uppercase letter, one lowercase letter, one number, and one special character.
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError("Password must contain at least one special character")
        return v


class UserSignIn(BaseModel):
    email: str = Field(..., description="User's email address")
    password: str = Field(..., description="User's password")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v = v.strip().lower()
        return v


# --- Authentication Dependency ---

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    FastAPI dependency to extract, decode, and verify the Supabase JWT token.
    Returns the decoded user payload or raises HTTP 401.
    """
    token = credentials.credentials
    
    from database import get_supabase_client
    supabase_client = get_supabase_client()
    try:
        response = supabase_client.auth.get_user(token)
        if not response or not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token: No user returned.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user = response.user
        return {
            "sub": user.id,
            "email": user.email,
            "role": getattr(user, "role", "authenticated"),
            "user_metadata": getattr(user, "user_metadata", {})
        }
    except Exception as e:
        print(f"Supabase Auth Verification Failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
