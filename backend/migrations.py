"""
아주 가벼운 컬럼 마이그레이션
------------------
database.py의 create_tables()(Base.metadata.create_all)는 "없는 테이블"만
새로 만들어줄 뿐, 이미 존재하는 테이블(예: 예전에 만들어진 로컬 soilgery.db,
또는 Railway에 이미 떠 있는 Postgres)에 "새로 추가된 컬럼"은 반영하지 않는다.

그래서 models.py에 새 컬럼(match_requests.employer_left / employee_left)이
추가되어도, 기존 DB 파일을 쓰는 사람은 컬럼이 없어 에러가 난다.
이 파일은 서버 시작 시 한 번, 없는 컬럼만 골라 ALTER TABLE로 추가해준다.
SQLite / PostgreSQL 둘 다 `ALTER TABLE ... ADD COLUMN ...` 문법을 지원하므로
동일한 코드로 처리 가능하다.
"""

from sqlalchemy import inspect, text


def run_migrations(engine) -> None:
    inspector = inspect(engine)
    if "match_requests" not in inspector.get_table_names():
        # 테이블 자체가 아직 없으면(신규 DB) create_tables()가 이미 최신 컬럼 포함해서
        # 만들어줬을 것이므로 할 일이 없다.
        return

    existing_columns = {col["name"] for col in inspector.get_columns("match_requests")}
    columns_to_add = {
        "employer_left": "BOOLEAN NOT NULL DEFAULT 0",
        "employee_left": "BOOLEAN NOT NULL DEFAULT 0",
    }

    with engine.begin() as conn:
        for column_name, ddl_type in columns_to_add.items():
            if column_name in existing_columns:
                continue
            try:
                conn.execute(text(f"ALTER TABLE match_requests ADD COLUMN {column_name} {ddl_type}"))
                print(f"[OK] match_requests.{column_name} 컬럼 추가 완료")
            except Exception as e:
                print(f"[WARN] match_requests.{column_name} 컬럼 추가 실패(이미 있을 수 있음): {e}")
