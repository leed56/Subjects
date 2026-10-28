param(
  [Parameter(Mandatory=$true)][string]$PgToolsDirectory,
  [Parameter(Mandatory=$true)][string]$DestinationDirectory,
  [Parameter(Mandatory=$true)][string]$RootCertificatePath
)
$ErrorActionPreference = 'Stop'
$taskDumpTool = Join-Path $PgToolsDirectory 'pg_dump.exe'
$taskRestoreTool = Join-Path $PgToolsDirectory 'pg_restore.exe'
foreach ($taskFile in @($taskDumpTool, $taskRestoreTool, $RootCertificatePath)) {
  if (-not (Test-Path -LiteralPath $taskFile -PathType Leaf)) { throw "Required file missing: $taskFile" }
}
if (-not (Test-Path -LiteralPath $DestinationDirectory -PathType Container)) { throw 'Backup destination directory does not exist.' }
$taskStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$taskBackupPath = Join-Path $DestinationDirectory ("lakbiz-release-{0}-{1}.dump" -f $taskStamp, [guid]::NewGuid().ToString('N').Substring(0,8))
if (Test-Path -LiteralPath $taskBackupPath) { throw 'Refusing to overwrite an existing backup.' }
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = (Resolve-Path -LiteralPath $RootCertificatePath).Path
$env:PGCONNECT_TIMEOUT = '30'
Write-Host 'LakBiz - fresh read-only database backup' -ForegroundColor Cyan
Write-Host 'Project: zestppstpwjxriwcuykc (nexus-erp)'
Write-Host 'This performs no database changes and installs no migrations.'
Write-Host 'Enter your database password at the Password prompt. It remains hidden.'
Write-Host 'The backup contains private business data; keep it secure.'
try {
  & $taskDumpTool --host=aws-1-ap-southeast-1.pooler.supabase.com --port=5432 --username=postgres.zestppstpwjxriwcuykc --dbname=postgres --format=custom --file=$taskBackupPath --password
  if ($LASTEXITCODE -ne 0) { throw 'Backup failed. No migration was attempted.' }
  & $taskRestoreTool --file=NUL $taskBackupPath
  if ($LASTEXITCODE -ne 0) { throw 'The archive could not be read completely. No migration was attempted.' }
  $taskBackup = Get-Item -LiteralPath $taskBackupPath
  if ($taskBackup.Length -eq 0) { throw 'The backup is empty.' }
  $taskStream = [System.IO.File]::OpenRead($taskBackupPath)
  $taskHasher = [System.Security.Cryptography.SHA256]::Create()
  try {
    $taskHash = [BitConverter]::ToString($taskHasher.ComputeHash($taskStream)).Replace('-','')
  } finally {
    $taskStream.Dispose()
    $taskHasher.Dispose()
  }
  $taskProof = [ordered]@{
    projectRef = 'zestppstpwjxriwcuykc'
    backupPath = $taskBackup.FullName
    bytes = $taskBackup.Length
    sha256 = $taskHash
    completedUtc = [DateTime]::UtcNow.ToString('o')
    archiveReadable = $true
    fullRestoreTested = $false
  }
  $taskProof | ConvertTo-Json | Set-Content -LiteralPath ($taskBackupPath + '.proof.json') -Encoding UTF8
  Write-Host 'Backup completed and archive readability checked.' -ForegroundColor Green
  Write-Host $taskBackup.FullName
  Write-Host 'A restore drill is still required. No migration has been applied.'
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
  Read-Host 'Press Enter to close this window'
}
