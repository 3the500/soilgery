from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# ── 회원가입 ──────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str           # "청년" | "농부"
    location: Optional[str] = None


# ── 로그인 ───────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── 토큰 응답 ─────────────────────────────────────
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── 유저 응답 (비밀번호 제외) ──────────────────────
class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    location: Optional[str] = None
    
    # ── AI 매칭용 스탯 & 평점 ───────────────
    rating: float = 0.0
    strength: int = 0
    stamina: int = 0
    grit: int = 0
    intelligence: int = 0
    wage_pref: int = 0
    personality: int = 0

    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

