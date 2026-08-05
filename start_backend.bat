@echo off
cd /d "%~dp0backend"

if not exist "venv" (
    echo [1/3] Creating virtual environment...
    python -m venv venv
)

echo [2/3] Installing packages...
.\venv\Scripts\python.exe -m pip install -r requirements.txt --quiet

echo [3/3] Starting backend server at http://localhost:8080
echo       API docs: http://localhost:8080/docs
echo.
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8080
pause
