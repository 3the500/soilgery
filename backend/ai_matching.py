"""
AI 분석 모듈
------------------
사용자의 스텟(stats)과 농사 업무 프로필(FARM_TASK_PROFILES)을 비교하여
가장 적합한 '단 하나의 업무'만 분석하여 추천합니다.

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
    user_stats: 사용자의 능력치 (예: {"체력": 80, "지성": 50, ...})
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
            model="claude-sonnet-4-6",
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


# ---- 사람이 미리 작성해둔 업무별 결과 문구 ----
TASK_MESSAGE_TEMPLATES = {
    "밭일": "체력과 근성이 강점이신 분께 잘 맞는 업무예요. 꾸준함이 필요한 밭일에서 강점을 발휘하실 수 있어요.",
    "트렉터 운용": "지성과 조작 능력이 중요한 업무예요. 장비를 다루는 데 흥미가 있으신 분께 추천드려요.",
    "물건 나르기": "근력과 체력이 뛰어나신 분께 적합한 업무예요. 몸을 쓰는 일에 자신 있으신 분께 잘 맞아요.",
}


def get_task_message(task: str) -> str:
    return TASK_MESSAGE_TEMPLATES.get(task, "이 업무가 회원님께 추천됩니다.")


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
            model="claude-sonnet-4-6",
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
    my_stats = {"체력": 90, "지성": 40, "근성": 85}

    # 가장 유사한 업무 1개 추출
    recommended_task = get_best_matching_task(my_stats)
    message = get_task_message(recommended_task)

    print(f"추천 업무: {recommended_task}")
    print(f"추천 이유: {message}")