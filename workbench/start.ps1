param([switch]$DesktopBoot,[ValidateRange(1024,65535)][int]$Port=43137,[switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$env:HACKCLAW_PORT=[string]$Port
$env:HACKCLAW_DATA_DIR=Join-Path $PSScriptRoot 'data'
$projectRoot = $PSScriptRoot
$url = 'http://127.0.0.1:'+$Port
# Only reuse the service started from THIS exact installation.
$expectedVersion = '0.1.1'
$instancePath = [IO.Path]::GetFullPath($projectRoot).TrimEnd('\','/').ToLowerInvariant()
$sha = [Security.Cryptography.SHA256]::Create()
try { $hash = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($instancePath)) } finally { $sha.Dispose() }
$expectedInstance = -join ($hash[0..7] | ForEach-Object { $_.ToString('x2') })
$running = $false
$health = $null
try { $health = Invoke-RestMethod -Uri "$url/health" -TimeoutSec 2 -ErrorAction Stop } catch { }
if ($null -ne $health) {
    if ($health.app -ne 'EVA-CODEX-WORKBENCH' -or $health.instance -ne $expectedInstance) {
        throw "Port $Port is used by another workbench or program. Choose another port: .\start.ps1 -Port 43138"
    }
    if ($health.version -ne $expectedVersion) {
        throw "An old version of this workbench is still running on port $Port. Exit it before launching the updated version."
    }
    $running = $true
} else {
    # An HTTP error is not evidence that the port is free.
    $probe = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $probe.BeginConnect('127.0.0.1', $Port, $null, $null)
        if ($connect.AsyncWaitHandle.WaitOne(350) -and $probe.Connected) {
            throw "Port $Port is occupied by a service that is not this workbench."
        }
    } finally { $probe.Close() }
}
if (-not $running) {
    # Match the Node.js used for npm ci. A private Codex runtime can have a
    # different ABI and fail when loading the native node-pty dependency.
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    $major = & $nodePath -p "process.versions.node.split('.')[0]"
    if ([int]$major -lt 20) { throw 'Node.js 20 or newer is required.' }
    & $nodePath -e "try{require(require.resolve('node-pty',{paths:[process.argv[1]]}));require.resolve('@xterm/xterm',{paths:[process.argv[1]]});require.resolve('@xterm/addon-fit',{paths:[process.argv[1]]})}catch(e){console.error(e.message);process.exit(1)}" $projectRoot
    if($LASTEXITCODE -ne 0){throw 'Terminal dependencies missing or incompatible with the current Node.js. Run npm ci inside workbench using this Node.js.'}
    $env:HACKCLAW_CODEX = (Get-Command codex -ErrorAction Stop).Source
    $logDir = Join-Path $projectRoot 'data'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    Start-Process -FilePath $nodePath -ArgumentList ('"' + (Join-Path $projectRoot 'server.cjs') + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'server.log') -RedirectStandardError (Join-Path $logDir 'server-error.log')
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 300
        try { $health = Invoke-RestMethod -Uri "$url/health" -TimeoutSec 1; if ($health.app -eq 'EVA-CODEX-WORKBENCH' -and $health.instance -eq $expectedInstance -and $health.version -eq $expectedVersion) { $running = $true; break } } catch {}
    }
    if (-not $running) { throw 'Workbench could not start. See workbench/data/server-error.log.' }
}
if($NoBrowser){Write-Output "Workbench ready at $url";return}
$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (Test-Path -LiteralPath $edgePath) {
    $profilePath = Join-Path $projectRoot 'data\unit02-browser'
    if ($DesktopBoot) {
        $launchUrl = $url + '/?boot=interactive&launch=' + [Guid]::NewGuid().ToString('N')
        Start-Process -FilePath $edgePath -ArgumentList ('--app=' + $launchUrl),('--user-data-dir="' + $profilePath + '"'),'--autoplay-policy=no-user-gesture-required','--no-first-run','--no-default-browser-check','--window-size=1500,950'
        return
    }
    # This is the visible, interactive workbench window requested by the user.
    $launchUrl = $url + '/?launch=' + [Guid]::NewGuid().ToString('N')
    Start-Process -FilePath $edgePath -ArgumentList ('--app=' + $launchUrl),('--user-data-dir="' + $profilePath + '"'),'--no-first-run','--no-default-browser-check','--window-size=1500,950'
} else {
    throw 'Microsoft Edge is required for the isolated UNIT-02 browser profile. Install Edge, then run this launcher again.'
}
