import math
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, User
from auth import get_current_user
from models import JobPosting
from schemas import RecommendedTask, CandidateResponse, CreateMatchRequest, MatchResponse, MyMatchResponse, MatchListItem
from aptitude_test import extract_stats, STAT_COLUMN_MAP
from matching import (
    recommend_farm_task,
    request_match,
    cancel_match_request,
    get_candidates_for_posting,
    create_match,
    get_my_latest_match,
    get_my_matches,
    FARM_TASK_PROFILES,
)
from ai_matching import ai_rank_candidates, get_task_message, get_task_analysis

router = APIRouter(tags=["매칭"])


def _to_response(stats: dict) -> dict:
    return {STAT_COLUMN_MAP[k]: v for k, v in stats.items()}


# ---- 검사 결과 화면에서 "추천 업무" 보여주기 ----
@router.get("/users/me/recommended-task", response_model=List[RecommendedTask])
def read_recommended_task(top_n: int = 3, current_user: User = Depends(get_current_user)):
    """
    검사 결과 화면에서 본인에게 어떤 농사 업무가 잘 맞는지 보여줄 때 호출.

    [피드백 반영] 기본 출력(message)은 그대로 유지하되, 1순위 추천 업무에 한해
    "상세하게 보기"를 눌렀을 때 노출할 AI 상세 분석 문장(ai_reason)을 함께 내려준다.
    (top_n이 여러 개여도 AI 호출 비용을 아끼기 위해 1순위 업무에 대해서만 생성)
    """
    stats = extract_stats(current_user)
    ranking = recommend_farm_task(stats, top_n=top_n)
    for idx, item in enumerate(ranking):
        item["message"] = get_task_message(item["task"])
        item["ai_reason"] = get_task_analysis(stats, item["task"]) if idx == 0 else None
    return ranking


# ---- 홈 화면: 내 매칭 연결 현황 조회 (매칭 연결 표시 / 채팅방 입장용) ----
@router.get("/users/me/match", response_model=MyMatchResponse)
def read_my_match(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    match = get_my_latest_match(current_user, db)
    if match is None:
        return {"matched": False}
    return {"matched": True, **match}


# ---- 채팅목록: 내가 아직 나가지 않은 채팅방(매칭) 전체 조회 ----
@router.get("/users/me/matches", response_model=List[MatchListItem])
def read_my_matches(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return get_my_matches(current_user, db)


# ---- 청년: "매칭 원해요" 버튼 -> 매칭 대기 상태 전환 ----
@router.post("/users/me/request-match")
def start_match_request(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if current_user.role != "청년":
        raise HTTPException(status_code=403, detail="청년만 매칭을 신청할 수 있습니다.")
    try:
        top_task = request_match(current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
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
            "name": getattr(c.get("user"), "name", None),
            "location": getattr(c.get("user"), "location", None),
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


# ---- 농부: 선택한 농사 업무별 후보자 목록 조회 ----
@router.get("/candidates/by-task/{task_name}", response_model=List[CandidateResponse])
def read_candidates_by_task(
    task_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "농부":
        raise HTTPException(status_code=403, detail="농부만 후보자 목록을 조회할 수 있습니다.")
    
    if task_name not in FARM_TASK_PROFILES:
        raise HTTPException(status_code=400, detail="유효하지 않은 농사 업무입니다.")

    # 매칭 대기 중(is_seeking=True)인 청년 사용자 조회
    seeking_users = db.query(User).filter(
        User.role == "청년", 
        User.is_seeking == True
    ).all()

    ideal_profile = FARM_TASK_PROFILES[task_name]
    candidates = []

    for user in seeking_users:
        stats = extract_stats(user)
        top_task = recommend_farm_task(stats, top_n=1)[0]["task"]
        
        # 선택한 업무와 청년의 1순위 추천 업무가 일치하는 경우만 추출
        if top_task == task_name:
            fit_score = math.sqrt(sum((stats[k] - ideal_profile[k]) ** 2 for k in stats))
            candidates.append({
                "user_id": user.id,
                "name": user.name,
                "location": user.location,
                "stats": _to_response(stats),
                "fit_score": fit_score
            })

    candidates.sort(key=lambda c: c["fit_score"])
    return candidates

# ---- 농부: 업무 기반 매칭 생성 ----
@router.post("/match/by-task", response_model=MatchResponse)
def create_match_by_task(
    task_name: str,
    body: CreateMatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "농부":
        raise HTTPException(status_code=403, detail="농부만 매칭을 생성할 수 있습니다.")

    if task_name not in FARM_TASK_PROFILES:
        raise HTTPException(status_code=400, detail="유효하지 않은 농사 업무입니다.")

    posting = db.query(JobPosting).filter(
        JobPosting.employer_id == current_user.id,
        JobPosting.task == task_name,
        JobPosting.status == "open"
    ).order_by(JobPosting.created_at.desc()).first()

    if not posting:
        # 프론트엔드에 별도의 "공고 등록" 화면이 없고, 농부는 업무를 선택해서
        # 후보자 목록을 보고 바로 매칭하는 흐름만 존재한다. 그래서 매칭 시점에
        # 해당 업무로 등록된 열려있는 공고가 없으면, 이 매칭 요청 자체를 위해
        # 자동으로 공고를 하나 만들어준다 (제목은 업무명을 그대로 사용).
        posting = JobPosting(
            employer_id=current_user.id,
            task=task_name,
            title=f"{task_name} 인력 모집",
            status="open",
        )
        db.add(posting)
        db.commit()
        db.refresh(posting)

    match_id = create_match(posting.id, body.employee_id, db)
    return {"match_id": match_id}