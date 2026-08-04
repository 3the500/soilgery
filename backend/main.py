from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import create_tables
from routers import auth_router

app = FastAPI(title="소일거리 API", version="1.0.0")

# ── CORS (프론트엔드 연동) ──────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",          # 로컬 개발
        "https://*.vercel.app",           # Vercel 배포
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB 테이블 자동 생성 ───────────────────────────────
@app.on_event("startup")
def startup():
    create_tables()

# ── 라우터 등록 ───────────────────────────────────────
app.include_router(auth_router.router)


@app.get("/")
def root():
    return {"message": "소일거리 API 서버 정상 작동 중 🌱"}
