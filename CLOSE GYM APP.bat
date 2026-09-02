@echo off
setlocal
cd /d "%~dp0"
node scripts\windows-stop.mjs
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
ping 127.0.0.1 -n 4 >nul
exit /b 0
