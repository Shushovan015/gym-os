@echo off
setlocal

REM ============================================
REM Daily Backup Script for Gym Management System
REM Run via Windows Task Scheduler daily
REM ============================================

cd /d "%~dp0.."

echo [%date% %time%] Starting daily backup...

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERROR: Docker is not running. Backup skipped.
    exit /b 1
)

REM Run the backup
npm run db:backup
if errorlevel 1 (
    echo [%date% %time%] ERROR: Backup failed!
    exit /b 1
)

echo [%date% %time%] Backup completed successfully.

REM Optional: Keep only last 30 backups to save space
REM Uncomment the next lines if you want auto-cleanup
REM forfiles /p "backups" /m "gym-management-*.dump" /d -30 /c "cmd /c del @path" 2>nul
REM echo [%date% %time%] Old backups cleaned up.

exit /b 0