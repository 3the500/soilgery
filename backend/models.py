"""
추가 테이블 모델
------------------
database.py는 zip 원본 그대로 유지하기로 했으므로, 매칭/채팅/상담 기능에 필요한
새 테이블(job_postings, match_requests, messages, reports)은 이 파일에 따로 정의합니다.

database.py의 Base를 그대로 가져다 써서 같은 metadata에 등록되므로,
main.py에서 이 파일이 import된 상태로 create_tables()가 호출되면
아래 테이블들도 함께(User 테이블과 나란히) 생성됩니다.
"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean

from database import Base
# import psycopg as psycopg2 #추가

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

    # ── 채팅 나가기 상태 ─────────────────────────
    # 농부/청년 각자 "채팅나가기"를 눌렀는지 여부를 따로 저장한다.
    # 한쪽만 나가면: 나간 사람 목록에서는 이 매칭(채팅방)이 사라지고,
    #               남은 사람 화면에는 "상대방이 채팅을 나갔습니다" 안내가 뜬다.
    # 남은 사람도 나가면(뒤로가기 포함): 그때 이 채팅방은 양쪽 모두에게서 사라진다.
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
    status = Column(String, default="pending", nullable=False)  # pending | resolved
    created_at = Column(DateTime, default=datetime.utcnow)
