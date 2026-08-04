from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db, User
from schemas import RegisterRequest, LoginRequest, TokenResponse, UserResponse, UserStatsUpdate
from auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["인증"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    # 이메일 중복 확인
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다")

    # 역할 유효성 검사
    if body.role not in ["청년", "농부"]:
        raise HTTPException(status_code=400, detail="역할은 '청년' 또는 '농부'여야 합니다")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        name=body.name,
        role=body.role,
        location=body.location,
        strength=0,
        stamina=0,
        grit=0,
        intelligence=0,
        wage_pref=0,
        personality=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다",
        )

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=List[UserResponse], summary="전체 회원 목록 조회")
def get_all_users(db: Session = Depends(get_db)):
    """가입된 전체 회원 목록을 조회합니다."""
    return db.query(User).all()


@router.put("/me/stats", response_model=UserResponse, summary="내 스탯 업데이트 (친구1 연동용)")
def update_user_stats(
    stats: UserStatsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """성격검사 결과 등으로 유저의 스탯(근력, 체력, 근성, 지성, 급여, 성격)을 업데이트합니다."""
    for field, val in stats.dict(exclude_unset=True).items():
        setattr(current_user, field, val)
    db.commit()
    db.refresh(current_user)
    return current_user
