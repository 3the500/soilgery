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

from database import User
from models import MatchRequest, JobPosting, Message
# import psycopg as psycopg2 #추가

def _get_match(match_id: int, db: Session) -> MatchRequest:
    match = db.query(MatchRequest).filter(MatchRequest.id == match_id).first()
    if match is None:
        raise ValueError(f"match_id={match_id} 매칭이 존재하지 않습니다.")
    return match


def _get_match_participants(match_id: int, db: Session) -> dict:
    """
    매칭 당사자(농부 id, 청년 id) 조회.
    match_requests -> job_postings 조인해서 employer_id를 함께 가져옴.
    """
    match = _get_match(match_id, db)
    posting = db.query(JobPosting).filter(JobPosting.id == match.job_posting_id).first()
    return {"employee_id": match.employee_id, "employer_id": posting.employer_id}

def get_match_info(match_id: int, requester_id: int, db: Session) -> dict:
    """
    채팅방 헤더/메시지 말풍선에 "상대방이 누구인지" 보여주기 위한 정보 조회.
    (지금까지는 이 정보가 없어서 프론트엔드가 sender_id 숫자만으로
    "상대방 (#3)" 처럼 표시할 수밖에 없었음)
    본인이 이 매칭의 당사자(농부 또는 청년)일 때만 조회 가능.
    """
    match = _get_match(match_id, db)
    participants = _get_match_participants(match_id, db)
    employee_id = participants["employee_id"]
    employer_id = participants["employer_id"]

    if requester_id not in (employee_id, employer_id):
        raise ValueError(f"requester_id={requester_id}는 match_id={match_id}의 당사자가 아닙니다.")

    is_employee = requester_id == employee_id
    partner_id = employer_id if is_employee else employee_id
    partner = db.query(User).filter(User.id == partner_id).first()

    # 상대방이 이미 "채팅나가기"를 눌렀는지 여부 (나(requester)가 나갔는지가 아니라
    # 상대방 쪽 플래그를 봐야 함)
    partner_left = match.employer_left if is_employee else match.employee_left

    return {
        "match_id": match_id,
        "partner_id": partner_id,
        "partner_name": partner.name if partner else None,
        "partner_role": partner.role if partner else None,
        "partner_location": partner.location if partner else None,
        "partner_rating": float(partner.rating) if (partner and partner.rating) else 0.0,
        "partner_left": bool(partner_left),
    }

def send_message(match_id: int, sender_id: int, content: str, db: Session) -> Message:
    """
    매칭 당사자(농부 또는 청년)가 메시지를 보낼 때 호출.
    당사자가 아니면 에러 발생.
    반환값: 생성된 Message 객체
    """
    if not content or not content.strip():
        raise ValueError("메시지 내용이 비어있습니다.")

    match = _get_match(match_id, db)
    participants = _get_match_participants(match_id, db)
    if sender_id not in (participants["employee_id"], participants["employer_id"]):
        raise ValueError(f"sender_id={sender_id}는 match_id={match_id}의 당사자가 아닙니다.")

    is_employee = sender_id == participants["employee_id"]
    already_left = match.employee_left if is_employee else match.employer_left
    partner_left = match.employer_left if is_employee else match.employee_left
    if already_left or partner_left:
        raise ValueError("상대방 또는 본인이 퇴장한 채팅방에서는 더 이상 메시지를 보낼 수 없습니다.")

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


def leave_chat(match_id: int, user_id: int, db: Session) -> dict:
    """
    "채팅나가기" 버튼(또는, 상대방이 이미 나간 상태에서의 "뒤로가기") 눌렀을 때 호출.

    - 본인 쪽 flag만 True로 바꾼다. 그러면 이후 목록 조회(get_my_matches)에서
      본인에게는 이 채팅방이 더 이상 보이지 않는다.
    - 상대방이 아직 안 나갔다면, 상대방 화면에는 "내가 나갔다"는 안내가 뜨게 되고
      (get_match_info의 partner_left), 상대방 목록에는 채팅방이 계속 보인다.
    - 상대방도 이미 나간 상태(양쪽 다 나감)라면 두 사람 모두에게서 사라진 것과
      같으므로, 이 시점에 해당 매칭 row 자체를 정리(삭제)한다.
    """
    match = _get_match(match_id, db)
    participants = _get_match_participants(match_id, db)
    if user_id not in (participants["employee_id"], participants["employer_id"]):
        raise ValueError(f"user_id={user_id}는 match_id={match_id}의 당사자가 아닙니다.")

    is_employee = user_id == participants["employee_id"]
    if is_employee:
        match.employee_left = True
    else:
        match.employer_left = True
    db.commit()

    both_left = match.employee_left and match.employer_left
    if both_left:
        # 대화 내역까지 함께 정리 (양쪽 모두 나간 채팅방은 더 이상 아무도 볼 수 없음)
        db.query(Message).filter(Message.match_id == match_id).delete()
        db.delete(match)
        db.commit()

    return {"status": "채팅방을 나갔습니다.", "match_id": match_id, "both_left": both_left}
