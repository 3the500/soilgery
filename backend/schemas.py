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

    is_seeking: bool = True          # 구직 중 여부
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 적성검사 ──────────────────────────────────────
class QuestionResponse(BaseModel):
    id: str
    text: str


class AnswerSubmission(BaseModel):
    answers: dict  # 예: {"q1": "예", "q2": "아니요", ...}


class StatsResponse(BaseModel):
    strength: int
    stamina: int
    grit: int
    intelligence: int
    wage_pref: int
    personality: int


# ── 매칭 ──────────────────────────────────────────
class RecommendedTask(BaseModel):
    task: str
    distance: float
    message: str


class CandidateResponse(BaseModel):
    user_id: int
    stats: StatsResponse
    fit_score: float


class CreateMatchRequest(BaseModel):
    employee_id: int


class MatchResponse(BaseModel):
    match_id: int


# ── 공고 ──────────────────────────────────────────
class CreatePostingRequest(BaseModel):
    task: str
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    wage: Optional[int] = None


class PostingResponse(BaseModel):
    id: int
    employer_id: int
    task: str
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    wage: Optional[int] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── 채팅 ──────────────────────────────────────────
class SendMessageRequest(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: int
    match_id: int
    sender_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── AI 상담사 ─────────────────────────────────────
class FaqItem(BaseModel):
    id: str
    question: str


class AskAiRequest(BaseModel):
    message: str


class AiAnswerResponse(BaseModel):
    type: str  # "answer" 또는 "report"
    message: str
