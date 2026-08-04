from sqlalchemy import create_engine, Column, Integer, String, DateTime, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

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
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
    # 초기 샘플 유저 자동 등록 (비어있을 경우)
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            import bcrypt
            pwd1 = bcrypt.hashpw("password123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            pwd2 = bcrypt.hashpw("password123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            sample_users = [
                User(name="홍길동 (기본 샘플)", email="youth@soilgery.com", hashed_password=pwd1, role="청년", location="충북 청주시"),
                User(name="김농부 (기본 샘플)", email="farmer@soilgery.com", hashed_password=pwd2, role="농부", location="충북 옥천군"),
            ]
            db.add_all(sample_users)
            db.commit()
    except Exception as e:
        print("샘플 유저 생성이 생략되었습니다:", e)
    finally:
        db.close()

