from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

#backend. 추가하여 경로지정
from database import get_db, User
from auth import get_current_user
from schemas import CreatePostingRequest, PostingResponse
from postings import create_posting, get_all_postings, get_posting, close_posting

router = APIRouter(prefix="/job-postings", tags=["공고"])


# ---- 농부: 공고 등록 ----
@router.post("", response_model=PostingResponse)
def register_posting(
    body: CreatePostingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "농부":
        raise HTTPException(status_code=403, detail="농부만 공고를 등록할 수 있습니다.")

    try:
        posting = create_posting(
            employer_id=current_user.id,
            task=body.task,
            title=body.title,
            db=db,
            description=body.description,
            location=body.location,
            wage=body.wage,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return posting


# ---- 전체 사용자: 공고 목록 조회 (청년/농부 구분 없이 전부 공개) ----
@router.get("", response_model=List[PostingResponse])
def list_postings(status: Optional[str] = "open", db: Session = Depends(get_db)):
    return get_all_postings(db, status=status)


# ---- 전체 사용자: 공고 상세 조회 ----
@router.get("/{posting_id}", response_model=PostingResponse)
def read_posting(posting_id: int, db: Session = Depends(get_db)):
    try:
        return get_posting(posting_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---- 농부: 본인이 등록한 공고 마감 ----
@router.post("/{posting_id}/close")
def stop_posting(
    posting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        posting = get_posting(posting_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if posting.employer_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인이 등록한 공고만 마감할 수 있습니다.")

    close_posting(posting_id, db)
    return {"status": "공고 마감 완료"}
