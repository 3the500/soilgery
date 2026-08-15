"""
공고(job_postings) 관리 모듈
------------------
농부(고용주)가 공고를 등록하고, 모든 사용자(청년/농부 구분 없이)가
전체 공고 목록과 상세 내용을 조회할 수 있게 하는 모듈입니다.

[변경 사항 - soilgery 프로젝트 구조에 맞춰 수정]
- pymysql/raw SQL 대신 SQLAlchemy ORM 사용 (models.JobPosting)
"""

from typing import List, Optional

from sqlalchemy.orm import Session

from models import JobPosting
from matching import FARM_TASK_PROFILES
# import psycopg as psycopg2 #추가

def create_posting(
    employer_id: int,
    task: str,
    title: str,
    db: Session,
    description: Optional[str] = None,
    location: Optional[str] = None,
    wage: Optional[int] = None,
) -> JobPosting:
    """
    농부(고용주)가 공고를 등록할 때 호출.
    task는 반드시 FARM_TASK_PROFILES에 정의된 업무
    (밭일/농기구 운용/물건 나르기/시설정비/선별 및 포장/가공) 중 하나여야 함.
    반환값: 생성된 JobPosting 객체
    """
    if task not in FARM_TASK_PROFILES:
        raise ValueError(
            f"'{task}'는 존재하지 않는 업무입니다. "
            f"가능한 업무: {list(FARM_TASK_PROFILES.keys())}"
        )

    posting = JobPosting(
        employer_id=employer_id,
        task=task,
        title=title,
        description=description,
        location=location,
        wage=wage,
        status="open",
    )
    db.add(posting)
    db.commit()
    db.refresh(posting)
    return posting


def get_all_postings(db: Session, status: Optional[str] = "open") -> List[JobPosting]:
    """
    모든 사용자(청년/농부 구분 없이)가 볼 수 있는 전체 공고 목록.
    status=None이면 마감된 공고까지 전부, status="open"(기본값)이면 모집 중인 공고만.
    최신순으로 정렬.
    """
    query = db.query(JobPosting)
    if status is not None:
        query = query.filter(JobPosting.status == status)
    return query.order_by(JobPosting.created_at.desc()).all()


def get_posting(posting_id: int, db: Session) -> JobPosting:
    """공고 상세 조회 (모든 사용자가 볼 수 있음)"""
    posting = db.query(JobPosting).filter(JobPosting.id == posting_id).first()
    if posting is None:
        raise ValueError(f"posting_id={posting_id} 공고가 존재하지 않습니다.")
    return posting


def close_posting(posting_id: int, db: Session) -> None:
    """모집 마감 (선택적으로 사용)"""
    posting = get_posting(posting_id, db)
    posting.status = "closed"
    db.commit()
