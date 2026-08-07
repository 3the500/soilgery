"""
매칭 시스템
------------------
1. 사용자 스텟을 바탕으로 가장 적합한 농사 세부 업무를 추천
2. 청년(피고용인)이 매칭을 원하면 "매칭 대기 상태"로 전환
3. 농부(고용주)가 자신의 공고에 맞는 후보자 목록을 조회
4. 농부가 원하는 후보자를 선택하면 매칭 생성

[변경 사항 - soilgery 프로젝트 구조에 맞춰 수정]
- database.py는 원본 그대로 유지하기로 해서, User 테이블에 recommended_task 컬럼을 추가하지 않음.
  대신 추천 업무는 DB에 저장하지 않고, 필요할 때마다 저장된 스텟으로 그때그때 다시 계산함
  (같은 스텟이면 항상 같은 결과가 나오므로 저장하지 않아도 문제 없음).
- "매칭 대기" 상태도 새 컬럼을 만들지 않고, 이미 있는 User.is_seeking을 그대로 재사용.
- JobPosting, MatchRequest는 models.py에 새로 정의한 모델을 사용 (SQLAlchemy ORM).
"""

import math
from typing import Dict, List

from sqlalchemy.orm import Session

from database import User
from models import JobPosting, MatchRequest
from aptitude_test import extract_stats
# import psycopg as psycopg2 #추가

# ---- 1. 농사 세부 업무별 이상적인 스텟 프로필 ----
FARM_TASK_PROFILES = {
    "밭일": {"근력": 5, "체력": 7, "근성": 8, "지성": 1, "급여": 2, "성격": 1},
    "트렉터 운용": {"근력": 3, "체력": 3, "근성": 4, "지성": 6, "급여": 4, "성격": 1},
    "물건 나르기": {"근력": 8, "체력": 8, "근성": 4, "지성": 0, "급여": 3, "성격": 0},
}


# ---- 2. 스텟 기반 최적 업무 추천 (유클리드 거리, 기존과 동일한 순수 함수) ----
def recommend_farm_task(user_stats: Dict[str, int], top_n: int = 1) -> List[Dict]:
    """
    user_stats: {"근력": 5, "체력": 7, ...} 형태
    반환값: [{"task": "밭일", "distance": 3.2}, ...] 거리가 작을수록 적합
    """

    def distance(a: Dict[str, int], b: Dict[str, int]) -> float:
        keys = a.keys()
        return math.sqrt(sum((a[k] - b[k]) ** 2 for k in keys))

    scored = [
        {"task": task, "distance": distance(user_stats, profile)}
        for task, profile in FARM_TASK_PROFILES.items()
    ]
    scored.sort(key=lambda x: x["distance"])
    return scored[:top_n]


# ---- 3. 청년: 매칭 대기 상태로 전환 ----
def request_match(user: User, db: Session) -> str:
    """
    청년(피고용인)이 '매칭 원해요' 버튼을 눌렀을 때 호출.
    현재 스텟으로 추천 업무를 계산해서 반환하고, is_seeking을 True로 설정.
    (추천 업무 자체는 DB에 저장하지 않고, 필요할 때 매번 재계산함)

    적성검사를 한 번도 하지 않은 사용자(스텟이 전부 0)는 모든 스텟이 0인
    지점에서 가장 가까운 업무로 "정상적으로" 계산되어 버리기 때문에,
    본인도 농부도 의도하지 않은 업무로 조용히 매칭 대기 등록이 될 수 있다.
    (예: 물어보지도 않았는데 '트렉터 운용' 희망자로 등록되어, 정작 농부가
    '밭일' 후보자를 찾을 때는 보이지 않는 문제로 이어짐)
    그래서 매칭 신청 시점에 스텟이 전부 0이면 적성검사부터 완료하도록 막는다.
    """
    stats = extract_stats(user)
    if all(v == 0 for v in stats.values()):
        raise ValueError("적성검사를 먼저 완료해야 매칭을 신청할 수 있습니다.")

    top_task = recommend_farm_task(stats, top_n=1)[0]["task"]
    user.is_seeking = True
    db.commit()
    return top_task


def cancel_match_request(user: User, db: Session) -> None:
    """매칭 대기를 취소하고 싶을 때 (선택적으로 사용)"""
    user.is_seeking = False
    db.commit()


# ---- 4. 농부: 자신의 공고에 맞는 후보자 목록 조회 ----
def get_candidates_for_posting(posting_id: int, db: Session) -> List[Dict]:
    """
    is_seeking=True인 '청년' 사용자들 중, 현재 스텟으로 계산한 추천 업무가
    공고의 task와 일치하는 사람들만 후보자로 반환. 적합도(fit_score)순 정렬.
    """
    posting = db.query(JobPosting).filter(JobPosting.id == posting_id).first()
    if posting is None:
        raise ValueError(f"posting_id={posting_id} 공고가 존재하지 않습니다.")

    seeking_users = (
        db.query(User)
        .filter(User.role == "청년", User.is_seeking == True)  # noqa: E712
        .all()
    )

    ideal_profile = FARM_TASK_PROFILES[posting.task]
    candidates = []
    for user in seeking_users:
        stats = extract_stats(user)
        top_task = recommend_farm_task(stats, top_n=1)[0]["task"]
        if top_task != posting.task:
            continue
        fit_score = math.sqrt(sum((stats[k] - ideal_profile[k]) ** 2 for k in stats))
        candidates.append({"user_id": user.id, "user": user, "stats": stats, "fit_score": fit_score})

    candidates.sort(key=lambda c: c["fit_score"])
    return candidates


# ---- 6. 내 최신 매칭 정보 조회 (홈 화면의 '매칭 연결됨' 표시 / 채팅 입장용) ----
def get_my_latest_match(user: User, db: Session):
    """
    로그인한 사용자(청년 또는 농부) 기준으로 가장 최근에 성사된 매칭 1건을 찾아
    상대방 이름/역할, 매칭된 업무, match_id를 함께 반환.
    매칭이 하나도 없으면 None 반환.
    """
    if user.role == "청년":
        match = (
            db.query(MatchRequest)
            .filter(MatchRequest.employee_id == user.id)
            .order_by(MatchRequest.created_at.desc())
            .first()
        )
        if match is None:
            return None
        posting = db.query(JobPosting).filter(JobPosting.id == match.job_posting_id).first()
        partner = (
            db.query(User).filter(User.id == posting.employer_id).first()
            if posting is not None else None
        )
    else:
        match = (
            db.query(MatchRequest)
            .join(JobPosting, MatchRequest.job_posting_id == JobPosting.id)
            .filter(JobPosting.employer_id == user.id)
            .order_by(MatchRequest.created_at.desc())
            .first()
        )
        if match is None:
            return None
        posting = db.query(JobPosting).filter(JobPosting.id == match.job_posting_id).first()
        partner = db.query(User).filter(User.id == match.employee_id).first()

    return {
        "match_id": match.id,
        "task": posting.task if posting is not None else None,
        "partner_name": partner.name if partner is not None else None,
        "partner_role": partner.role if partner is not None else None,
    }


# ---- 5. 농부: 후보자 선택 -> 매칭 생성 (버튼 클릭 시 호출될 함수) ----
def create_match(posting_id: int, employee_id: int, db: Session) -> int:
    """
    농부가 후보자 목록에서 '매칭' 버튼을 눌렀을 때 호출.
    매칭 생성 전에 공고 상태(마감 여부)와 후보자 자격(매칭 희망 여부, 추천 업무 일치 여부)을 확인.
    """
    posting = db.query(JobPosting).filter(JobPosting.id == posting_id).first()
    if posting is None:
        raise ValueError(f"posting_id={posting_id} 공고가 존재하지 않습니다.")
    if posting.status != "open":
        raise ValueError(f"posting_id={posting_id} 공고는 이미 마감되어 매칭할 수 없습니다.")

    employee = db.query(User).filter(User.id == employee_id).first()
    if employee is None:
        raise ValueError(f"employee_id={employee_id} 사용자를 찾을 수 없습니다.")
    if not employee.is_seeking:
        raise ValueError(f"employee_id={employee_id}는 현재 매칭을 희망하지 않는 상태입니다.")

    employee_stats = extract_stats(employee)
    employee_top_task = recommend_farm_task(employee_stats, top_n=1)[0]["task"]
    if employee_top_task != posting.task:
        raise ValueError(
            f"employee_id={employee_id}의 추천 업무('{employee_top_task}')가 "
            f"공고 업무('{posting.task}')와 일치하지 않습니다."
        )

    match = MatchRequest(job_posting_id=posting_id, employee_id=employee_id, status="matched")
    db.add(match)
    db.commit()
    db.refresh(match)
    return match.id
