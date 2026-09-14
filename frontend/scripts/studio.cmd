@echo off
chcp 65001 >nul
title Верстак — редактор шаблонов
cd /d "%~dp0.."

set "URL=http://localhost:3000/studio"

rem ── Сервер уже поднят? Тогда второй не нужен — просто открываем страницу.
powershell -NoProfile -Command "try { $null = Invoke-WebRequest '%URL%' -UseBasicParsing -TimeoutSec 3; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  echo Сервер уже работает — открываю страницу.
  start "" "%URL%"
  timeout /t 2 /nobreak >nul
  exit /b 0
)

rem ── Браузер открываем не сразу: первая сборка Next занимает полминуты, и
rem    окно, открытое раньше времени, показало бы «не удаётся открыть страницу».
rem    Поэтому ждём в стороне, пока сервер ответит, и только тогда открываем.
start "" powershell -NoProfile -WindowStyle Hidden -Command "for ($i=0; $i -lt 240; $i++) { try { $null = Invoke-WebRequest '%URL%' -UseBasicParsing -TimeoutSec 2; Start-Process '%URL%'; break } catch { Start-Sleep -Milliseconds 500 } }"

echo.
echo   Верстак — редактор шаблонов
echo   %URL%
echo.
echo   Страница откроется сама, как только сервер ответит.
echo   Остановить — Ctrl+C или закрыть это окно.
echo.

call npm run dev -- --port 3000

echo.
echo Сервер остановлен.
pause
