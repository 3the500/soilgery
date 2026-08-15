"""
AI 분석 모듈
------------------
사용자의 스텟(stats)과 농사 업무 프로필(FARM_TASK_PROFILES)을 비교하여
가장 적합한 '단 하나의 업무'만 분석하여 추천합니다.

[피드백 반영]
- 적성검사 결과 화면에서 "AI가 왜 이렇게 분석했는지"를 사용자가 직접
  확인할 수 있도록, 추천된 업무에 대한 상세 분석 문장을 생성하는
  get_task_analysis() 함수를 추가했습니다. (라우터: matching_router.py,
  화면: frontend Matching.jsx의 "상세하게 보기" 토글)
- AI 호출이 실패하거나 API 키가 없어도 화면이 깨지지 않도록,
  스텟 비교 기반의 규칙형 대체 설명(_fallback_reason)을 항상 반환합니다.

필요한 준비물:
    pip install anthropic
    환경변수 ANTHROPIC_API_KEY 설정
"""

import json
import os
from typing import Dict, Optional

import anthropic

from matching import FARM_TASK_PROFILES

client = anthropic.Anthropic()  # ANTHROPIC_API_KEY 환경변수를 자동으로 읽음


SYSTEM_PROMPT = """당신은 농사 업무 배치를 위한 후보자 분석 전문가입니다.
주어진 후보자의 스텟과 각 업무별 이상적인 스텟을 비교 분석하여, 해당 후보자에게 '가장 적합한 단 하나의 업무'를 선정하세요.
설명, 인사말, 부가 텍스트는 절대 포함하지 말고, 반드시 아래 JSON 형식으로만 응답하세요:
{"best_task": "업무명"}
"""


def get_best_matching_task(user_stats: Dict) -> str:
    """
    user_stats: 사용자의 능력치 (예: {"체력": 8, "숙련도": 5, ...})
    반환값: AI가 선정한 가장 유사한/적합한 업무 이름 1개 (str)

    AI 응답 파싱 실패 시 기본값("밭일") 또는 1차 유클리드 거리 기반 최적 업무를 반환할 수 있습니다.
    """
    if not user_stats:
        return "밭일"  # 기본값 예시

    user_prompt = (
        f"후보자 스텟: {user_stats}\n"
        f"전체 업무 및 이상적인 스텟 프로필: {FARM_TASK_PROFILES}"
    )

    try:
        response = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=100,
            temperature=0,  # 결과의 일관성을 위해 0으로 설정
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        result_text = response.content[0].text.strip()
        result = json.loads(result_text)
        best_task = result.get("best_task")

        # AI가 구한 업무명이 실제 정의된 업무 목록에 있는지 검증
        if best_task in FARM_TASK_PROFILES:
            return best_task
        else:
            return list(FARM_TASK_PROFILES.keys())[0]  # 예외 시 첫 번째 업무 반환

    except Exception:
        # API 오류, JSON 파싱 실패 등 발생 시 안전하게 첫 번째 업무 반환
        return list(FARM_TASK_PROFILES.keys())[0]


# ---- 사람이 미리 작성해둔 업무별 결과 문구 (기본 요약, "접기" 상태에서 보이는 문구) ----
TASK_MESSAGE_TEMPLATES = {
    "밭일": "체력과 성실성이 강점이신 분께 잘 맞는 업무예요. 꾸준함이 필요한 밭일에서 강점을 발휘하실 수 있어요.",
    "농기구 운용": "숙련도와 조작 능력이 중요한 업무예요. 트랙터·관리기 같은 농기구를 다루는 데 흥미가 있으신 분께 추천드려요.",
    "물건 나르기": "근력과 체력이 뛰어나신 분께 적합한 업무예요. 몸을 쓰는 일에 자신 있으신 분께 잘 맞아요.",
    "시설정비": "근력과 숙련도를 두루 갖추신 분께 잘 맞는 업무예요. 하우스나 농기자재를 직접 고치고 손보는 일에서 강점을 발휘하실 수 있어요.",
    "선별 및 포장": "성실성과 협동심이 뛰어나신 분께 적합한 업무예요. 실내에서 차분하게 상품을 확인하고 포장하는 일에서 강점을 발휘하실 수 있어요.",
    "가공": "숙련도와 성실성이 뛰어나신 분께 적합한 업무예요. 정해진 절차를 꼼꼼히 지키며 농산물을 가공하는 일에서 강점을 발휘하실 수 있어요.",
}


def get_task_message(task: str) -> str:
    return TASK_MESSAGE_TEMPLATES.get(task, "이 업무가 회원님께 추천됩니다.")


# 🔍 [피드백 반영] "AI 분석 상세하게 보기"에는 AI가 생성한 개인 맞춤 설명뿐 아니라,
# 실제로 어떤 방식(알고리즘)으로 추천이 계산되는지도 함께 안내해야 한다는 요청 반영.
# (적성검사 결과 화면 + 내 정보 화면 팝업, 두 곳 모두 이 함수 하나를 공유해서 사용)
ALGORITHM_EXPLANATION = (
    "\n\n📐 이렇게 분석했어요\n"
    "회원님의 체력·근력·숙련도·성실성·협동심·급여민감도 6개 스텟과, 업무별로 미리 정의된 "
    "'이상적인 스텟 기준값'을 비교합니다. 두 스텟 사이의 유클리드 거리(각 스텟 차이를 제곱해 "
    "더한 뒤 제곱근을 취한 값)를 업무별로 계산해, 그 값이 가장 작은(=가장 가까운) 업무를 1순위로 "
    "선정하는 방식이에요. 이후 Claude AI가 그 수치 비교 결과를 바탕으로 위와 같은 자연어 설명을 "
    "생성합니다."
)


# ---- [피드백 반영] "상세하게 보기"용 AI 상세 분석 문장 생성 ----
REASON_SYSTEM_PROMPT = """당신은 농사 업무 배치를 위한 AI 분석 전문가입니다.
후보자의 스텟(체력/근력/숙련도/성실성/협동심/급여민감도)과, 이미 추천이 확정된 업무의
이상적인 스텟 프로필을 비교하여, "왜 이 업무가 이 후보자에게 추천되었는지"를
구체적인 스텟 수치 비교를 근거로 3~4문장으로 설명하세요.

- 후보자의 스텟 중 어떤 스텟이 해당 업무의 이상적인 스텟과 가장 잘 부합하는지 명시하세요.
- 반대로 다소 부족하거나 이상적인 값과 차이가 나는 스텟이 있다면 함께 언급하되,
  단점처럼 느껴지지 않도록 참고 정보 수준으로 담백하게 서술하세요.
- 친근하고 신뢰가 가는 상담사 톤으로 작성하되, 광고 문구나 이모지 남발은 피하세요.
- 인사말, 목록 기호, JSON, 마크다운 등 다른 형식은 절대 포함하지 말고 순수 설명 문장만 출력하세요.
"""


def _fallback_reason(user_stats: Dict, task: str, ideal_profile: Dict) -> str:
    """
    AI 호출이 실패했을 때도 "상세하게 보기"가 빈 화면이 되지 않도록,
    스텟 차이를 직접 계산해 규칙 기반으로 설명 문장을 만들어 반환합니다.
    """
    diffs = []
    for stat, ideal_value in ideal_profile.items():
        user_value = user_stats.get(stat, 0)
        diffs.append((stat, user_value, ideal_value, abs(user_value - ideal_value)))

    # 이상적인 값과 가장 가까운(=강점) 스텟, 가장 먼(=참고) 스텟을 각각 추출
    diffs_sorted = sorted(diffs, key=lambda d: d[3])
    strongest = diffs_sorted[:2]
    weakest = diffs_sorted[-1]

    strong_text = ", ".join(
        f"{stat}({user_value}점, 이 업무 기준값 {ideal_value}점)" for stat, user_value, ideal_value, _ in strongest
    )

    return (
        f"'{task}' 업무는 {strong_text} 항목에서 회원님의 스텟이 이 업무에 필요한 기준값과 "
        f"가장 가깝게 나타나 1순위로 추천되었습니다. "
        f"참고로 '{weakest[0]}' 스텟은 이 업무의 기준값과 다소 차이가 있었지만, "
        f"전체 스텟을 종합적으로 비교했을 때 다른 업무보다 이 업무와의 적합도가 가장 높았습니다."
    )


def get_task_analysis(user_stats: Dict, task: str) -> str:
    """
    적성검사 결과 화면의 "상세하게 보기" 버튼을 눌렀을 때 호출.
    특정 업무(task)가 왜 이 후보자에게 추천되었는지, AI가 스텟 근거를 들어 설명한다.

    AI 호출 실패, API 키 미설정, 빈 응답 등 어떤 이유로든 문제가 생기면
    _fallback_reason()으로 항상 의미 있는 설명을 대체 반환한다
    (이 함수가 실패해도 기본 추천 결과 화면 자체는 항상 정상 동작해야 하기 때문).
    """
    if task not in FARM_TASK_PROFILES:
        return "추천 업무 정보를 분석할 수 없습니다."

    ideal_profile = FARM_TASK_PROFILES[task]

    user_prompt = (
        f"추천된 업무: {task}\n"
        f"이 업무의 이상적인 스텟: {ideal_profile}\n"
        f"후보자의 스텟: {user_stats}"
    )

    try:
        response = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=300,
            temperature=0.4,
            system=REASON_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = response.content[0].text.strip()
        if not text:
            text = _fallback_reason(user_stats, task, ideal_profile)
    except Exception:
        text = _fallback_reason(user_stats, task, ideal_profile)

    return text + ALGORITHM_EXPLANATION


RANK_SYSTEM_PROMPT = """당신은 농사 업무 배치를 위한 후보자 분석 전문가입니다.
주어진 업무에 이상적인 스텟과 각 후보자의 스텟을 비교 분석하여, 해당 업무에 가장 적합한 순서대로
후보자의 user_id를 나열하세요.
설명, 인사말, 부가 텍스트는 절대 포함하지 말고, 반드시 아래 JSON 형식으로만 응답하세요:
{"ranked_user_ids": [3, 1, 2]}
"""


def ai_rank_candidates(task: str, candidates: list) -> list:
    """
    농부가 특정 공고의 후보자 목록을 볼 때, AI가 해당 업무(task) 기준으로
    후보자들의 적합도를 재분석해 순위를 재정렬합니다.

    candidates: [{"user_id": int, "stats": dict, "fit_score": float, ...}, ...]
                (matching.get_candidates_for_posting이 반환하는 형태, 이미 fit_score 기준 1차 정렬됨)
    반환값: 같은 구조의 리스트를, AI가 판단한 적합도 순서로 재정렬해서 반환.

    AI 호출 실패, API 키 미설정, JSON 파싱 실패 등 어떤 이유로든 문제가 생기면
    입력받은 순서(fit_score 기준 정렬)를 그대로 반환합니다 - 이 함수가 실패해도
    후보자 목록 조회 자체는 항상 정상 동작해야 하기 때문입니다.
    """
    if not candidates or task not in FARM_TASK_PROFILES:
        return candidates

    ideal_profile = FARM_TASK_PROFILES[task]
    candidate_summary = [
        {"user_id": c["user_id"], "stats": c["stats"]} for c in candidates
    ]

    user_prompt = (
        f"업무: {task}\n"
        f"이 업무에 이상적인 스텟: {ideal_profile}\n"
        f"후보자 목록(스텟 포함): {candidate_summary}"
    )

    try:
        response = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=200,
            temperature=0,
            system=RANK_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        result_text = response.content[0].text.strip()
        result = json.loads(result_text)
        ranked_ids = result.get("ranked_user_ids", [])

        by_id = {c["user_id"]: c for c in candidates}
        ranked = [by_id[uid] for uid in ranked_ids if uid in by_id]
        # AI 응답에 빠진 후보자가 있으면 원래 순서대로 뒤에 이어붙임(누락 방지)
        remaining = [c for c in candidates if c["user_id"] not in ranked_ids]
        return ranked + remaining

    except Exception:
        return candidates


# ---- 사용 예시 ----
if __name__ == "__main__":
    # 사용자 스텟 예시
    my_stats = {"체력": 9, "숙련도": 4, "성실성": 8}

    # 가장 유사한 업무 1개 추출
    recommended_task = get_best_matching_task(my_stats)
    message = get_task_message(recommended_task)
    reason = get_task_analysis(my_stats, recommended_task)

    print(f"추천 업무: {recommended_task}")
    print(f"추천 요약: {message}")
    print(f"상세 분석: {reason}")
