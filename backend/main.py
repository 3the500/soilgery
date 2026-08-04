from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import create_tables
from routers import auth_router

app = FastAPI(title="소일거리 API", version="1.0.0")

# ── CORS (프론트엔드 연동) ──────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB 테이블 자동 생성 ───────────────────────────────
@app.on_event("startup")
def startup():
    create_tables()

from typing import List
from sqlalchemy.orm import Session
from fastapi import Depends
from database import get_db, User
from schemas import UserResponse

app.include_router(auth_router.router)


@app.get("/users", response_model=List[UserResponse])
@app.get("/auth/users", response_model=List[UserResponse])
def get_all_users_direct(db: Session = Depends(get_db)):
    return db.query(User).all()


@app.get("/")
def root():
    return {"message": "소일거리 API 서버 정상 작동 중 🌱"}
