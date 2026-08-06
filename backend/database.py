from sqlalchemy import create_engine, Column, Integer, String, DateTime, Enum, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv
# import psycopg as psycopg2 #추가
load_dotenv()

# Railway PostgreSQL 없으면 로컬 SQLite 사용
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./soilgery.db")

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
    grit = Column(Integer, default=0, nullable=False)          # 근성
    intelligence = Column(Integer, default=0, nullable=False)  # 지성
    wage_pref = Column(Integer, default=0, nullable=False)     # 급여
    personality = Column(Integer, default=0, nullable=False)   # 성격

    created_at = Column(DateTime, default=datetime.utcnow)
    is_seeking = Column(Boolean, default=True, nullable=False)  # 구직 중 여부


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
