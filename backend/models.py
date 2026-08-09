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

    # [피드백 반영] 채팅에서 이미지/동영상 공유 지원용 첨부 정보
    # message_type: "text" | "image" | "video"
    message_type = Column(String, default="text", nullable=False)
    file_url = Column(String, nullable=True)   # 첨부파일 다운로드 URL (/uploads/chat/...)
    file_name = Column(String, nullable=True)  # 원본 파일명
    file_size = Column(Integer, nullable=True)  # 바이트 단위


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
    # [버그 수정] 매칭이 삭제(양쪽 모두 채팅나가기)될 때 FK 제약으로 삭제가 막히지 않도록
    # ondelete="SET NULL" 지정. (기존에 이미 생성된 DB에는 이 제약이 소급 적용되지 않으므로,
    # chat.py의 leave_chat()에서 매칭 삭제 전 리뷰의 match_id를 애플리케이션 레벨에서
    # 먼저 NULL로 비워주는 방식으로 실제 버그를 방지한다.)
    match_id = Column(Integer, ForeignKey("match_requests.id", ondelete="SET NULL"), nullable=True) # 매칭 ID (선택)
    rating = Column(Float, nullable=False)                                  # 평점 (1.0 ~ 5.0)
    comment = Column(String, nullable=True)                                 # 한줄 후기/평가
    created_at = Column(DateTime, default=datetime.utcnow)
