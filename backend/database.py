from sqlalchemy import create_engine, Column, Integer, String, DateTime, Enum, Float, Boolean, Text, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv
load_dotenv()

# Railway PostgreSQL 없으면 로컬 SQLite 사용
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./soilgery.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite는 connect_args 필요
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(Enum("청년", "농부", name="user_role"), nullable=False)
    location = Column(String, nullable=True)        # 거주 지역
    
    # ── AI 매칭용 스탯 & 평점 (기본값 0) ─────────
    rating = Column(Float, default=0.0, nullable=False)        # 평점 (★ 0.0 ~ 5.0)
    strength = Column(Integer, default=0, nullable=False)      # 근력
    stamina = Column(Integer, default=0, nullable=False)       # 체력
    grit = Column(Integer, default=0, nullable=False)          # 성실성 (구: 근성)
    intelligence = Column(Integer, default=0, nullable=False)  # 숙련도 (구: 지성)
    wage_pref = Column(Integer, default=0, nullable=False)     # 급여민감도 (구: 급여)
    personality = Column(Integer, default=0, nullable=False)   # 협동심 (구: 성격)

    # ── 🏆 레벨 및 경험치 (Lv.1 ~ Lv.10) ───────────
    exp = Column(Integer, default=0, nullable=False)           # 누적 경험치
    level = Column(Integer, default=1, nullable=False)         # 현재 레벨 (1 ~ 10)

    created_at = Column(DateTime, default=datetime.utcnow)
    is_seeking = Column(Boolean, default=True, nullable=False)  # 구직 중 여부

    # 프로필 사진 (base64 data URL 문자열로 저장)
    profile_image = Column(Text, nullable=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)

    # DB 마이그레이션: exp, level 컬럼이 없는 기존 DB 테이블 자동 보완 (text() 및 commit() 구문 적용)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN exp INTEGER DEFAULT 0;"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1;"))
            conn.commit()
        except Exception:
            pass
