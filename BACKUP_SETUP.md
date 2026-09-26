# Daily Backup Setup for Local Supabase

## Option 1: PowerShell Script (Recommended)

### Setup via PowerShell (Run as Administrator):
```powershell
# 1. Open PowerShell as Administrator
# 2. Run this script to create the scheduled task:

$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"D:\React\gym-app\scripts\daily-backup.ps1`""
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd
Register-ScheduledTask -TaskName "GymApp-DailyBackup" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force
```

### Or manually via Task Scheduler GUI:
1. Open **Task Scheduler** (Win+R → `taskschd.msc`)
2. **Create Basic Task** → Name: `GymApp-DailyBackup`
3. Trigger: **Daily** → 2:00 AM (when gym is closed)
4. Action: **Start a Program**
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -File "D:\React\gym-app\scripts\daily-backup.ps1"`
   - Start in: `D:\React\gym-app\scripts`
5. Finish → Right-click task → **Properties** → Check **"Run with highest privileges"**
6. Check **"Run whether user is logged on or not"**

---

## Option 2: Batch File (Simpler)

### Setup via CMD (Run as Administrator):
```cmd
schtasks /create /tn "GymApp-DailyBackup" /tr "cmd /c D:\React\gym-app\scripts\daily-backup.bat" /sc daily /st 02:00 /rl highest /f
```

---

## Verify Setup:
```powershell
# Check task exists
Get-ScheduledTask -TaskName "GymApp-DailyBackup"

# Run manually to test
Start-ScheduledTask -TaskName "GymApp-DailyBackup"

# View history (enable in Task Scheduler → Action → Enable All Tasks History)
Get-ScheduledTaskInfo -TaskName "GymApp-DailyBackup"
```

---

## Backup Location:
- Files: `D:\React\gym-app\backups\gym-management-YYYY-MM-DD-HHMMSS.dump`
- Logs: `D:\React\gym-app\logs\backup.log`

---

## Restore from Backup:
```bash
# List backups
npm run backup:list

# Restore specific backup
npm run db:restore -- backups/gym-management-2026-09-26-020000.dump
# Type "RESTORE LOCAL" when prompted
```

---

## Important Notes:
- **Docker Desktop must be running** at backup time (2 AM)
- Keep laptop/desktop **powered on** overnight
- Test restore **monthly** to ensure backups work
- Backups include: `public`, `auth`, `storage` schemas
- Retention: 30 days (adjust in script if needed)