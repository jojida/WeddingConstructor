@echo off
echo.
echo  ====================================
echo   WeddingCraft - Запуск серверов
echo  ====================================
echo.
echo  Backend:  http://localhost:4000
echo  Frontend: http://localhost:3000
echo.

start "WeddingCraft Backend" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 2 /nobreak >nul
start "WeddingCraft Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 3 /nobreak >nul
start "" http://localhost:3000

echo  Серверы запускаются...
echo  Браузер откроется автоматически.
echo.
pause
