@echo off
cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo [1/2] Installing npm packages... (first time only)
    npm install
)

echo [2/2] Starting frontend server at http://localhost:5173
echo.
npm run dev
pause
