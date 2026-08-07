"""
AI 상담사 모듈
------------------
1. 선택형 문의 (FAQ): 사용자가 화면에서 미리 정해진 질문 중 하나를 선택.
   -> AI를 호출하지 않고, 사람이 미리 작성해둔 "모범 답안"을 그대로 반환.

2. 자유 질문: 사용자가 직접 텍스트로 입력.
   -> AI(Claude API)가 FAQ 및 서비스 정보를 참고해 답변.
   -> "신고"로 판단되면 DB(Report)에 접수 후 안내 문구 반환.
"""

import json
from typing import Dict, List

import anthropic
from sqlalchemy.orm import Session

from models import Report

client = anthropic.Anthropic()  # ANTHROPIC_API_KEY 환경변수를 자동으로 읽음


# ---- 1. 선택형 문의: 확장된 FAQ 목록 ----
FAQS = [
    {
        "id": "faq_matching",
        "question": "매칭은 어떻게 이루어지나요?",
        "answer": (
            "적성검사 결과로 추천받은 업무에 대해 '매칭 원해요'를 누르시면, "
            "그 업무를 필요로 하는 농부님들의 후보자 목록에 노출됩니다. "
            "농부님이 후보자 중 원하는 분을 선택하면 매칭이 성사돼요."
        ),
    },
    {
        "id": "faq_retest",
        "question": "적성검사를 다시 보고 싶어요.",
        "answer": (
            "적성검사는 상단 메뉴의 '적성검사' 탭에서 언제든지 다시 응시하실 수 있어요. "
            "재검사를 완료하면 이전 결과는 새 결과로 갱신되고, 추천 업무도 다시 계산됩니다."
        ),
    },
    {
        "id": "faq_cancel_match",
        "question": "매칭 대기를 취소하고 싶어요.",
        "answer": (
            "매칭 메뉴에서 '매칭 대기 취소' 버튼을 누르시면 더 이상 농부님들의 후보자 "
            "목록에 노출되지 않습니다. 언제든 다시 매칭을 신청하실 수 있어요."
        ),
    },
    {
        "id": "faq_wage_chat",
        "question": "급여 조건 및 근무 시간은 어떻게 확인하나요?",
        "answer": (
            "근무 조건 및 급여는 농가 공고별로 상이하며, "
            "농부님과 매칭이 완료된 후 생성되는 1:1 대화방(채팅)에서 자세히 협의하실 수 있습니다."
        ),
    },
    {
        "id": "faq_no_response",
        "question": "매칭된 상대방이 채팅에 답이 없어요.",
        "answer": (
            "채팅으로 며칠간 응답이 없다면 상대방의 닉네임과 함께 아래에 문의 내용을 남겨주시면 "
            "담당자가 확인 후 안내해드릴게요."
        ),
    },
]


def get_faq_list() -> List[Dict]:
    """화면에 보여줄 FAQ 질문 목록 (답변 제외, 선택용)"""
    return [{"id": f["id"], "question": f["question"]} for f in FAQS]


def get_faq_answer(faq_id: str) -> str:
    """사용자가 FAQ 항목을 선택했을 때, 미리 작성된 모범 답안을 그대로 반환"""
    for f in FAQS:
        if f["id"] == faq_id:
            return f["answer"]
    raise ValueError(f"'{faq_id}'에 해당하는 FAQ가 없습니다.")


# ---- 2. 자유 질문: AI 분석 ----
_FAQ_CONTEXT = "\n".join(f"- {f['question']}: {f['answer']}" for f in FAQS)

SYSTEM_PROMPT = f"""당신은 '충북 농촌 소일거리 매칭 플랫폼'의 AI 1:1 상담사입니다.

[서비스 주요 내용]
1. 적성검사: 6가지 예/아니요 질문을 통해 사용자의 스텟(근력, 체력, 근성, 지성, 급여, 성격)을 측정합니다.
2. 매칭 시스템: 청년은 스텟 기반 업무 추천을 받고 매칭 대기를 신청합니다. 농부는 업무별 후보자를 조회하여 원하는 청년과 매칭(1:1 채팅방 개설)을 진행합니다.
3. 급여/근무조건: 공고 정보 및 매칭 후 1:1 채팅을 통해 농부와 청년이 직접 상의합니다.
4. 역할 구분: '청년(구직자)'과 '농부(구인자)' 두 가지 역할로 회원가입 및 이용이 가능합니다.

[자주 묻는 질문(FAQ)]
{_FAQ_CONTEXT}

[답변 지침]
- 사용자가 질문을 하면 위 서비스 내용 및 FAQ를 바탕으로 친절하고 명확하게 답변하세요.
- 답변은 가급적 핵심만 2~3문장 이내로 작성하세요.
- 인사말(예: 안녕, 반가워 등)에는 친근하게 인사를 건네고 서비스 소개를 해주세요.
- 만약 사용자가 폭언, 사기, 노쇼, 금전 요구, 성희롱, 불공정 거래 등 "신고"에 해당하는 내용을 전달하면, 직접 처리하려 하지 말고 반드시 아래 JSON 형식으로만 응답하세요:
{{"type": "report", "category": "짧은 분류명(예: 노쇼/사기/폭언 등)", "summary": "신고 내용 한 줄 요약", "severity": "low|medium|high"}}

- 신고가 아닌 일반 문의/질문에는 자연스러운 일반 텍스트(JSON 금지)로 답변하세요.
"""


def save_report(user_id: int, category: str, summary: str, severity: str, db: Session) -> int:
    """AI가 신고로 분류한 내용을 사람이 검토할 수 있도록 DB에 접수만 함"""
    report = Report(
        user_id=user_id,
        category=category,
        summary=summary,
        severity=severity,
        status="pending",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report.id


def ask_ai(user_id: int, message: str, db: Session) -> Dict:
    """
    사용자가 자유롭게 입력한 질문을 AI가 분석해서 답변.
    """
    try:
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",  # 안정적인 최신 Claude 3.5 Sonnet 모델 사용
            max_tokens=500,
            temperature=0.3,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": message}],
        )
        text = response.content[0].text.strip()
    except Exception as e:
        print("Claude API 호출 실패:", e)
        return {
            "type": "answer",
            "message": "일시적으로 답변을 가져오지 못했어요. 잠시 후 다시 시도해주세요.",
        }

    # 신고(JSON) 처리 검증
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict) and parsed.get("type") == "report":
            report_id = save_report(
                user_id=user_id,
                category=parsed.get("category", "미분류"),
                summary=parsed.get("summary", message),
                severity=parsed.get("severity", "low"),
                db=db,
            )
            return {
                "type": "report",
                "message": (
                    "🚨 신고가 접수되었습니다. 담당자가 내용 확인 후 조치할 예정이에요. "
                    f"(접수번호: {report_id})"
                ),
            }
    except (json.JSONDecodeError, TypeError):
        pass

    return {"type": "answer", "message": text}