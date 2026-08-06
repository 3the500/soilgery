"""
채팅 모듈
------------------
매칭(match_requests)이 성사된 농부-청년 사이의 채팅만 지원합니다.
매칭되지 않은 사람끼리는 채팅할 수 없도록, 메시지를 보낼 때마다
그 사람이 실제로 해당 매칭의 당사자(농부 또는 청년)인지 확인합니다.

[변경 사항 - soilgery 프로젝트 구조에 맞춰 수정]
- pymysql/raw SQL 대신 SQLAlchemy ORM 사용 (models.MatchRequest, models.JobPosting, models.Message)
"""

from typing import List

from sqlalchemy.orm import Session

from models import MatchRequest, JobPosting, Message
# import psycopg as psycopg2 #추가

def _get_match_participants(match_id: int, db: Session) -> dict:
    """
    매칭 당사자(농부 id, 청년 id) 조회.
    match_requests -> job_postings 조인해서 employer_id를 함께 가져옴.
    """
    match = db.query(MatchRequest).filter(MatchRequest.id == match_id).first()
    if match is None:
        raise ValueError(f"match_id={match_id} 매칭이 존재하지 않습니다.")

    posting = db.query(JobPosting).filter(JobPosting.id == match.job_posting_id).first()
    return {"employee_id": match.employee_id, "employer_id": posting.employer_id}


def send_message(match_id: int, sender_id: int, content: str, db: Session) -> Message:
    """
    매칭 당사자(농부 또는 청년)가 메시지를 보낼 때 호출.
    당사자가 아니면 에러 발생.
    반환값: 생성된 Message 객체
    """
    if not content or not content.strip():
        raise ValueError("메시지 내용이 비어있습니다.")

    participants = _get_match_participants(match_id, db)
    if sender_id not in (participants["employee_id"], participants["employer_id"]):
        raise ValueError(f"sender_id={sender_id}는 match_id={match_id}의 당사자가 아닙니다.")

    message = Message(match_id=match_id, sender_id=sender_id, content=content.strip())
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def get_conversation(match_id: int, requester_id: int, db: Session) -> List[Message]:
    """
    매칭 당사자만 대화 내역을 조회할 수 있음 (다른 사람이 남의 채팅을 보는 걸 방지).
    시간순으로 정렬된 메시지 목록 반환.
    """
    participants = _get_match_participants(match_id, db)
    if requester_id not in (participants["employee_id"], participants["employer_id"]):
        raise ValueError(f"requester_id={requester_id}는 match_id={match_id}의 당사자가 아닙니다.")

    return (
        db.query(Message)
        .filter(Message.match_id == match_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
        .all()
    )
