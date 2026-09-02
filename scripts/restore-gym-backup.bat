@echo off
setlocal
cd /d "%~dp0\.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0restore-gym-backup.ps1"
if errorlevel 1 (
  echo.
  echo Restore did not complete. Your safety backup and logs were preserved.
  pause
  exit /b 1
)
echo.
echo Restore completed and verification passed.
pause
