"""
적성검사 로직
------------------
6개의 예/아니요 질문에 대한 답변으로 사용자 스텟(근력/체력/근성/지성/급여/성격)을 계산하고,
backend/database.py 의 User 모델(SQLAlchemy)에 반영합니다.

[변경 사항 - soilgery 프로젝트 구조에 맞춰 수정]
- pymysql/raw SQL 대신 SQLAlchemy ORM 사용
- 별도 user_stats 테이블이 아니라, 이미 database.py의 User 테이블에 있는
  strength/stamina/grit/intelligence/wage_pref/personality 컬럼을 그대로 사용
- user_id를 직접 받아 DB를 조회하는 대신, 로그인된 User 객체(JWT 인증으로 식별된)를
  파라미터로 받아서 처리 (라우터에서 Depends(get_current_user)로 얻은 값을 그대로 전달)

이 파일은 backend/ 폴더 안에 두어야 합니다 (같은 경로의 database.py를 import하므로).
"""

from typing import Dict, List

from sqlalchemy.orm import Session

from database import User
# import psycopg as psycopg2 #추가

# ---- 1. 스텟 정의 (한글 스텟명 -> User 모델의 실제 컬럼명) ----
STAT_COLUMN_MAP = {
    "근력": "strength",
    "체력": "stamina",
    "근성": "grit",
    "지성": "intelligence",
    "급여": "wage_pref",
    "성격": "personality",
}
STATS = list(STAT_COLUMN_MAP.keys())


# ---- 2. 질문 정의 ----
# 각 질문은 "예" / "아니요" 선택에 따라 각 스텟에 주는 가중치(-1~3)를 가짐
QUESTIONS: List[Dict] = [
    {
        "id": "q1",
        "text": "활동적인 일을 좋아하시나요?",
        "예": {"근력": 3, "체력": 3, "성격": 1},
        "아니요": {"지성": 2, "성격": -1},
    },
    {
        "id": "q2",
        "text": "높은 급여보다 편한 근무를 더 중요하게 생각하시나요?",
        "예": {"급여": -2, "성격": 1},
        "아니요": {"급여": 2, "근성": 1},
    },
    {
        "id": "q3",
        "text": "반복적인 작업도 꾸준히 잘 해내는 편인가요?",
        "예": {"근성": 3, "체력": 1},
        "아니요": {"지성": 1, "성격": 1},
    },
    {
        "id": "q4",
        "text": "새로운 사람을 만나고 대화하는 걸 좋아하시나요?",
        "예": {"성격": 3},
        "아니요": {"지성": 1, "근성": 1},
    },
    {
        "id": "q5",
        "text": "머리를 쓰는 복잡한 업무를 선호하시나요?",
        "예": {"지성": 3, "근력": -1},
        "아니요": {"근력": 1, "체력": 1},
    },
    {
        "id": "q6",
        "text": "몸이 힘든 일이어도 참고 견딜 수 있나요?",
        "예": {"근성": 2, "체력": 2},
        "아니요": {"지성": 1, "급여": 1},
    },
]


# ---- 3. 답변 -> 스텟 계산 (순수 함수, DB 접근 없음. 기존과 동일) ----
def compute_stats(answers: Dict[str, str]) -> Dict[str, int]:
    """
    answers: {"q1": "예", "q2": "아니요", ...} 형태의 사용자 응답
    반환값: {"근력": 5, "체력": 8, "근성": 6, "지성": 2, "급여": 3, "성격": 1} 형태의 최종 스텟
    """
    stats = {s: 0 for s in STATS}

    for question in QUESTIONS:
        q_id = question["id"]
        choice = answers.get(q_id)

        if choice not in ("예", "아니요"):
            raise ValueError(
                f"'{q_id}'에 대한 응답이 올바르지 않습니다. '예' 또는 '아니요'만 가능합니다. (입력값: {choice})"
            )

        deltas = question[choice]
        for stat, value in deltas.items():
            stats[stat] += value

    return stats


# ---- 4. User 객체 <-> 한글 스텟 딕셔너리 변환 ----
def extract_stats(user: User) -> Dict[str, int]:
    """
    이미 조회된(또는 Depends(get_current_user)로 얻은) User 객체에서
    현재 스텟을 한글 키 딕셔너리로 꺼냄. 별도 DB 조회 없음.
    """
    return {korean: getattr(user, column) for korean, column in STAT_COLUMN_MAP.items()}


# ---- 5. 검사 결과를 User 레코드에 반영 ----
def submit_aptitude_test(user: User, answers: Dict[str, str], db: Session) -> Dict[str, int]:
    """
    로그인된 사용자가 적성검사에 응답했을 때 호출.
    (라우터에서: user = Depends(get_current_user), db = Depends(get_db) 로 얻은 값을 그대로 전달)

    계산된 스텟을 User 레코드에 반영하고 커밋합니다.
    재검사 시에도 이전 값을 새 결과로 덮어씁니다.
    """
    stats = compute_stats(answers)

    for korean_stat, value in stats.items():
        column_name = STAT_COLUMN_MAP[korean_stat]
        setattr(user, column_name, value)

    db.commit()
    db.refresh(user)
    return stats
