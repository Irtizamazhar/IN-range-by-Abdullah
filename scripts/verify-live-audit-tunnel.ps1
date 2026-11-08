param()
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stage = 'reading tunnel state'
try {
    $record = Get-Content -LiteralPath (Join-Path $root '.joro-live/tunnel.json') -Raw | ConvertFrom-Json
    if ($record.Token -notmatch '^[a-f0-9-]{36}$') { throw 'Invalid state' }
    $stage = 'finding recorded SSH process'
    $sshProcess = Get-Process -Id ([int]$record.SshPid)
    $stage = 'reading process ownership metadata'
    $sshInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$record.SshPid)"
    $ownerInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$record.SessionPid)"
    $expectedScript = Join-Path $root 'scripts/db-live.ps1'
    $owned = $sshProcess.ProcessName -eq 'ssh' -and $sshProcess.StartTime.ToUniversalTime().Ticks.ToString() -eq [string]$record.StartTicks -and
        $sshInfo.ParentProcessId -eq [int]$record.SessionPid -and $ownerInfo.CommandLine.Contains($record.Token) -and
        $ownerInfo.CommandLine.Contains($expectedScript) -and $sshInfo.CommandLine.Contains('127.0.0.1:3307:127.0.0.1:3306') -and
        $sshInfo.CommandLine.Contains('u749284283@145.79.26.151')
    $stage = 'reading listener ownership metadata'
    $listeners = @(Get-NetTCPConnection -LocalPort 3307 -State Listen)
    $verified = $owned -and @($listeners | Where-Object { $_.LocalAddress -eq '127.0.0.1' -and $_.OwningProcess -eq [int]$record.SshPid }).Count -eq 1
    @{ verified = [bool]$verified; reason = $(if ($verified) { 'Existing managed process and listener verified' } else { 'Managed process/listener ownership did not match' }) } | ConvertTo-Json -Compress
    if (!$verified) { exit 1 }
} catch {
    @{ verified = $false; stage = $stage; reason = 'Cannot verify the existing managed SSH process and listener' } | ConvertTo-Json -Compress
    exit 1
}
