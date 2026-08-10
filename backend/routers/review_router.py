from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db, User
from models import Review
from schemas import ReviewCreateRequest, ReviewResponse
from auth import get_current_user

router = APIRouter(prefix="/reviews", tags=["평점 및 리뷰"])


@router.post("", response_model=ReviewResponse, summary="평점 및 리뷰 작성")
def create_review(
    req: ReviewCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if req.rating < 1.0 or req.rating > 5.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="평점은 1.0점 이상 5.0점 이하여야 합니다."
        )

    if current_user.id == req.reviewee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신에게는 평점을 남길 수 없습니다."
        )

    target_user = db.query(User).filter(User.id == req.reviewee_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="리뷰 대상을 찾을 수 없습니다."
        )

    # 1. 리뷰 객체 생성 및 DB 저장
    review = Review(
        reviewer_id=current_user.id,
        reviewee_id=req.reviewee_id,
        match_id=req.match_id,
        rating=float(req.rating),
        comment=req.comment
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    # 2. 피평가 유저의 전체 평점 평균 계산 및 User.rating 갱신
    avg_rating = db.query(func.avg(Review.rating)).filter(Review.reviewee_id == req.reviewee_id).scalar()
    if avg_rating is not None:
        target_user.rating = round(float(avg_rating), 1)

    # 3. 🏆 리뷰를 받을 때마다 경험치(rating * 20) 부여 및 레벨(1~10) 갱신
    gained_exp = round(float(req.rating) * 20)
    target_user.exp = (target_user.exp or 0) + gained_exp
    target_user.level = calculate_level(target_user.exp)
    db.commit()

    return ReviewResponse(
        id=review.id,
        reviewer_id=review.reviewer_id,
        reviewer_name=current_user.name,
        reviewee_id=review.reviewee_id,
        reviewee_name=target_user.name,
        match_id=review.match_id,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at
    )


# 🏆 경험치(EXP) 기준 레벨 계산 함수 (Lv.1 ~ Lv.10)
def calculate_level(exp: int) -> int:
    if exp < 100:
        return 1
    elif exp < 250:
        return 2
    elif exp < 450:
        return 3
    elif exp < 700:
        return 4
    elif exp < 1000:
        return 5
    elif exp < 1350:
        return 6
    elif exp < 1750:
        return 7
    elif exp < 2200:
        return 8
    elif exp < 2700:
        return 9
    else:
        return 10


def sync_all_users_exp_and_level(db: Session):
    """기존 DB의 리뷰 데이터를 기반으로 전체 유저의 exp와 level을 소급 동기화합니다."""
    users = db.query(User).all()
    for user in users:
        reviews = db.query(Review).filter(Review.reviewee_id == user.id).all()
        total_exp = sum(round(float(r.rating) * 20) for r in reviews)
        user.exp = total_exp
        user.level = calculate_level(total_exp)
    db.commit()


@router.get("/my", summary="내 관련 리뷰 목록 조회 (내가 쓴 리뷰 & 내가 받은 리뷰)")
def get_my_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 내가 쓴 리뷰
    given_reviews = db.query(Review).filter(Review.reviewer_id == current_user.id).all()
    # 내가 받은 리뷰
    received_reviews = db.query(Review).filter(Review.reviewee_id == current_user.id).all()

    def format_review(r: Review):
        reviewer = db.query(User).filter(User.id == r.reviewer_id).first()
        reviewee = db.query(User).filter(User.id == r.reviewee_id).first()
        return {
            "id": r.id,
            "reviewer_id": r.reviewer_id,
            "reviewer_name": reviewer.name if reviewer else "회원",
            "reviewee_id": r.reviewee_id,
            "reviewee_name": reviewee.name if reviewee else "회원",
            "match_id": r.match_id,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }

    return {
        "given": [format_review(r) for r in given_reviews],
        "received": [format_review(r) for r in received_reviews]
    }
