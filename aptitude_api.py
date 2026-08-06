"""
적성검사 & 매칭 API 서버 (aptitude_api.py)
------------------
aptitude_test.py 의 검사 로직(질문 목록, 스텟 계산, DB 저장)을
프론트엔드(웹/모바일 앱)에서 HTTP로 호출할 수 있게 감싸는 서버입니다.

실행 방법:
    pip install fastapi uvicorn pymysql
    uvicorn aptitude_api:app --reload

실행 후 http://localhost:8000/docs 에서 자동 생성된 API 문서를 확인할 수 있습니다.
"""

from typing import Dict, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from aptitude_test import QUESTIONS, submit_aptitude_test, get_current_stats, get_connection
from matching import (
    recommend_farm_task,
    request_match,
    cancel_match_request,
    get_candidates_for_posting,
    create_match,
)
from ai_matching import ai_rank_candidates, get_task_message
from postings import create_posting, get_all_postings, get_posting, close_posting


app = FastAPI(title="적성검사 API")


# ---- 요청/응답 데이터 형식 정의 ----
class QuestionResponse(BaseModel):
    id: str
    text: str


class AnswerSubmission(BaseModel):
    user_id: int
    answers: Dict[str, str]  # 예: {"q1": "예", "q2": "아니요", ...}


class StatsResponse(BaseModel):
    strength: int
    stamina: int
    grit: int
    intelligence: int
    wage_pref: int
    personality: int


# 한글 스텟명 -> 응답용 영문 필드명 매핑 (프론트엔드는 영문 필드로 받는 게 다루기 편함)
STAT_FIELD_MAP = {
    "근력": "strength",
    "체력": "stamina",
    "근성": "grit",
    "지성": "intelligence",
    "급여": "wage_pref",
    "성격": "personality",
}


def _to_response_format(stats: Dict[str, int]) -> Dict[str, int]:
    """{"근력": 5, ...} -> {"strength": 5, ...} 형태로 변환"""
    return {STAT_FIELD_MAP[k]: v for k, v in stats.items()}


# ---- 1. 질문 목록 조회 ----
@app.get("/aptitude-test/questions", response_model=list[QuestionResponse])
def get_questions():
    """
    프론트엔드가 화면에 질문을 그릴 때 호출.
    각 답변에 대한 스텟 가중치는 노출하지 않고, 질문 id/텍스트만 전달합니다.
    """
    return [{"id": q["id"], "text": q["text"]} for q in QUESTIONS]


# ---- 2. 검사 결과 제출 ----
@app.post("/aptitude-test/submit", response_model=StatsResponse)
def submit_test(data: AnswerSubmission):
    """
    사용자가 모든 질문에 답하고 제출했을 때 호출.
    스텟을 계산해서 DB에 반영하고, 최종 스텟을 반환합니다.
    """
    try:
        final_stats = submit_aptitude_test(data.user_id, data.answers)
    except ValueError as e:
        # 답변이 빠졌거나 "예"/"아니요"가 아닌 값이 들어온 경우
        raise HTTPException(status_code=400, detail=str(e))

    return _to_response_format(final_stats)


# ---- 3. (선택) 특정 사용자의 현재 스텟 조회 ----
@app.get("/users/{user_id}/stats", response_model=StatsResponse)
def read_user_stats(user_id: int):
    """
    마이페이지 등에서 사용자의 현재 스텟을 보여줄 때 호출.
    """
    try:
        stats = get_current_stats(user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return _to_response_format(stats)


# ==================== 공고 관련 ====================

class CreatePostingBody(BaseModel):
    employer_id: int
    task: str
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    wage: Optional[int] = None


class PostingResponse(BaseModel):
    id: int
    employer_id: int
    task: str
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    wage: Optional[int] = None
    status: str
    created_at: str


def _posting_to_response(posting: dict) -> dict:
    posting = dict(posting)
    posting["created_at"] = str(posting["created_at"])
    return posting


# ---- 0-1. 고용주: 공고 등록 ----
@app.post("/job-postings", response_model=PostingResponse)
def register_posting(body: CreatePostingBody):
    """
    고용주가 공고를 등록할 때 호출.
    등록된 공고는 고용인/피고용인 구분 없이 모든 사용자가 볼 수 있습니다.
    """
    try:
        posting_id = create_posting(
            employer_id=body.employer_id,
            task=body.task,
            title=body.title,
            description=body.description,
            location=body.location,
            wage=body.wage,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _posting_to_response(get_posting(posting_id))


# ---- 0-2. 모든 사용자: 전체 공고 목록 조회 ----
@app.get("/job-postings", response_model=list[PostingResponse])
def list_postings(status: Optional[str] = "open"):
    """
    모든 사용자(고용인/피고용인 구분 없이)가 볼 수 있는 전체 공고 목록.
    status 기본값은 "open"(모집 중인 공고만). 전체를 보고 싶으면 status를 비워서 요청.
    """
    postings = get_all_postings(status=status)
    return [_posting_to_response(p) for p in postings]


# ---- 0-3. 모든 사용자: 공고 상세 조회 ----
@app.get("/job-postings/{posting_id}", response_model=PostingResponse)
def read_posting(posting_id: int):
    try:
        posting = get_posting(posting_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _posting_to_response(posting)


# ---- 0-4. 고용주: 공고 마감 (선택 기능) ----
@app.post("/job-postings/{posting_id}/close")
def stop_posting(posting_id: int):
    close_posting(posting_id)
    return {"status": "공고 마감 완료"}


# ==================== 매칭 관련 ====================

class RecommendedTask(BaseModel):
    task: str
    distance: float
    message: str


class CandidateResponse(BaseModel):
    user_id: int
    stats: StatsResponse
    fit_score: float


class CreateMatchBody(BaseModel):
    employee_id: int


class MatchResponse(BaseModel):
    match_id: int


# ---- 4. 검사 결과 화면에서 "추천 업무" 보여주기 ----
@app.get("/users/{user_id}/recommended-task", response_model=list[RecommendedTask])
def read_recommended_task(user_id: int, top_n: int = 3):
    """
    검사 결과 화면에서 사용자에게 어떤 농사 업무가 잘 맞는지 보여줄 때 호출.
    (매칭 신청 전, 추천 결과만 미리보기로 보여주는 용도)
    """
    try:
        stats = get_current_stats(user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    ranking = recommend_farm_task(stats, top_n=top_n)
    for item in ranking:
        item["message"] = get_task_message(item["task"])
    return ranking


# ---- 5. 피고용인: "매칭 원해요" 버튼 -> 매칭 대기 상태 전환 ----
@app.post("/users/{user_id}/request-match")
def start_match_request(user_id: int):
    """
    피고용인이 매칭을 원할 때 호출.

    [버그수정] 이전에는 프론트엔드가 보낸 task 값을 검증 없이 그대로 저장했음
    (조작되거나 화면과 실제 스텟이 어긋난 값이 들어와도 걸러지지 않는 문제).
    지금은 요청 바디를 받지 않고, 서버가 저장된 스텟으로 추천 업무를 직접 재계산해서 사용함.
    """
    try:
        stats = get_current_stats(user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    top_task = recommend_farm_task(stats, top_n=1)[0]["task"]
    request_match(user_id, top_task)
    return {"status": "매칭 대기 등록 완료", "task": top_task}


# ---- 6. 피고용인: 매칭 대기 취소 (선택 기능) ----
@app.post("/users/{user_id}/cancel-match-request")
def stop_match_request(user_id: int):
    cancel_match_request(user_id)
    return {"status": "매칭 대기 취소 완료"}


# ---- 7. 고용주: 공고에 맞는 후보자 목록 조회 ----
@app.get(
    "/job-postings/{posting_id}/candidates", response_model=list[CandidateResponse]
)
def read_candidates(posting_id: int, use_ai: bool = True):
    """
    고용주가 자신의 공고에 맞는(추천 업무가 일치하고 매칭을 원하는) 후보자 목록을 볼 때 호출.

    1차: 유클리드 거리로 정렬된 후보자 목록을 가져옴 (get_candidates_for_posting)
    2차: use_ai=True(기본값)이면, AI가 그 후보자들만 대상으로 최종 순위를 재판단 (ai_rank_candidates)
         AI 호출이 실패하면 1차 순서를 그대로 사용하므로 서비스는 항상 정상 응답합니다.
    """
    try:
        candidates = get_candidates_for_posting(posting_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if use_ai and candidates:
        # 공고의 task 값이 필요하므로 첫 후보자의 추천 업무를 기준으로 사용
        # (get_candidates_for_posting이 이미 posting의 task와 일치하는 후보자만 반환하므로 안전)
        conn = get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT task FROM job_postings WHERE id = %s", (posting_id,)
                )
                posting = cursor.fetchone()
        finally:
            conn.close()
        task = posting["task"]
        candidates = ai_rank_candidates(task, candidates)

    return [
        {
            "user_id": c["user_id"],
            "stats": _to_response_format(c["stats"]),
            "fit_score": c["fit_score"],
        }
        for c in candidates
    ]


# ---- 8. 고용주: 후보자 목록에서 "매칭" 버튼 클릭 ----
@app.post("/job-postings/{posting_id}/match", response_model=MatchResponse)
def request_create_match(posting_id: int, body: CreateMatchBody):
    """
    고용주가 후보자 목록에서 원하는 사람을 골라 '매칭' 버튼을 눌렀을 때 호출.
    """
    try:
        match_id = create_match(posting_id, body.employee_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"match_id": match_id}
