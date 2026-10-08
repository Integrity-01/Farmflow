@echo off
rem Starts the FarmFlow Node API (frontend is served by Apache on :8080).
cd /d "%~dp0"
If not exist "backend\dist\server.js" (
  echo backend/dist missing - run: npm run build -w backend
  pause
  exit /b 1
)
start "FarmFlow API :4000" node "backend\dist\server.js"
timeout /t 2 >nul
powershell -NoProfile -Command "try { (Invoke-RestMethod http://localhost:4000/api/health).database.status } catch { 'down' }"