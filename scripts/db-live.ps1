[CmdletBinding()]
param(
    [ValidateSet('Init','Setup','Validate','Connect','StartTunnel','Tunnel','Check','Status','Deploy','Disconnect')]
    [string]$Action = 'Connect',
    [string]$SessionToken = '',
    [switch]$KeepOpen
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$stateDirectory = Join-Path $projectRoot '.joro-live'
$stateFile = Join-Path $stateDirectory 'tunnel.json'
$nodeTool = Join-Path $PSScriptRoot 'db-live.mjs'
$managedScriptPath = $PSCommandPath
Set-Location -LiteralPath $projectRoot
$sshKeyFile = Join-Path $stateDirectory 'id_ed25519'
$stage = 'repository verification'

function Protect-LiveProfile {
    $file = Join-Path $projectRoot '.env.live.local'
    if (!(Test-Path -LiteralPath $file)) { return }
    if ((Get-Item -LiteralPath $file -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Live environment must not be a link.' }
    try {
        $user = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $acl = New-Object Security.AccessControl.FileSecurity
        $acl.SetOwner($user)
        $acl.SetAccessRuleProtection($true,$false)
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($user,'FullControl','Allow')))
        [IO.File]::SetAccessControl($file,$acl)
        Write-Host 'Private live environment permissions restricted to the current Windows user.'
    } catch { Write-Warning 'Could not restrict the private live file permissions. Review its NTFS access before adding a real password.' }
}

function Read-TunnelState {
    if (Test-Path -LiteralPath $stateFile) {
        try { return (Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json) } catch { return $null }
    }
    return $null
}
function Test-OwnedTunnel($record) {
    if (!$record -or $record.Token -notmatch '^[a-f0-9-]{36}$') { return $false }
    try {
        $sshProcess = Get-Process -Id ([int]$record.SshPid) -ErrorAction Stop
        $sshInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$record.SshPid)"
        $ownerInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$record.SessionPid)"
        return ($sshProcess.ProcessName -eq 'ssh' -and $sshProcess.StartTime.ToUniversalTime().Ticks.ToString() -eq [string]$record.StartTicks -and
            $sshInfo.ParentProcessId -eq [int]$record.SessionPid -and $ownerInfo.CommandLine.Contains($record.Token) -and
            $ownerInfo.CommandLine.Contains($managedScriptPath) -and $sshInfo.CommandLine.Contains('127.0.0.1:3307:127.0.0.1:3306') -and
            $sshInfo.CommandLine.Contains('u749284283@145.79.26.151'))
    } catch { return $false }
}
function Test-OwnedListener($record) {
    if (!(Test-OwnedTunnel $record)) { return $false }
    try {
        $listeners = @(Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue)
        return (@($listeners | Where-Object { $_.LocalAddress -eq '127.0.0.1' -and $_.OwningProcess -eq [int]$record.SshPid }).Count -eq 1)
    } catch { return $false }
}
function Stop-OwnedTunnel {
    $record = Read-TunnelState
    if (Test-OwnedTunnel $record) {
        Stop-Process -Id ([int]$record.SshPid) -ErrorAction Stop
        Write-Host 'Closed only the independently managed JORO live SSH tunnel.'
    } else { Write-Host 'No matching managed SSH process is running. No process was terminated.' }
    if (Test-Path -LiteralPath $stateFile) { Remove-Item -LiteralPath $stateFile }
}
function Start-ManagedTunnel {
    $record = Read-TunnelState
    if (Test-OwnedListener $record) { Write-Host 'Reusing the verified, independently managed JORO SSH tunnel.'; return $record }
    if (Test-OwnedTunnel $record) { throw 'The managed SSH process is not listening. Disconnect it before reconnecting.' }
    $probe = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback),3307
    try { $probe.Start() } catch { Write-Host 'Port 3307 is occupied. No existing listener will be reused or terminated.'; throw } finally { $probe.Stop() }
    if (!(Get-Command ssh.exe -ErrorAction SilentlyContinue)) { Write-Host 'Windows OpenSSH Client is missing. Install the Windows optional OpenSSH Client feature before reconnecting.'; throw 'Missing SSH client.' }
    $token = [guid]::NewGuid().ToString()
    Write-Host 'Opening the dedicated SSH terminal. Verify any first-use host fingerprint with Hostinger before accepting it. SSH passwords are masked by OpenSSH.'
    $arguments = @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"'),'-Action','Tunnel','-SessionToken',$token)
    $sessionProcess = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $arguments -WindowStyle Normal -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(120)
    do {
        Start-Sleep -Milliseconds 300
        $record = Read-TunnelState
        if ($record -and $record.Token -eq $token -and (Test-OwnedListener $record)) { return $record }
        if ($sessionProcess.HasExited) { throw 'SSH connection failed. Check credentials, host-key verification and connectivity.' }
        if ($record -and $record.Token -eq $token -and !(Test-OwnedTunnel $record)) { throw 'SSH ended before verification. See the SSH terminal for its authentication/network error.' }
    } while ([DateTime]::UtcNow -lt $deadline)
    if ($record -and $record.Token -eq $token -and (Test-OwnedTunnel $record)) { Stop-OwnedTunnel }
    throw 'SSH startup timed out. No database operation was attempted.'
}

try {
    $gitRoot = & git rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($gitRoot.Trim()) -ne [IO.Path]::GetFullPath($projectRoot)) { throw 'Wrong repository root.' }
    foreach ($privatePath in @('.env.live.local','.joro-live/tunnel.json')) {
        & git check-ignore --quiet -- $privatePath
        if ($LASTEXITCODE -ne 0) { throw 'Private files must be Git ignored.' }
        $tracked = & git ls-files -- $privatePath
        if ($tracked) { throw 'Private file is tracked by Git.' }
    }
    $stage = 'live profile validation'
    & node $nodeTool init
    if ($LASTEXITCODE -ne 0) { throw 'Live profile initialization failed.' }
    Protect-LiveProfile
    if ($Action -in @('Init','Setup')) { Write-Host 'Replace ADD_MYSQL_PASSWORD_HERE in .env.live.local, then run npm run db:live:connect.'; exit 0 }
    $configText = & node $nodeTool config
    if ($LASTEXITCODE -ne 0) { throw 'Live profile validation failed.' }
    $profile = $configText | ConvertFrom-Json
    if ($Action -eq 'Validate') {
        & node $nodeTool validate
        exit $LASTEXITCODE
    }
    if ($Action -eq 'Disconnect') { Stop-OwnedTunnel; exit 0 }
    if ($Action -eq 'Tunnel') {
        if ($SessionToken -notmatch '^[a-f0-9-]{36}$') { throw 'Missing managed tunnel token.' }
        $existing = Read-TunnelState
        if (Test-OwnedTunnel $existing) { throw 'A managed tunnel is already running.' }
        $ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
        $sshArguments = @('-N','-T','-p',$profile.JORO_LIVE_SSH_PORT,'-o','ExitOnForwardFailure=yes','-o','StrictHostKeyChecking=ask','-o','UserKnownHostsFile=.joro-live/known_hosts','-o','ConnectTimeout=15','-o','ConnectionAttempts=1','-o','NumberOfPasswordPrompts=3','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3','-L','127.0.0.1:3307:127.0.0.1:3306',($profile.JORO_LIVE_SSH_USER + '@' + $profile.JORO_LIVE_SSH_HOST))
        if (Test-Path -LiteralPath $sshKeyFile) {
            $sshArguments = @('-i',('"'+$sshKeyFile+'"'),'-o','IdentitiesOnly=yes') + $sshArguments
        }
        $child = Start-Process -FilePath $ssh -ArgumentList $sshArguments -NoNewWindow -PassThru
        @{ Token=$SessionToken; SessionPid=$PID; SshPid=$child.Id; StartTicks=$child.StartTime.ToUniversalTime().Ticks.ToString() } | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
        $child.WaitForExit()
        Write-Host 'SSH tunnel disconnected. Authentication/network errors, if any, appear above.'
        if ($child.ExitCode -ne 0) { Read-Host 'Press Enter to close this SSH terminal' | Out-Null }
        exit $child.ExitCode
    }
    if ($Action -in @('Connect','Check','Status','Deploy')) {
        $stage = 'private MySQL password configuration'
        & node $nodeTool credentials-check
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    # A lock prevents simultaneous connect/check invocations racing to create two tunnels.
    $stage = 'SSH tunnel startup/authentication (see dedicated OpenSSH terminal)'
    $lockFile = Join-Path $stateDirectory 'startup.lock'
    $lock = [System.IO.File]::Open($lockFile,[System.IO.FileMode]::OpenOrCreate,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None)
    try { $record = Start-ManagedTunnel } finally { $lock.Dispose() }
    if (!(Test-OwnedListener $record)) { throw 'The owned SSH tunnel is not listening.' }
    if ($Action -eq 'StartTunnel') { exit 0 }
    $backup = $null
    if ($Action -eq 'Deploy') { $backup = (Read-Host 'Full path of the independently verified production backup').Trim('"') }
    $process = $null
    try {
        $start = New-Object System.Diagnostics.ProcessStartInfo
        $start.FileName = (Get-Command node.exe -ErrorAction Stop).Source
        $verb = if ($Action -eq 'Deploy') { 'deploy' } elseif ($Action -eq 'Status') { 'status' } else { 'check' }
        $start.Arguments = '"' + $nodeTool + '" ' + $verb
        if ($Action -eq 'Deploy') {
            if ($backup.Contains('"')) { throw 'Invalid backup path.' }
            $start.Arguments += ' --backup "' + $backup + '"'
        }
        $start.WorkingDirectory = $projectRoot
        $start.UseShellExecute = $false
        # Node explicitly reads only .env.live.local and constructs its URL internally.
        $start.EnvironmentVariables.Remove('DATABASE_URL')
        $start.EnvironmentVariables['JORO_LIVE_SESSION_ID'] = $record.Token
        $start.EnvironmentVariables['JORO_DEPLOY_MIGRATIONS'] = 'false'
        $stage = 'Node MySQL preflight (sanitized failure details appear above)'
        $process = [System.Diagnostics.Process]::Start($start)
        $process.WaitForExit()
        $result = $process.ExitCode
    } finally {
        if ($process) { $process.Dispose() }
    }
    if ($KeepOpen) { Read-Host 'Operation finished. Review the result above; press Enter to close this command window' | Out-Null }
    exit $result
} catch {
    # Do not print exception objects: drivers/processes can embed a credential-bearing URL.
    Write-Host ('Live operation stopped at stage: '+$stage+'. No raw exception or credentials were logged.') -ForegroundColor Red
    if ($KeepOpen) { Read-Host 'Press Enter to close this command window' | Out-Null }
    exit 1
}
