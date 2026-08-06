"""
AI 상담사 모듈
------------------
두 가지 경로로 나뉩니다.

1. 선택형 문의 (FAQ): 사용자가 화면에서 미리 정해진 질문 중 하나를 선택.
   -> AI를 호출하지 않고, 사람이 미리 작성해둔 "모범 답안"을 그대로 반환.

2. 자유 질문: 사용자가 직접 텍스트로 입력.
   -> AI(Claude API)가 FAQ 내용을 참고해서 가장 가까운 답을 판단해 답변.
   -> "신고"로 판단되면 사람이 검토할 수 있도록 DB에 접수만 하고, AI가 임의로 조치하지 않음.

[변경 사항 - soilgery 프로젝트 구조에 맞춰 수정]
- pymysql/raw SQL 대신 SQLAlchemy ORM 사용 (models.Report)

필요한 준비물:
    pip install anthropic
    환경변수 ANTHROPIC_API_KEY 설정
"""

import json
from typing import Dict, List

import anthropic
from sqlalchemy.orm import Session

from models import Report
# import psycopg as psycopg2 #추가

client = anthropic.Anthropic()  # ANTHROPIC_API_KEY 환경변수를 자동으로 읽음


# ---- 1. 선택형 문의: 사람이 미리 작성한 FAQ와 모범 답안 ----
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
            "적성검사는 다시 응시하실 수 있어요. 재검사를 완료하면 이전 결과는 "
            "새 결과로 갱신되고, 추천 업무도 다시 계산됩니다."
        ),
    },
    {
        "id": "faq_cancel_match",
        "question": "매칭 대기를 취소하고 싶어요.",
        "answer": (
            "마이페이지에서 '매칭 대기 취소'를 누르시면 더 이상 농부님들의 후보자 "
            "목록에 노출되지 않습니다. 언제든 다시 매칭을 신청하실 수 있어요."
        ),
    },
    {
        "id": "faq_no_response",
        "question": "매칭된 상대방이 채팅에 답이 없어요.",
        "answer": (
            "채팅으로 며칠간 응답이 없다면, 아래 '직접 질문하기'로 상황을 알려주시면 "
            "저희가 확인 후 안내해드릴게요."
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

SYSTEM_PROMPT = f"""당신은 소일거리(충북 청년 x 농부 AI 매칭 플랫폼)의 AI 상담사입니다.

아래는 자주 묻는 질문과 답변입니다. 사용자의 질문이 이 내용과 관련 있다면 이를 참고해서
정확하고 간결하게(3문장 이내) 답변하세요.

[자주 묻는 질문]
{_FAQ_CONTEXT}

만약 사용자가 다른 사용자의 부적절한 행동, 사기, 폭언, 노쇼 등 "신고"에 해당하는 내용을
전달하는 경우에는, 직접 판단하거나 조치하지 말고 반드시 아래 JSON 형식으로만 응답하세요:
{{"type": "report", "category": "짧은 분류명", "summary": "신고 내용 한 줄 요약", "severity": "low|medium|high"}}

신고가 아닌 일반 문의는 자유 텍스트로 답변하세요 (JSON을 쓰지 마세요).
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
    신고로 분류되면 사람이 검토하도록 접수만 하고, 사용자에게는 접수 안내만 전달.
    반환값: {"type": "answer", "message": "..."} 또는 {"type": "report", "message": "..."}
    """
    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=500,
            temperature=0.3,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": message}],
        )
        text = response.content[0].text.strip()
    except Exception:
        return {
            "type": "answer",
            "message": "일시적으로 답변을 가져오지 못했어요. 잠시 후 다시 시도해주세요.",
        }

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
                    "신고가 접수되었습니다. 담당자가 확인 후 조치할 예정이에요. "
                    f"(접수번호: {report_id})"
                ),
            }
    except (json.JSONDecodeError, TypeError):
        pass

    return {"type": "answer", "message": text}
