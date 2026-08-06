import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from backend.database import create_tables
    from backend.routers import (
        auth_router,
        aptitude_router,
        matching_router,
        posting_router,
        chat_router,
        support_router,
    )
except ImportError:
    from database import create_tables
    from routers import (
        auth_router,
        aptitude_router,
        matching_router,
        posting_router,
        chat_router,
        support_router,
    )


# ── 앱 수명주기(Lifespan) 설정 (DB 테이블 자동 생성) ─────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        create_tables()
        print("[OK] DB 테이블 생성/검증 완료")
    except Exception as e:
        print(f"[ERROR] DB 테이블 생성 실패: {e}")
    yield


app = FastAPI(
    title="소일거리 API",
    description="충북 청년 × 농부 AI 매칭 플랫폼 API 백엔드",
    version="1.0.0",
    lifespan=lifespan
)


# ── CORS 설정 (프론트엔드 연동) ─────────────────────
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            # 허용할 Origin 목록
    allow_origin_regex=r"https://.*", # https로 시작하는 모든 배포 URL 허용 (배포 테스트용)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 라우터 등록 ─────────────────────────────────────
app.include_router(auth_router.router)
app.include_router(aptitude_router.router)
app.include_router(matching_router.router)
app.include_router(posting_router.router)
app.include_router(chat_router.router)
app.include_router(support_router.router)


@app.get("/", tags=["기본"])
def root():
    return {"message": "소일거리 API 서버 정상 작동 중 🌱"}
