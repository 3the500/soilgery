import base64
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from database import get_db, User
from schemas import RegisterRequest, LoginRequest, TokenResponse, UserResponse, UserUpdateRequest
from auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["인증"])

# [피드백 반영] 내 정보 - 프로필 사진 등록 기능
# 요구사항 원문 "사진 용량은 2MB~5MB 이하"는 하한선까지 강제하는 것인지 표현이 다소
# 모호합니다. 일반 스마트폰 사진은 압축/리사이즈를 거치면 2MB 미만인 경우도 흔해서,
# 하한선(2MB)까지 강제하면 정상적인 사진도 계속 거부되는 문제가 생길 수 있습니다.
# 그래서 우선 "최대 5MB"만 강제하도록 구현했습니다. 하한선(2MB 미만 업로드 차단)이
# 실제로 필요하시면 MIN_PROFILE_IMAGE_SIZE 검증을 추가해 드릴 수 있습니다.
MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024   # 5MB
ALLOWED_IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}



@router.post("/register", response_model=UserResponse, status_code=201)
@router.post("/register/", response_model=UserResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    # 이메일 중복 확인
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다")

    # 역할 유효성 검사
    if body.role not in ["청년", "농부"]:
        raise HTTPException(status_code=400, detail="역할은 '청년' 또는 '농부'여야 합니다")

    # 거주지역 필수 유효성 검사
    if not body.location or not body.location.strip():
        raise HTTPException(status_code=400, detail="거주 지역을 필수 항목으로 입력해 주세요")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        name=body.name,
        role=body.role,
        location=body.location,
        rating=0.0,
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
@router.post("/login/", response_model=TokenResponse)
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


@router.put("/me", response_model=UserResponse, summary="내 정보 수정")
def update_me(
    body: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """현재 로그인된 사용자의 프로필 정보(이름, 거주지역, 구직여부, 스탯 등)를 수정합니다."""
    update_data = body.dict(exclude_unset=True)

    # [피드백 반영] 청년이 적성검사를 한 번도 하지 않은 상태(스텟 전부 0)에서도
    # 홈 화면의 매칭 ON/OFF 토글이 매칭.py의 request_match()를 거치지 않고
    # 이 API(내 정보 수정)로 곧장 is_seeking=True를 보낼 수 있어, 적성검사 없이도
    # 매칭 대기 상태가 되어버리는 문제가 있었다.
    # -> is_seeking을 True로 켜려는 요청이면서, 반영 후 스텟이 여전히 전부 0인
    #    청년이라면 차단한다. (matching.request_match()의 가드와 동일한 기준)
    STAT_FIELDS = ("strength", "stamina", "grit", "intelligence", "wage_pref", "personality")
    if current_user.role == "청년" and update_data.get("is_seeking") is True:
        stats_after_update = {
            field: update_data.get(field, getattr(current_user, field)) for field in STAT_FIELDS
        }
        if all(v == 0 for v in stats_after_update.values()):
            raise HTTPException(
                status_code=400,
                detail="적성검사를 먼저 완료해야 매칭을 시작할 수 있습니다.",
            )

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/profile-image", response_model=UserResponse, summary="프로필 사진 등록/변경")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    [피드백 반영] 내 정보 메뉴에서 프로필 사진을 등록할 수 있게 한다.
    업로드된 이미지는 base64 data URL 형태로 인코딩해 User.profile_image 컬럼에 저장한다.
    (별도의 오브젝트 스토리지 없이 DB에 바로 저장하는 방식)
    """
    if file.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="JPEG, PNG, WEBP 형식의 이미지만 업로드할 수 있습니다.")

    content = await file.read()
    if len(content) > MAX_PROFILE_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="프로필 사진은 5MB를 초과할 수 없습니다.")

    encoded = base64.b64encode(content).decode("utf-8")
    current_user.profile_image = f"data:{file.content_type};base64,{encoded}"

    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/profile-image", response_model=UserResponse, summary="프로필 사진 삭제")
def delete_profile_image(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """등록된 프로필 사진을 삭제하고 기본 아바타로 되돌린다."""
    current_user.profile_image = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/users", response_model=List[UserResponse], summary="전체 회원 목록 조회")
def get_all_users(db: Session = Depends(get_db)):
    """가입된 전체 회원 목록을 조회합니다."""
    return db.query(User).all()

