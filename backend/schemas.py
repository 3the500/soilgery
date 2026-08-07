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


# ── 유저 정보 수정 ─────────────────────────────────
class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    is_seeking: Optional[bool] = None
    strength: Optional[int] = None
    stamina: Optional[int] = None
    grit: Optional[int] = None
    intelligence: Optional[int] = None
    wage_pref: Optional[int] = None
    personality: Optional[int] = None



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


class CreateMatchRequest(BaseModel):
    employee_id: int


class MatchResponse(BaseModel):
    match_id: int


class MyMatchResponse(BaseModel):
    matched: bool
    match_id: Optional[int] = None
    task: Optional[str] = None
    partner_name: Optional[str] = None
    partner_role: Optional[str] = None


class MatchListItem(BaseModel):
    match_id: int
    task: Optional[str] = None
    partner_name: Optional[str] = None
    partner_role: Optional[str] = None
    partner_left: bool = False          # 상대방이 채팅을 나갔는지 여부
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeaveChatResponse(BaseModel):
    status: str
    match_id: int
    both_left: bool


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


# ── 매칭(후보자) ──────────────────────────────────
class CandidateResponse(BaseModel):
    user_id: int
    name: Optional[str] = None      # 지원자 이름 추가
    location: Optional[str] = None  # 거주 지역 추가
    stats: StatsResponse
    fit_score: float


# ⭐️ 리뷰 & 평점 ─────────────────────────────────
class ReviewCreateRequest(BaseModel):
    reviewee_id: int               # 리뷰 대상 유저 ID
    match_id: Optional[int] = None # 선택적 매칭 ID
    rating: float                  # 1.0 ~ 5.0
    comment: Optional[str] = None  # 한줄 후기


class ReviewResponse(BaseModel):
    id: int
    reviewer_id: int
    reviewer_name: Optional[str] = None
    reviewee_id: int
    reviewee_name: Optional[str] = None
    match_id: Optional[int] = None
    rating: float
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True