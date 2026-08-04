from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import create_tables
from routers import auth_router

app = FastAPI(
    title="소일거리 API",
    description="충북 청년 × 농부 AI 매칭 플랫폼 API 백엔드",
    version="1.0.0"
)

# ── CORS 설정 (프론트엔드 연동) ─────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── DB 테이블 자동 생성 ─────────────────────────────
@app.on_event("startup")
def startup():
    create_tables()


# ── 라우터 등록 ─────────────────────────────────────
app.include_router(auth_router.router)


@app.get("/", tags=["기본"])
def root():
    return {"message": "소일거리 API 서버 정상 작동 중 🌱"}
