"""
적성검사 로직
------------------
6개의 예/아니요 질문에 대한 답변으로 사용자의 "농업 특화 스텟"
(체력/근력/숙련도/성실성/협동심/급여민감도)을 계산하고,
backend/database.py 의 User 모델(SQLAlchemy)에 반영합니다.

[피드백 반영]
- 기존의 다소 추상적인 RPG풍 스텟명(근력/체력/근성/지성/급여/성격)을
  실제 농촌 소일거리 현장에서 의미가 분명한 6가지 스텟으로 교체했습니다.
  (DB 컬럼명 자체는 strength/stamina/grit/intelligence/wage_pref/personality
  그대로 유지하여, 기존 데이터/스키마는 마이그레이션 없이 그대로 사용합니다.
  즉, "라벨(한글 이름)"만 농업 현장에 맞게 구체화한 것에 가깝습니다.)
    · 체력       (stamina)      : 장시간 야외 작업을 버티는 지구력
    · 근력       (strength)     : 무거운 농산물/자재를 나르고 힘을 쓰는 능력
    · 숙련도     (intelligence) : 농기계 조작, 재배 기술 등 새 지식을 습득하는 능력
    · 성실성     (grit)         : 반복적인 작업도 꾸준히 해내는 근면함
    · 협동심     (personality)  : 동료 농부/청년과 손발을 맞춰 협업하는 능력
    · 급여민감도 (wage_pref)    : 근무 조건보다 급여 수준을 우선시하는 정도

- 질문 문구를 실제 농촌 작업 현장(밭일, 하우스, 농기계, 상하차 등)에 맞춰
  구체적으로 다시 작성했습니다.
- 답변별 스텟 점수 폭을 기존(-2~3)보다 넓혀(-4~6) 검사 결과 간 편차가
  더 뚜렷하게 드러나도록 조정했습니다.

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

# ---- 1. 스텟 정의 (농업 특화 한글 스텟명 -> User 모델의 실제 컬럼명) ----
STAT_COLUMN_MAP = {
    "체력": "stamina",
    "근력": "strength",
    "숙련도": "intelligence",
    "성실성": "grit",
    "협동심": "personality",
    "급여민감도": "wage_pref",
}
STATS = list(STAT_COLUMN_MAP.keys())


# ---- 2. 질문 정의 ----
# 각 질문은 실제 농촌 소일거리 현장 상황에 맞춰 구체적으로 작성되었으며,
# "예" / "아니요" 선택에 따라 각 스텟에 주는 가중치(-4~6)를 가짐.
# (하나의 질문이 주 스텟 1개 + 보조 스텟 1개에 영향을 주도록 구성하여
#  6문항만으로도 스텟 간 편차가 뚜렷하게 나타나도록 설계)
QUESTIONS: List[Dict] = [
    {
        "id": "q1",
        "text": "하루 6시간 이상 밭이나 비닐하우스에서 서서 움직이는 작업도 크게 무리 없이 해내실 수 있나요?",
        "예": {"체력": 6, "성실성": 2},
        "아니요": {"체력": -4, "숙련도": 2},
    },
    {
        "id": "q2",
        "text": "20kg 안팎의 농산물 상자나 비료 포대를 직접 들어서 옮기는 작업도 할 수 있으신가요?",
        "예": {"근력": 6, "체력": 2},
        "아니요": {"근력": -4, "협동심": 1},
    },
    {
        "id": "q3",
        "text": "농기계(트랙터, 관리기 등) 조작법이나 새로운 재배·수확 기술을 배우는 데 흥미가 있으신가요?",
        "예": {"숙련도": 6, "성실성": 1},
        "아니요": {"숙련도": -3, "근력": 1},
    },
    {
        "id": "q4",
        "text": "솎아내기·포장·수확처럼 같은 동작을 몇 시간이고 반복해도 꾸준히 집중해서 해낼 수 있나요?",
        "예": {"성실성": 6, "체력": 1},
        "아니요": {"성실성": -3, "숙련도": 1},
    },
    {
        "id": "q5",
        "text": "처음 만나는 농가 어르신이나 동료 청년과 손발을 맞춰가며 함께 작업하는 것이 편하신가요?",
        "예": {"협동심": 6, "성실성": 1},
        "아니요": {"협동심": -3, "숙련도": 1},
    },
    {
        "id": "q6",
        "text": "급여 조건이 다소 낮더라도, 집에서 가깝거나 근무 환경이 편하다면 지원할 의향이 있으신가요?",
        "예": {"급여민감도": -4, "협동심": 1},
        "아니요": {"급여민감도": 5, "숙련도": 1},
    },
]


# ---- 3. 답변 -> 스텟 계산 (순수 함수, DB 접근 없음. 기존과 동일) ----
def compute_stats(answers: Dict[str, str]) -> Dict[str, int]:
    """
    answers: {"q1": "예", "q2": "아니요", ...} 형태의 사용자 응답
    반환값: {"체력": 8, "근력": 5, "숙련도": -2, "성실성": 6, "협동심": 3, "급여민감도": -3} 형태의 최종 스텟
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
    [요구사항 반영] 적성검사 진행 시 기존 스텟을 0으로 완벽히 초기화한 다음
    새로운 검사 결과를 반영합니다. (음수 방지 max(0, v) 처리)
    """
    # 1. 사용자 기존 모든 스텟 0으로 완전 초기화
    for col in STAT_COLUMN_MAP.values():
        setattr(user, col, 0)
    db.commit()

    # 2. 새로운 응답에 따른 스텟 계산
    stats = compute_stats(answers)

    # 3. 0부터 계산된 결과 반영 (최소 0 보장)
    final_stats = {}
    for korean_stat, value in stats.items():
        column_name = STAT_COLUMN_MAP[korean_stat]
        positive_val = max(0, value)
        setattr(user, column_name, positive_val)
        final_stats[korean_stat] = positive_val

    db.commit()
    db.refresh(user)
    return final_stats
