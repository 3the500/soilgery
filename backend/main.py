import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 상대 경로 문제 방지를 위한 모듈 임포트
# (만약 backend/ 디렉토리 안에서 main.py를 직접 실행한다면 'from database import ...' 로 수정)
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
    # 앱 시작 시 DB 테이블 생성
    try:
        create_tables()
        print("✅ DB 테이블 생성/검증 완료")
    except Exception as e:
        print(f"❌ DB 테이블 생성 실패: {e}")
    yield
    # 앱 종료 시 필요한 작업이 있다면 여기에 작성

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import create_tables
from routers import auth_router

app = FastAPI(
    title="소일거리 API",
    description="충북 청년 × 농부 AI 매칭 플랫폼 API 백엔드",
<<<<<<< HEAD
    version="1.0.0",
    lifespan=lifespan
)


# ── CORS 설정 (프론트엔드 연동) ─────────────────────
# 브라우저 보안 규칙상 allow_credentials=True 일 때는 allow_origins에 "*"를 쓸 수 없습니다.
# 필요한 프론트엔드 URL들을 명시하거나 allow_origin_regex를 활용합니다.
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    # 실제 배포된 프론트엔드 URL이 있다면 여기에 추가 (예: "https://my-frontend.railway.app")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            # 허용할 Origin 목록
    allow_origin_regex=r"https://.*", # https로 시작하는 모든 배포 URL 허용 (배포 테스트용)
=======
    version="1.0.0"
)

# ── CORS 설정 (프론트엔드 연동) ─────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
>>>>>>> 961d1165ef0da758f5b8c5a229170d9298f28e0b
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


<<<<<<< HEAD
# ── 라우터 등록 ─────────────────────────────────────
app.include_router(auth_router.router)
app.include_router(aptitude_router.router)
app.include_router(matching_router.router)
app.include_router(posting_router.router)
app.include_router(chat_router.router)
app.include_router(support_router.router)
=======
# ── DB 테이블 자동 생성 ─────────────────────────────
@app.on_event("startup")
def startup():
    create_tables()


# ── 라우터 등록 ─────────────────────────────────────
app.include_router(auth_router.router)
>>>>>>> 961d1165ef0da758f5b8c5a229170d9298f28e0b


@app.get("/", tags=["기본"])
def root():
<<<<<<< HEAD
    return {"message": "소일거리 API 서버 정상 작동 중 🌱"}
=======
    return {"message": "소일거리 API 서버 정상 작동 중 🌱"}
>>>>>>> 961d1165ef0da758f5b8c5a229170d9298f28e0b
