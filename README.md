# 🌱 소일거리 (Soilgery)

> **충북 청년 × 농부 AI 매칭 플랫폼**  
> 제13회 전국 ICT 융합 공모전 출품작

---

## 🛠️ 프로젝트 구조

```
soilgery/
├── frontend/   # React (Vite) — 프론트엔드 웹 앱
└── backend/    # FastAPI (Python) — 백엔드 API 서버 & DB
```

---

## 🚀 빠른 시작 가이드

### 0. 환경변수(.env) 설정 — 로컬 DB로 회원가입/로그인 테스트하기
`backend/.env.example`을 복사해 `backend/.env`를 만드세요. (Windows에서 `start_backend.bat`/`start_all.bat`을 실행하면 `.env`가 없을 때 자동으로 복사해줍니다.)

기본값 그대로 두면 `DATABASE_URL=sqlite:///./soilgery.db`로 설정되어 있어서, **별도 DB 서버 설치 없이** 로컬 SQLite 파일(`backend/soilgery.db`)이 자동 생성되고 바로 회원가입/로그인 테스트가 가능합니다. 실제 배포(Railway)에서는 이 파일이 아니라 Railway 대시보드에 등록된 PostgreSQL `DATABASE_URL`이 우선 적용되므로 로컬 설정과 충돌하지 않습니다.

AI 매칭/AI 상담사 기능까지 테스트하려면 `ANTHROPIC_API_KEY`에 실제 Anthropic API 키를 넣어야 합니다.

### 1. 백엔드 (FastAPI) 실행
```powershell
cd backend
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8080
```
> 👉 백엔드 API 주소: `http://localhost:8080`  
> 👉 API 자동 문서 (Swagger): `http://localhost:8080/docs`

### 2. 프론트엔드 (React + Vite) 실행
```powershell
cd frontend
npm run dev
```
> 👉 프론트엔드 접속 주소: `http://localhost:5173`

---

## 🤝 친구1 (AI / 핵심 기능 담당) 작업 가이드

### 1. User DB 모델에 반영된 스탯 컬럼 목록
`backend/database.py` 의 `User` 테이블에 아래 6가지 스탯 + 평점 컬럼이 구축되어 있습니다:

- `rating` (FLOAT, 기본값 0.0) — 평점
- `strength` (INT, 기본값 0) — 근력
- `stamina` (INT, 기본값 0) — 체력
- `grit` (INT, 기본값 0) — 근성
- `intelligence` (INT, 기본값 0) — 지성
- `wage_pref` (INT, 기본값 0) — 급여
- `personality` (INT, 기본값 0) — 성격

### 2. 기능 추가 방법
- **새 API 추가 시**: `backend/routers/` 폴더에 새 라우터 파일(예: `matching_router.py`) 생성 후 `backend/main.py`에 `app.include_router(...)`로 등록하시면 됩니다.
- **프론트엔드 UI 화면 연동 시**: `frontend/src/pages/` 에 새 화면 폴더(예: `Survey/`, `Match/`)를 만들고 `App.jsx` 라우트에 연결해 사용하시면 됩니다.

---

## 💡 현재까지 구현 완료된 기능
- [x] Vite + React 프론트엔드 반응형 모바일 디자인 시스템 세팅
- [x] FastAPI + SQLite (로컬 DB) 유저 회원가입 / 로그인 / JWT 토큰 인증
- [x] 메인 홈 화면 (`/home`) — 가입된 전체 회원 현황 실시간 표출
- [x] 내 개인정보 및 6대 스탯 상세 프로필 화면 (`/profile`)
- [x] `[🤖 AI 자동매칭]` 버튼 위치 세팅 완료
