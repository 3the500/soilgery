"""
채팅 모듈
------------------
매칭(match_requests)이 성사된 농부-청년 사이의 채팅만 지원합니다.
매칭되지 않은 사람끼리는 채팅할 수 없도록, 메시지를 보낼 때마다
그 사람이 실제로 해당 매칭의 당사자(농부 또는 청년)인지 확인합니다.

[변경 사항 - soilgery 프로젝트 구조에 맞춰 수정]
- pymysql/raw SQL 대신 SQLAlchemy ORM 사용 (models.MatchRequest, models.JobPosting, models.Message)
"""

import os
import uuid
from typing import List, Optional

from sqlalchemy.orm import Session

from database import User
from models import MatchRequest, JobPosting, Message, Review
# import psycopg as psycopg2 #추가

# [피드백 반영] 채팅 이미지/동영상 첨부 저장 경로 및 용량 제한
# ⚠️ 참고: Railway 등 클라우드 배포 환경은 파일시스템이 재배포/재시작 시 초기화될 수 있어,
# 로컬 디스크 저장은 임시적인 해결책입니다. 운영 환경에서는 S3/Cloudinary 등
# 영구 오브젝트 스토리지 연동으로 교체하는 것을 권장합니다. (이 프로젝트에는 별도의
# 클라우드 스토리지 자격 증명이 없어 우선 로컬 디스크 저장으로 구현했습니다.)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "chat")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024   # 이미지 최대 20MB
MAX_VIDEO_SIZE_BYTES = 300 * 1024 * 1024  # 동영상 최대 300MB (요구사항 명시)

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".m4v"}

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
        "partner_profile_image": partner.profile_image if partner else None,
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


def save_chat_attachment(filename: str, content: bytes) -> dict:
    """
    업로드된 이미지/동영상 파일을 검증하고 디스크에 저장한다.
    - 확장자로 이미지/동영상 여부를 판별
    - 이미지는 20MB, 동영상은 300MB를 초과하면 거부
    반환값: {"message_type": "image"|"video", "file_url": "...", "file_name": "...", "file_size": int}
    """
    ext = os.path.splitext(filename)[1].lower()
    size = len(content)

    if ext in ALLOWED_IMAGE_EXTENSIONS:
        message_type = "image"
        if size > MAX_IMAGE_SIZE_BYTES:
            raise ValueError("이미지 파일은 20MB를 초과할 수 없습니다.")
    elif ext in ALLOWED_VIDEO_EXTENSIONS:
        message_type = "video"
        if size > MAX_VIDEO_SIZE_BYTES:
            raise ValueError("동영상 파일은 300MB를 초과할 수 없습니다.")
    else:
        raise ValueError("이미지(jpg/png/gif/webp) 또는 동영상(mp4/mov/webm/m4v) 파일만 업로드할 수 있습니다.")

    stored_name = f"{uuid.uuid4().hex}{ext}"
    stored_path = os.path.join(UPLOAD_DIR, stored_name)
    with open(stored_path, "wb") as f:
        f.write(content)

    return {
        "message_type": message_type,
        "file_url": f"/uploads/chat/{stored_name}",
        "file_name": filename,
        "file_size": size,
    }


def send_file_message(match_id: int, sender_id: int, filename: str, content: bytes, db: Session) -> Message:
    """
    매칭 당사자(농부 또는 청년)가 채팅방에서 이미지/동영상을 전송할 때 호출.
    send_message()와 동일하게 당사자 검증 및 퇴장 여부를 확인한 뒤 첨부파일을 저장한다.
    """
    match = _get_match(match_id, db)
    participants = _get_match_participants(match_id, db)
    if sender_id not in (participants["employee_id"], participants["employer_id"]):
        raise ValueError(f"sender_id={sender_id}는 match_id={match_id}의 당사자가 아닙니다.")

    is_employee = sender_id == participants["employee_id"]
    already_left = match.employee_left if is_employee else match.employer_left
    partner_left = match.employer_left if is_employee else match.employee_left
    if already_left or partner_left:
        raise ValueError("상대방 또는 본인이 퇴장한 채팅방에서는 더 이상 파일을 보낼 수 없습니다.")

    attachment = save_chat_attachment(filename, content)

    message = Message(
        match_id=match_id,
        sender_id=sender_id,
        content=attachment["file_name"],
        message_type=attachment["message_type"],
        file_url=attachment["file_url"],
        file_name=attachment["file_name"],
        file_size=attachment["file_size"],
    )
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
        # [버그 수정] "채팅나가기 실패: 오류가 발생했습니다." 원인 수정
        # 채팅방을 나가면서 평점(리뷰)을 남긴 경우, 그 리뷰(Review.match_id)가 이
        # match_requests 행을 참조하고 있는 상태에서 아래 db.delete(match)를 실행하면
        # FK 제약(reviews.match_id -> match_requests.id) 위반으로 삭제가 실패하고,
        # 프론트엔드에는 "채팅나가기 실패" 에러로 노출되었다.
        # -> 매칭 행을 지우기 전에, 이 매칭을 참조하는 리뷰들의 match_id를 먼저
        #    NULL로 비워서 참조를 끊어준다. (리뷰 자체는 삭제하지 않고 남겨둔다 -
        #    평점/후기 기록은 매칭방이 사라져도 계속 유지되어야 하기 때문)
        db.query(Review).filter(Review.match_id == match_id).update({"match_id": None})
        # 대화 내역까지 함께 정리 (양쪽 모두 나간 채팅방은 더 이상 아무도 볼 수 없음)
        db.query(Message).filter(Message.match_id == match_id).delete()
        db.delete(match)
        db.commit()

    return {"status": "채팅방을 나갔습니다.", "match_id": match_id, "both_left": both_left}
