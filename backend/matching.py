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
# [피드백 반영] aptitude_test.py의 새 농업 특화 스텟(체력/근력/숙련도/성실성/협동심/급여민감도)
# 명칭 및 확대된 점수 폭(-4~6)에 맞춰 업무별 이상적인 스텟 프로필도 함께 조정했습니다.
# [직무 개편 반영] 기존 "트렉터 운용"은 "농기구 운용"으로 이름을 변경했고,
# 시설정비 / 선별 및 포장 / 가공 3개 직무를 새로 추가했습니다.
FARM_TASK_PROFILES = {
    "밭일": {"근력": 4, "체력": 9, "숙련도": 1, "성실성": 9, "협동심": 3, "급여민감도": 1},
    "농기구 운용": {"근력": 3, "체력": 3, "숙련도": 8, "성실성": 5, "협동심": 2, "급여민감도": 4},
    "물건 나르기": {"근력": 9, "체력": 8, "숙련도": 0, "성실성": 4, "협동심": 1, "급여민감도": 3},
    "시설정비": {"근력": 6, "체력": 6, "숙련도": 7, "성실성": 5, "협동심": 2, "급여민감도": 3},
    "선별 및 포장": {"근력": 2, "체력": 4, "숙련도": 3, "성실성": 8, "협동심": 6, "급여민감도": 2},
    "가공": {"근력": 3, "체력": 4, "숙련도": 6, "성실성": 7, "협동심": 3, "급여민감도": 3},
}


# ---- 1-1. 업무별 스텟 가중치 (배점 차등) ----
# [피드백 반영] 기존에는 모든 스텟을 동일한 비중(단순 유클리드 거리)으로 비교하다 보니,
# 서로 다른 스텟 패턴을 가진 두 후보자라도 "전체 오차 합"이 우연히 같으면 AI 추천
# 점수가 똑같이 나오는 문제가 있었습니다. (예: 체력·근력이 강점인 후보자와 성실성·
# 협동심이 강점인 후보자가 같은 점수로 나오는 등)
# 이를 해결하기 위해, 각 업무(FARM_TASK_PROFILES)에서 이상적인 스텟 값이 높을수록
# "그 업무에서 더 중요하게 보는 스텟"으로 간주하여 순위를 매기고, 순위가 높은 스텟일수록
# 후보자와의 차이가 점수에 더 크게 반영되도록 가중치를 차등 적용했습니다.
# (업무별 이상적인 프로필이 바뀌어도 가중치가 그에 맞춰 자동으로 재계산됩니다.)
_STAT_RANK_WEIGHTS = [3.0, 2.2, 1.6, 1.2, 1.0, 0.8]  # 1순위~6순위 스텟 가중치(내림차순)


def _build_task_weights(profile: Dict[str, int]) -> Dict[str, float]:
    """이상적인 스텟 값이 큰 순서대로 _STAT_RANK_WEIGHTS를 매겨 업무별 가중치를 만든다."""
    ranked = sorted(profile.items(), key=lambda kv: kv[1], reverse=True)
    return {stat: _STAT_RANK_WEIGHTS[i] for i, (stat, _) in enumerate(ranked)}


TASK_STAT_WEIGHTS: Dict[str, Dict[str, float]] = {
    task: _build_task_weights(profile) for task, profile in FARM_TASK_PROFILES.items()
}


def compute_fit_score(user_stats: Dict[str, int], task: str) -> float:
    """
    특정 업무(task)를 기준으로, 후보자 스텟과 이상적인 스텟 프로필 사이의
    가중 거리를 계산한다. (값이 작을수록 그 업무에 적합)
    업무별로 중요하게 보는 스텟일수록 TASK_STAT_WEIGHTS의 가중치가 커서,
    그 스텟의 차이가 fit_score에 더 크게 반영된다.
    """
    profile = FARM_TASK_PROFILES[task]
    weights = TASK_STAT_WEIGHTS[task]
    return math.sqrt(
        sum(weights[stat] * (user_stats[stat] - ideal) ** 2 for stat, ideal in profile.items())
    )


# ---- 2. 스텟 기반 최적 업무 추천 (업무별 가중 거리 기반) ----
def recommend_farm_task(user_stats: Dict[str, int], top_n: int = 1) -> List[Dict]:
    """
    user_stats: {"근력": 5, "체력": 7, ...} 형태
    반환값: [{"task": "밭일", "distance": 3.2}, ...] 거리가 작을수록 적합
    (거리는 업무별 TASK_STAT_WEIGHTS가 반영된 가중 거리)
    """
    scored = [
        {"task": task, "distance": compute_fit_score(user_stats, task)}
        for task in FARM_TASK_PROFILES
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
    (예: 물어보지도 않았는데 '농기구 운용' 희망자로 등록되어, 정작 농부가
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

    candidates = []
    for user in seeking_users:
        stats = extract_stats(user)
        if all(v == 0 for v in stats.values()):
            continue  # 적성검사 미완료(스텟 전부 0) 청년은 후보에서 제외
        top_task = recommend_farm_task(stats, top_n=1)[0]["task"]
        if top_task != posting.task:
            continue
        fit_score = compute_fit_score(stats, posting.task)
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


# ---- 7. 내 채팅방(매칭) 전체 목록 조회 ----
def get_my_matches(user: User, db: Session) -> List[Dict]:
    """
    로그인한 사용자(청년 또는 농부) 기준으로 "본인이 아직 나가지 않은" 채팅방을
    전부 반환한다. (get_my_latest_match와 달리 최신 1건이 아니라 전체 목록)

    예: 농부가 청년1과 대화 중에 청년2와도 매칭되어도, 청년1이 채팅을 나가지 않는
    한 농부 목록에는 청년1·청년2와의 채팅방이 모두 남아 있어야 한다.
    """
    if user.role == "청년":
        matches = (
            db.query(MatchRequest)
            .filter(MatchRequest.employee_id == user.id, MatchRequest.employee_left == False)  # noqa: E712
            .order_by(MatchRequest.created_at.desc())
            .all()
        )
    else:
        matches = (
            db.query(MatchRequest)
            .join(JobPosting, MatchRequest.job_posting_id == JobPosting.id)
            .filter(JobPosting.employer_id == user.id, MatchRequest.employer_left == False)  # noqa: E712
            .order_by(MatchRequest.created_at.desc())
            .all()
        )

    results = []
    for match in matches:
        posting = db.query(JobPosting).filter(JobPosting.id == match.job_posting_id).first()
        if user.role == "청년":
            partner = db.query(User).filter(User.id == posting.employer_id).first() if posting else None
            partner_left = match.employer_left
        else:
            partner = db.query(User).filter(User.id == match.employee_id).first()
            partner_left = match.employee_left

        results.append({
            "match_id": match.id,
            "task": posting.task if posting is not None else None,
            "partner_name": partner.name if partner is not None else None,
            "partner_role": partner.role if partner is not None else None,
            "partner_left": bool(partner_left),
            "created_at": match.created_at,
        })

    return results


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
