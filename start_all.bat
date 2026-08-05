@echo off
echo.
echo  ============================================
echo   Soilgery - Starting Backend + Frontend
echo  ============================================
echo.
echo  Backend  : http://localhost:8080
echo  Frontend : http://localhost:5173
echo  API Docs : http://localhost:8080/docs
echo.
echo  Two windows will open. Keep both running!
echo  Press Ctrl+C in each window to stop.
echo.
pause

start "Soilgery Backend (8080)" cmd /k "cd /d "%~dp0backend" && (if not exist venv python -m venv venv) && .\venv\Scripts\python.exe -m pip install -r requirements.txt --quiet && .\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8080"

timeout /t 3 /nobreak >nul

start "Soilgery Frontend (5173)" cmd /k "cd /d "%~dp0frontend" && (if not exist node_modules npm install) && npm run dev"
