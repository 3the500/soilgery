"""
추가 테이블 모델
------------------
database.py는 zip 원본 그대로 유지하기로 했으므로, 매칭/채팅/상담/리뷰 기능에 필요한
새 테이블(job_postings, match_requests, messages, reports, reviews)은 이 파일에 따로 정의합니다.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float
from database import Base

class JobPosting(Base):
    __tablename__ = "job_postings"

    id = Column(Integer, primary_key=True, index=True)
    employer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    task = Column(String, nullable=False)               # 밭일 / 트렉터 운용 / 물건 나르기
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    location = Column(String, nullable=True)
    wage = Column(Integer, nullable=True)
    status = Column(String, default="open", nullable=False)  # open | closed
    created_at = Column(DateTime, default=datetime.utcnow)


class MatchRequest(Base):
    __tablename__ = "match_requests"

    id = Column(Integer, primary_key=True, index=True)
    job_posting_id = Column(Integer, ForeignKey("job_postings.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="matched", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    employer_left = Column(Boolean, default=False, nullable=False)
    employee_left = Column(Boolean, default=False, nullable=False)


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("match_requests.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(String, nullable=True)
    summary = Column(String, nullable=True)
    severity = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ⭐️ 평점 및 리뷰 저장용 테이블 모델
class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)   # 리뷰 작성자 ID
    reviewee_id = Column(Integer, ForeignKey("users.id"), nullable=False)   # 리뷰 대상 유저 ID
    match_id = Column(Integer, ForeignKey("match_requests.id"), nullable=True) # 매칭 ID (선택)
    rating = Column(Float, nullable=False)                                  # 평점 (1.0 ~ 5.0)
    comment = Column(String, nullable=True)                                 # 한줄 후기/평가
    created_at = Column(DateTime, default=datetime.utcnow)
