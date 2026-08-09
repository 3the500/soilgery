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
import os
from typing import Dict, List

import anthropic
from sqlalchemy.orm import Session

from models import Report

client = anthropic.Anthropic()  # ANTHROPIC_API_KEY 환경변수를 자동으로 읽음

# [피드백 반영] 문의/신고 시 안내할 관리자 이메일 주소.
# 배포 환경에 맞게 환경변수 ADMIN_EMAIL로 덮어쓸 수 있도록 구성.
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "soilgery.help@gmail.com")


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

SYSTEM_PROMPT = f"""당신은 '충북 농촌 소일거리 매칭 플랫폼'의 AI 1:1 상담사 '소일이'입니다.

[서비스 주요 내용]
1. 적성검사: 6가지 예/아니요 질문을 통해 사용자의 스텟(체력, 근력, 숙련도, 성실성, 협동심, 급여민감도)을 측정합니다.
2. 매칭 시스템: 청년은 스텟 기반 업무 추천을 받고 매칭 대기를 신청합니다. 농부는 업무별 후보자를 조회하여 원하는 청년과 매칭(1:1 채팅방 개설)을 진행합니다.
3. 급여/근무조건: 공고 정보 및 매칭 후 1:1 채팅을 통해 농부와 청년이 직접 상의합니다.
4. 역할 구분: '청년(구직자)'과 '농부(구인자)' 두 가지 역할로 회원가입 및 이용이 가능합니다.

[자주 묻는 질문(FAQ)]
{_FAQ_CONTEXT}

[답변 지침 - 아래 유형에 맞춰 자연스럽게 대응하세요. 사용자는 상담과 무관한 자유로운
 대화(인사, 가벼운 농담, 잡담 등)를 시도할 수 있으며, 이런 경우에도 상담을 거부하거나
 딱딱하게 굴지 말고 친근하게 받아주세요.]

1. 인사(예: "안녕", "반가워", "소일아 안녕" 등)
   -> 친근하고 밝은 톤으로 인사를 받아주고, 간단히 서비스를 소개해주세요.

2. 가벼운 농담·잡담(서비스와 무관한 스몰토크, 드립, 안부 인사 등)
   -> 딱딱하게 "서비스 관련 질문만 답변 가능합니다"라고 선을 긋지 말고, 자연스럽고
      재치있게 받아준 뒤, 부담스럽지 않게 서비스 이야기로 슬쩍 이어가도 좋습니다.

3. 일반 문의(FAQ로 답변되지 않는 개인 맞춤 문의, 계정 문제, 건의사항, 제휴 문의 등
   상담사가 이 자리에서 바로 해결해주기 어려운 내용)
   -> 아는 범위 내에서 최대한 답변하되, 직접 처리가 어려운 내용이라면
      "보다 정확한 확인을 위해 아래 이메일로 문의를 남겨주시면 담당자가 확인 후
      답변드릴게요"라는 취지로 안내하며, 반드시 관리자 이메일 주소
      ({ADMIN_EMAIL})를 함께 안내하세요. (일반 텍스트로 답변, JSON 금지)

4. 신고(폭언, 사기, 노쇼, 금전 요구, 성희롱, 불공정 거래 등)
   -> 접수 처리를 위해 직접 답변하지 말고, 반드시 아래 JSON 형식으로만 응답하세요:
      {{"type": "report", "category": "짧은 분류명(예: 노쇼/사기/폭언 등)", "summary": "신고 내용 한 줄 요약", "severity": "low|medium|high"}}
      (이메일 안내 문구는 서버가 접수 확인 메시지에 자동으로 붙여주므로 여기에는 넣지 않습니다.)

[공통 지침]
- 답변은 가급적 핵심만 2~3문장 이내로 작성하세요 (인사/잡담은 더 짧아도 됩니다).
- 신고(4번)로 판단되는 경우를 제외하고는 항상 자연스러운 일반 텍스트로만 답변하세요 (JSON 금지).
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
            model="claude-sonnet-5",  # 🔧 [버그 수정] 기존 claude-3-5-sonnet-20241022 모델이
            # 2025-10-28부로 Anthropic에서 완전히 폐기(retired)되어 모든 API 호출이 실패하고
            # 있었음. 이 때문에 "안녕" 같은 인사에도 아래 except 블록의 임시 오류 메시지만
            # 반환되고 있었음. 현재 사용 가능한 모델로 교체.
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
                    f"(접수번호: {report_id})\n\n"
                    f"보다 자세한 내용을 전달하고 싶으시면 {ADMIN_EMAIL} 로 캡처 화면과 함께 "
                    "메일을 보내주셔도 확인 후 처리해 드립니다."
                ),
            }
    except (json.JSONDecodeError, TypeError):
        pass

    return {"type": "answer", "message": text}