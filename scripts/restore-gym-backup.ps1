Add-Type -AssemblyName System.Windows.Forms
$picker = New-Object System.Windows.Forms.OpenFileDialog
$picker.Title = 'Choose a Gym backup to restore'
$picker.Filter = 'Gym backups (*.zip;*.dump)|*.zip;*.dump'
$picker.Multiselect = $false
if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
  Write-Host 'Restore cancelled. No data was changed.'
  exit 0
}
& node (Join-Path $PSScriptRoot 'windows-emergency-restore.mjs') $picker.FileName
exit $LASTEXITCODE
