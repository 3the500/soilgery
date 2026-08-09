import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

try:
    from backend.database import create_tables, engine
    from backend.migrations import run_migrations
    from backend.routers import (
        auth_router,
        aptitude_router,
        matching_router,
        posting_router,
        chat_router,
        support_router,
        review_router,
    )
except ImportError:
    from database import create_tables, engine
    from migrations import run_migrations
    from routers import (
        auth_router,
        aptitude_router,
        matching_router,
        posting_router,
        chat_router,
        support_router,
        review_router,
    )


# ── 앱 수명주기(Lifespan) 설정 (DB 테이블 자동 생성) ─────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        create_tables()
        print("[OK] DB 테이블 생성/검증 완료")
    except Exception as e:
        print(f"[ERROR] DB 테이블 생성 실패: {e}")

    try:
        run_migrations(engine)
    except Exception as e:
        print(f"[ERROR] DB 마이그레이션 실패: {e}")
    yield


app = FastAPI(
    title="소일거리 API",
    description="충북 청년 × 농부 AI 매칭 플랫폼 API 백엔드",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False
)


# ── CORS 설정 (모바일 APK 및 안드로이드 전용 Origin 명시 연동) ─────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
        "http://localhost:5173",
        "https://outstanding-celebration-production.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 정적 파일(채팅 이미지/동영상 첨부) 서빙 ─────────────────
# ⚠️ Railway 등 클라우드 배포 환경은 파일시스템이 재배포 시 초기화될 수 있으므로,
# 운영 환경에서는 S3/Cloudinary 등 영구 오브젝트 스토리지로 교체하는 것을 권장합니다.
_UPLOAD_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(os.path.join(_UPLOAD_ROOT, "chat"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_UPLOAD_ROOT), name="uploads")


# ── 라우터 등록 ─────────────────────────────────────
app.include_router(auth_router.router)
app.include_router(aptitude_router.router)
app.include_router(matching_router.router)
app.include_router(posting_router.router)
app.include_router(chat_router.router)
app.include_router(support_router.router)
app.include_router(review_router.router)


@app.get("/", tags=["기본"])
def root():
    return {"message": "소일거리 API 서버 정상 작동 중 🌱"}
