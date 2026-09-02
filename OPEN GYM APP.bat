@echo off
setlocal
cd /d "%~dp0"
node scripts\windows-start.mjs
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
ping 127.0.0.1 -n 3 >nul
exit /b 0
