"""
AI 분석 모듈
------------------
매칭 시스템에서 AI가 담당하는 부분은 딱 하나입니다:
"1차로 걸러진 후보자들을, 업무 적합도 기준으로 다시 한번 분석해서 순위를 매기는 것"

- 후보자를 걸러내는 것(추천 업무 일치 여부, 매칭 희망 여부)과
  1차 정렬(유클리드 거리)은 matching.py가 결정론적으로 처리합니다.
- 그 결과를 사람이 이해할 문구로 바꾸는 것은 AI가 아니라 TASK_MESSAGE_TEMPLATES(사람이 작성)가 담당합니다.
- AI는 "이미 추려진 후보자들 중 최종 순위를 판단"하는 좁은 역할만 합니다.

필요한 준비물:
    pip install anthropic
    환경변수 ANTHROPIC_API_KEY 설정
"""

import json
import os
from typing import Dict, List

import anthropic

from matching import FARM_TASK_PROFILES
# import psycopg as psycopg2 #추가

client = anthropic.Anthropic()  # ANTHROPIC_API_KEY 환경변수를 자동으로 읽음


SYSTEM_PROMPT = """당신은 농사 업무 배치를 위한 후보자 분석 전문가입니다.
주어진 업무와 후보자들의 스텟을 비교 분석하여, 해당 업무에 가장 적합한 순서대로 후보자의 user_id를 정렬하세요.
설명, 인사말, 부가 텍스트는 절대 포함하지 말고, 반드시 아래 JSON 형식으로만 응답하세요:
{"ranking": [user_id1, user_id2, ...]}
"""


def ai_rank_candidates(task: str, candidates: List[Dict]) -> List[Dict]:
    """
    candidates: matching.get_candidates_for_posting()의 결과
                (이미 유클리드 거리로 1차 정렬되어 있는 상태)
    반환값: AI가 재정렬한 candidates 리스트 (형식은 동일하게 유지)

    AI 응답 파싱에 실패하면, 안전하게 원래(유클리드 거리) 순서를 그대로 반환합니다.
    """
    if not candidates:
        return []

    ideal_profile = FARM_TASK_PROFILES[task]
    candidate_summary = [
        {"user_id": c["user_id"], "stats": c["stats"]} for c in candidates
    ]

    user_prompt = (
        f"업무: {task}\n"
        f"업무에 필요한 이상적인 스텟: {ideal_profile}\n"
        f"후보자 목록: {candidate_summary}"
    )

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=300,
            temperature=0,  # 같은 입력이면 최대한 같은 결과가 나오도록 낮게 설정
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        result_text = response.content[0].text.strip()
        result = json.loads(result_text)
        ranking = result["ranking"]
    except Exception:
        # API 오류, JSON 파싱 실패 등 어떤 이유로든 실패하면
        # 서비스가 멈추지 않도록 기존 유클리드 거리 순서를 그대로 사용
        return candidates

    candidate_map = {c["user_id"]: c for c in candidates}
    ranked = [candidate_map[uid] for uid in ranking if uid in candidate_map]
    # AI가 일부 user_id를 누락시킨 경우, 나머지는 원래 순서 그대로 뒤에 붙임
    remaining = [c for c in candidates if c["user_id"] not in ranking]
    return ranked + remaining


# ---- 사람이 미리 작성해둔 업무별 결과 문구 (AI가 생성하지 않음) ----
TASK_MESSAGE_TEMPLATES = {
    "밭일": "체력과 근성이 강점이신 분께 잘 맞는 업무예요. 꾸준함이 필요한 밭일에서 강점을 발휘하실 수 있어요.",
    "트렉터 운용": "지성과 조작 능력이 중요한 업무예요. 장비를 다루는 데 흥미가 있으신 분께 추천드려요.",
    "물건 나르기": "근력과 체력이 뛰어나신 분께 적합한 업무예요. 몸을 쓰는 일에 자신 있으신 분께 잘 맞아요.",
}


def get_task_message(task: str) -> str:
    return TASK_MESSAGE_TEMPLATES.get(task, "이 업무가 회원님께 추천됩니다.")
