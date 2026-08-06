@echo off
cd /d "%~dp0backend"

rem 다른 장치로 프로젝트를 옮겼을 때 .env가 없으면 예시 파일로 자동 생성
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
    )
)

rem ── 1. 가상환경(venv) 준비 ─────────────────────────────
rem 이 장치에 "python"이 PATH에 없을 수도 있어서(특히 공식 설치 시 "Add to PATH"를
rem 체크 안 한 경우), 먼저 Windows용 py 런처(py -3)를 시도하고, 안 되면 python을 시도합니다.
set PY_LAUNCHER=

where py >nul 2>nul
if %errorlevel%==0 (
    set PY_LAUNCHER=py -3
) else (
    where python >nul 2>nul
    if %errorlevel%==0 (
        set PY_LAUNCHER=python
    )
)

if not exist "venv" (
    if "%PY_LAUNCHER%"=="" (
        echo [오류] 이 장치에서 Python을 찾을 수 없습니다.
        echo        https://www.python.org/downloads/ 에서 설치할 때
        echo        "Add python.exe to PATH" 옵션을 꼭 체크해주세요.
        pause
        exit /b 1
    )
    echo [1/3] 가상환경 생성 중... ^(%PY_LAUNCHER%^)
    %PY_LAUNCHER% -m venv venv
)

if not exist "venv\Scripts\python.exe" (
    echo [오류] 가상환경 생성에 실패했습니다. venv 폴더를 지우고 다시 실행해주세요.
    pause
    exit /b 1
)

rem ── 2. 이후 모든 명령은 venv 안의 python.exe만 사용 (시스템 PATH와 무관) ──
echo [2/3] 패키지 설치 중...
.\venv\Scripts\python.exe -m pip install --upgrade pip --quiet
.\venv\Scripts\python.exe -m pip install -r requirements.txt --quiet

echo [3/3] 백엔드 서버 시작: http://localhost:8080
echo       API 문서: http://localhost:8080/docs
echo.
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8080
pause
