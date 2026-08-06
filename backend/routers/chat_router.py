from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

#backend. 추가하여 경로지정
from database import get_db, User
from auth import get_current_user
from schemas import SendMessageRequest, MessageResponse
from chat import send_message, get_conversation

router = APIRouter(prefix="/matches", tags=["채팅"])


@router.post("/{match_id}/messages", response_model=MessageResponse)
def post_message(
    match_id: int,
    body: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """매칭이 성사된 농부 또는 청년이 메시지를 보낼 때 호출. 매칭 당사자가 아니면 400 에러."""
    try:
        message = send_message(match_id, current_user.id, body.content, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return message


@router.get("/{match_id}/messages", response_model=List[MessageResponse])
def read_conversation(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """매칭 당사자(농부 또는 청년)가 채팅방 대화 내역을 볼 때 호출."""
    try:
        return get_conversation(match_id, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
