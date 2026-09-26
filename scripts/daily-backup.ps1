<#
.SYNOPSIS
    Daily backup script for Gym Management System local Supabase database.
.DESCRIPTION
    Creates a PostgreSQL custom-format dump of the local database.
    Run via Windows Task Scheduler daily at 6 PM Nepal time (UTC+5:45).
.NOTES
    Requires: Docker Desktop running, npm, Supabase CLI
#>

param(
    [int]$RetentionDays = 30,
    [string]$LogPath = ".\logs\backup.log"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Resolve-Path "$ScriptDir\.."

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $entry = "[$timestamp] [$Level] $Message"
    Write-Host $entry
    Add-Content -Path $LogPath -Value $entry
}

try {
    Write-Log "Starting daily backup (Nepal time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))..."
    
    # Ensure log directory exists
    $logDir = Split-Path -Parent $LogPath
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    
    # Check Docker
    $dockerStatus = docker info 2>$null
    if (-not $?) {
        Write-Log "Docker is not running. Backup skipped." "ERROR"
        exit 1
    }
    
    # Run backup
    Write-Log "Running npm run db:backup..."
    $result = & npm run db:backup 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -ne 0) {
        Write-Log "Backup failed with exit code $exitCode" "ERROR"
        Write-Log $result "ERROR"
        exit $exitCode
    }
    
    Write-Log "Backup completed successfully."
    
    # Cleanup old backups
    $backupDir = Join-Path $ProjectRoot "backups"
    if (Test-Path $backupDir) {
        $cutoff = (Get-Date).AddDays(-$RetentionDays)
        $oldFiles = Get-ChildItem -Path $backupDir -Filter "gym-management-*.dump" | Where-Object { $_.LastWriteTime -lt $cutoff }
        foreach ($file in $oldFiles) {
            Write-Log "Removing old backup: $($file.Name)"
            Remove-Item -Path $file.FullName -Force
        }
    }
    
    Write-Log "Daily backup task completed."
    exit 0
}
catch {
    Write-Log "Unexpected error: $($_.Exception.Message)" "ERROR"
    exit 1
}