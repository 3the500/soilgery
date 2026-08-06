from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

#backend. 추가하여 경로지정
from database import get_db, User
from auth import get_current_user
from schemas import FaqItem, AskAiRequest, AiAnswerResponse
from support import get_faq_list, get_faq_answer, ask_ai

router = APIRouter(prefix="/support", tags=["AI 상담사"])


@router.get("/faqs", response_model=List[FaqItem])
def read_faq_list():
    """상담 화면에서 사용자가 고를 수 있는 자주 묻는 질문 목록 (답변 제외)."""
    return get_faq_list()


@router.get("/faqs/{faq_id}", response_model=AiAnswerResponse)
def read_faq_answer(faq_id: str):
    """사용자가 FAQ 항목을 선택했을 때 호출. AI 호출 없이 모범 답안을 즉시 반환."""
    try:
        answer = get_faq_answer(faq_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"type": "answer", "message": answer}


@router.post("/ask", response_model=AiAnswerResponse)
def post_ai_question(
    body: AskAiRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    사용자가 FAQ에 없는 내용을 직접 입력해서 물어볼 때 호출.
    AI가 분석해서 답변하거나, 신고로 판단되면 접수 후 안내 문구만 반환.
    """
    return ask_ai(current_user.id, body.message, db)
