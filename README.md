# 소일거리 (Soilgery)

> 충북 청년 × 농부 AI 매칭 플랫폼  
> 제13회 전국 ICT 융합 공모전 출품작

## 프로젝트 구조

```
soilgery/
├── frontend/   # React (Vite) — 웹 앱
└── backend/    # FastAPI (Python) — API 서버
```

## 브랜치 전략

```
main    ← 배포 브랜치 (Vercel/Railway 연동)
  └── dev     ← 통합 개발 브랜치
        ├── feat/login
        ├── feat/matching
        └── feat/...
```

## 로컬 실행

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## 배포
- **Frontend**: Vercel (main 브랜치 자동 배포)
- **Backend**: Railway (main 브랜치 자동 배포)
