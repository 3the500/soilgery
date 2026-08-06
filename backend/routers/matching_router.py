from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

#backend. 추가하여 경로지정
from database import get_db, User
from auth import get_current_user
from models import JobPosting
from schemas import RecommendedTask, CandidateResponse, CreateMatchRequest, MatchResponse
from aptitude_test import extract_stats, STAT_COLUMN_MAP
from matching import (
    recommend_farm_task,
    request_match,
    cancel_match_request,
    get_candidates_for_posting,
    create_match,
)
from ai_matching import ai_rank_candidates, get_task_message

router = APIRouter(tags=["매칭"])


def _to_response(stats: dict) -> dict:
    return {STAT_COLUMN_MAP[k]: v for k, v in stats.items()}


# ---- 검사 결과 화면에서 "추천 업무" 보여주기 ----
@router.get("/users/me/recommended-task", response_model=List[RecommendedTask])
def read_recommended_task(top_n: int = 3, current_user: User = Depends(get_current_user)):
    """검사 결과 화면에서 본인에게 어떤 농사 업무가 잘 맞는지 보여줄 때 호출."""
    stats = extract_stats(current_user)
    ranking = recommend_farm_task(stats, top_n=top_n)
    for item in ranking:
        item["message"] = get_task_message(item["task"])
    return ranking


# ---- 청년: "매칭 원해요" 버튼 -> 매칭 대기 상태 전환 ----
@router.post("/users/me/request-match")
def start_match_request(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if current_user.role != "청년":
        raise HTTPException(status_code=403, detail="청년만 매칭을 신청할 수 있습니다.")
    top_task = request_match(current_user, db)
    return {"status": "매칭 대기 등록 완료", "task": top_task}


# ---- 청년: 매칭 대기 취소 ----
@router.post("/users/me/cancel-match-request")
def stop_match_request(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    cancel_match_request(current_user, db)
    return {"status": "매칭 대기 취소 완료"}


# ---- 농부: 공고에 맞는 후보자 목록 조회 ----
@router.get(
    "/job-postings/{posting_id}/candidates", response_model=List[CandidateResponse]
)
def read_candidates(
    posting_id: int,
    use_ai: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "농부":
        raise HTTPException(status_code=403, detail="농부만 후보자 목록을 볼 수 있습니다.")

    try:
        candidates = get_candidates_for_posting(posting_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if use_ai and candidates:
        posting = db.query(JobPosting).filter(JobPosting.id == posting_id).first()
        candidates = ai_rank_candidates(posting.task, candidates)

    return [
        {
            "user_id": c["user_id"],
            "stats": _to_response(c["stats"]),
            "fit_score": c["fit_score"],
        }
        for c in candidates
    ]


# ---- 농부: 후보자 목록에서 "매칭" 버튼 클릭 ----
@router.post("/job-postings/{posting_id}/match", response_model=MatchResponse)
def request_create_match(
    posting_id: int,
    body: CreateMatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "농부":
        raise HTTPException(status_code=403, detail="농부만 매칭을 생성할 수 있습니다.")

    try:
        match_id = create_match(posting_id, body.employee_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"match_id": match_id}
