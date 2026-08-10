from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

#backend. 추가하여 경로지정
from database import get_db, User
from auth import get_current_user
from schemas import QuestionResponse, AnswerSubmission, StatsResponse
from aptitude_test import QUESTIONS, submit_aptitude_test, extract_stats, STAT_COLUMN_MAP

router = APIRouter(prefix="/aptitude-test", tags=["적성검사"])


def _to_response(stats: dict) -> dict:
    """{"근력": 5, ...} -> {"strength": 5, ...}"""
    return {STAT_COLUMN_MAP[k]: v for k, v in stats.items()}


@router.get("/questions", response_model=List[QuestionResponse])
def get_questions():
    """프론트엔드가 화면에 질문을 그릴 때 호출."""
    return [{"id": q["id"], "text": q["text"]} for q in QUESTIONS]


@router.post("/submit", response_model=StatsResponse)
def submit_test(
    body: AnswerSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    로그인된 사용자가 검사에 응답했을 때 호출.
    user_id는 요청에서 받지 않고, 토큰으로 식별된 본인(current_user)만 갱신됨.
    """
    try:
        stats = submit_aptitude_test(current_user, body.answers, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _to_response(stats)


@router.get("/my-stats", response_model=StatsResponse)
def read_my_stats(current_user: User = Depends(get_current_user)):
    """마이페이지 등에서 본인의 현재 스텟을 보여줄 때 호출."""
    return _to_response(extract_stats(current_user))


@router.post("/reset", response_model=StatsResponse)
def reset_my_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """[요구사항 반영] 적성검사 재시작 시 모든 스텟을 0으로 초기화합니다."""
    for col in STAT_COLUMN_MAP.values():
        setattr(current_user, col, 0)
    db.commit()
    db.refresh(current_user)
    return _to_response(extract_stats(current_user))

