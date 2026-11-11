[CmdletBinding()]
param(
  [ValidateSet('remember', 'asuka', 'rei')]
  [string]$Driver = 'remember',
  [ValidateRange(1024, 65535)]
  [int]$Port = 9345,
  [switch]$RestartExisting,
  [switch]$PromptRestart,
  [switch]$ForceRestart,
  [switch]$GuiPrompt,
  [switch]$VerifyOnly,
  [string]$CodexExe
)

$ErrorActionPreference = 'Stop'
$SkinVersion = '0.4.2'
$PortExplicit = $PSBoundParameters.ContainsKey('Port')
$StateRoot = Join-Path $env:LOCALAPPDATA 'EVACodexSkin'
$StatePath = Join-Path $StateRoot 'state.json'
$RuntimePath = Join-Path $StateRoot 'runtime.json'
$DriverPath = Join-Path $StateRoot 'driver.txt'
$ProfilePath = Join-Path $StateRoot 'cdp-profile'
$InjectorLog = Join-Path $StateRoot 'injector.log'
$InjectorErrorLog = Join-Path $StateRoot 'injector-error.log'
$InjectorPath = Join-Path $PSScriptRoot 'injector.mjs'

function Write-Step {
  param([Parameter(Mandatory)][string]$Message)
  Write-Host "[EVA] $Message"
}

function Show-GuiMessage {
  param(
    [Parameter(Mandatory)][string]$Message,
    [string]$Title = 'EVA Codex',
    [ValidateSet('Info', 'Warning', 'Error', 'Question')]
    [string]$Kind = 'Info'
  )
  Add-Type -AssemblyName System.Windows.Forms
  $icon = switch ($Kind) {
    'Error' { [System.Windows.Forms.MessageBoxIcon]::Error }
    'Warning' { [System.Windows.Forms.MessageBoxIcon]::Warning }
    'Question' { [System.Windows.Forms.MessageBoxIcon]::Question }
    default { [System.Windows.Forms.MessageBoxIcon]::Information }
  }
  [System.Windows.Forms.MessageBox]::Show(
    $Message,
    $Title,
    [System.Windows.Forms.MessageBoxButtons]::OK,
    $icon
  ) | Out-Null
}

function Confirm-CodexRestart {
  $message = @(
    '官方 Codex 已经打开，但换肤需要让它在本地调试端口上重新启动一次。',
    '',
    '继续会关闭当前 Codex 窗口。聊天记录不会丢失，窗口随后会自动重开。',
    '',
    '现在重启 Codex？'
  ) -join [Environment]::NewLine
  if (-not $GuiPrompt) {
    Write-Host ''
    Write-Host '官方 Codex 已经打开，但换肤必须让它在本地调试端口 9345 上重新启动一次。' -ForegroundColor Yellow
    Write-Host '继续会关闭当前 Codex 窗口（聊天记录不会丢失，但当前窗口会重开）。' -ForegroundColor Yellow
    $answer = Read-Host '现在重启 Codex？[y/N]'
    return $answer -match '^(?i)y(es)?$'
  }
  Add-Type -AssemblyName System.Windows.Forms
  $result = [System.Windows.Forms.MessageBox]::Show(
    $message,
    'EVA Codex - 需要重启一次',
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question,
    [System.Windows.Forms.MessageBoxDefaultButton]::Button2
  )
  return $result -eq [System.Windows.Forms.DialogResult]::Yes
}

function Get-NodeRuntime {
  $command = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $command) { throw '未找到 Node.js 22+。请先安装 Node.js 22 或更高版本，并确认 node --version 可用。' }
  $version = (& $command.Source --version).TrimStart('v')
  $major = 0
  if (-not [int]::TryParse(($version -split '\.')[0], [ref]$major) -or $major -lt 22) {
    throw "官方 Codex 皮肤需要 Node.js 22 或更高版本（内置 WebSocket），当前为 $version。"
  }
  return [pscustomobject]@{ Path = $command.Source; Version = $version }
}

function Test-TrustedPublisher {
  param([Parameter(Mandatory)][string]$Executable)
  $signature = Get-AuthenticodeSignature -LiteralPath $Executable
  if ($signature.Status -ne 'Valid') { return $false }
  $subject = [string]$signature.SignerCertificate.Subject
  return $subject -match 'CN="?OpenAI'
}

function Get-CodexInstall {
  param([string]$ExplicitPath)
  $package = $null
  $appId = $null
  $executable = $null
  if ($ExplicitPath) {
    $executable = [IO.Path]::GetFullPath($ExplicitPath)
  } else {
    $package = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue |
      Sort-Object Version -Descending |
      Select-Object -First 1
    if ($package) {
      $manifest = Get-AppxPackageManifest -Package $package
      $applications = @($manifest.Package.Applications.Application)
      $application = $applications |
        Where-Object { $_.Executable -eq 'app/ChatGPT.exe' } |
        Select-Object -First 1
      if (-not $application) {
        $application = $applications |
          Where-Object { $_.Executable -like '*ChatGPT.exe' } |
          Select-Object -First 1
      }
      if (-not $application) { throw '官方 Codex Appx 清单中没有 ChatGPT.exe。' }
      $executable = Join-Path $package.InstallLocation ([string]$application.Executable)
      $appId = "$($package.PackageFamilyName)!$($application.Id)"
    }
  }
  if (-not $executable) {
    $candidates = @(
      (Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\ChatGPT.exe'),
      (Join-Path $env:LOCALAPPDATA 'Programs\ChatGPT\ChatGPT.exe'),
      (Join-Path $env:ProgramFiles 'ChatGPT\ChatGPT.exe')
    )
    $executable = $candidates |
      Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
      Select-Object -First 1
  }
  if (-not $executable -or -not (Test-Path -LiteralPath $executable -PathType Leaf)) {
    throw '未找到官方 Codex 客户端。请先从 Microsoft Store 安装/打开一次 Codex。'
  }
  $executable = (Resolve-Path -LiteralPath $executable).Path
  if ((Split-Path -Leaf $executable) -notin @('ChatGPT.exe', 'Codex.exe')) {
    throw "拒绝启动非 Codex 可执行文件: $executable"
  }
  if (-not (Test-TrustedPublisher -Executable $executable)) {
    throw "Codex 可执行文件签名校验失败，拒绝注入: $executable"
  }
  if ($package) {
    $packageRoot = [IO.Path]::GetFullPath($package.InstallLocation).TrimEnd('\')
    $normalizedExe = [IO.Path]::GetFullPath($executable)
    if (-not $normalizedExe.StartsWith($packageRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
      throw 'Codex 可执行文件不在已注册 Appx 安装目录内。'
    }
  }
  return [pscustomobject]@{
    Executable = $executable
    PackageRoot = if ($package) { $package.InstallLocation } else { Split-Path -Parent $executable }
    PackageFullName = if ($package) { $package.PackageFullName } else { $null }
    PackageFamilyName = if ($package) { $package.PackageFamilyName } else { $null }
    Version = if ($package) { [string]$package.Version } else { [Diagnostics.FileVersionInfo]::GetVersionInfo($executable).FileVersion }
    AppUserModelId = $appId
  }
}

function Get-ProcessRows {
  return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ExecutablePath
  })
}

function Test-ProcessDescendsFrom {
  param(
    [Parameter(Mandatory)][int]$ProcessId,
    [Parameter(Mandatory)][string]$Executable,
    [Parameter(Mandatory)][object[]]$Rows
  )
  $byId = @{}
  foreach ($row in $Rows) { $byId[[int]$row.ProcessId] = $row }
  $current = $ProcessId
  $seen = @{}
  for ($depth = 0; $depth -lt 32 -and $current -gt 0; $depth++) {
    if ($seen.ContainsKey($current)) { return $false }
    $seen[$current] = $true
    $row = $byId[$current]
    if (-not $row) { return $false }
    if ($row.ExecutablePath -and
      $row.ExecutablePath.Equals($Executable, [StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
    $current = [int]$row.ParentProcessId
  }
  return $false
}

function Get-CodexProcesses {
  param([Parameter(Mandatory)][string]$Executable)
  return @(Get-ProcessRows | Where-Object {
    $_.ExecutablePath -and
    $_.ExecutablePath.Equals($Executable, [StringComparison]::OrdinalIgnoreCase)
  })
}

function Get-CodexLaunchId {
  param([Parameter(Mandatory)][object]$Install)
  $processes = @(Get-CodexProcesses -Executable $Install.Executable)
  if (-not $processes.Count) { return [guid]::NewGuid().ToString('N') }
  $main = $processes | Sort-Object CreationDate | Select-Object -First 1
  $created = if ($main.CreationDate) {
    ([datetime]$main.CreationDate).ToUniversalTime().ToString('o')
  } else {
    [string]$main.ProcessId
  }
  $material = "$($Install.Executable)|$($main.ProcessId)|$created"
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($material)
    $hash = ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
    return $hash.Substring(0, 24)
  } finally {
    $sha.Dispose()
  }
}

function Test-CdpEndpoint {
  param(
    [Parameter(Mandatory)][int]$CdpPort,
    [Parameter(Mandatory)][string]$Executable
  )
  try {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $CdpPort -ErrorAction Stop)
    if (-not $listeners.Count) { return $false }
    $rows = Get-ProcessRows
    foreach ($listener in $listeners) {
      if (-not (Test-ProcessDescendsFrom -ProcessId ([int]$listener.OwningProcess) -Executable $Executable -Rows $rows)) {
        return $false
      }
    }
    $targets = @(Invoke-RestMethod -Uri "http://127.0.0.1:$CdpPort/json/list" -TimeoutSec 2 -MaximumRedirection 0 | ForEach-Object { $_ })
    foreach ($target in $targets) {
      if ($target.type -ne 'page' -or -not ([string]$target.url).StartsWith('app://')) { continue }
      try {
        $uri = [Uri]$target.webSocketDebuggerUrl
        if ($uri.Scheme -eq 'ws' -and
          $uri.Host -in @('127.0.0.1', 'localhost', '[::1]') -and
          $uri.Port -eq $CdpPort -and
          $uri.AbsolutePath -match '^/devtools/page/[A-Za-z0-9._-]{1,200}$') {
          return $true
        }
      } catch {}
    }
  } catch {}
  return $false
}

function Wait-CdpEndpoint {
  param(
    [Parameter(Mandatory)][int]$CdpPort,
    [Parameter(Mandatory)][string]$Executable,
    [int]$TimeoutSeconds = 45
  )
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-CdpEndpoint -CdpPort $CdpPort -Executable $Executable) { return $true }
    Start-Sleep -Milliseconds 350
  }
  return $false
}

function Get-FreePort {
  param([Parameter(Mandatory)][int]$Preferred)
  for ($candidate = $Preferred; $candidate -le [Math]::Min(65535, $Preferred + 20); $candidate++) {
    $listener = $null
    try {
      $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $candidate)
      $listener.Start()
      return $candidate
    } catch {} finally {
      if ($listener) { $listener.Stop() }
    }
  }
  throw "没有找到可用回环端口（$Preferred 起）。"
}

function Read-SavedState {
  if (-not (Test-Path -LiteralPath $StatePath -PathType Leaf)) { return $null }
  try { return Get-Content -LiteralPath $StatePath -Raw -Encoding UTF8 | ConvertFrom-Json }
  catch { return $null }
}

function Stop-RecordedInjector {
  param([object]$State)
  if (-not $State -or -not $State.injectorPid) { return }
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$State.injectorPid)" -ErrorAction SilentlyContinue
  if (-not $process) { return }
  $command = [string]$process.CommandLine
  if (-not $command -or
    $command.IndexOf($InjectorPath, [StringComparison]::OrdinalIgnoreCase) -lt 0 -or
    $command.IndexOf("--port $([int]$State.port)", [StringComparison]::OrdinalIgnoreCase) -lt 0) {
    throw '记录的注入器 PID 与当前脚本不匹配，为避免误杀已停止。'
  }
  Write-Step "停止旧注入器 PID $($State.injectorPid)..."
  Stop-Process -Id ([int]$State.injectorPid) -ErrorAction Stop
  Wait-Process -Id ([int]$State.injectorPid) -Timeout 8 -ErrorAction SilentlyContinue
}

function Stop-StaleInjectors {
  foreach ($process in @(Get-ProcessRows)) {
    if ($process.Name -notin @('node.exe', 'node')) { continue }
    $command = [string]$process.CommandLine
    if (-not $command) { continue }
    if ($command.IndexOf($InjectorPath, [StringComparison]::OrdinalIgnoreCase) -lt 0) { continue }
    if ($command -notmatch '(?:^|\s)--watch(?:\s|$)') { continue }
    Write-Step "停止残留注入器 PID $($process.ProcessId)..."
    Stop-Process -Id ([int]$process.ProcessId) -ErrorAction SilentlyContinue
    Wait-Process -Id ([int]$process.ProcessId) -Timeout 8 -ErrorAction SilentlyContinue
  }
}

function Stop-Codex {
  param(
    [Parameter(Mandatory)][object]$Install,
    [switch]$AllowForce
  )
  $processes = @(Get-CodexProcesses -Executable $Install.Executable)
  if (-not $processes.Count) { return }
  Write-Step "关闭当前 Codex 窗口（PID $((($processes | ForEach-Object ProcessId) -join ', '))）..."
  foreach ($process in $processes) {
    try { (Get-Process -Id $process.ProcessId -ErrorAction Stop).CloseMainWindow() | Out-Null } catch {}
  }
  $deadline = [DateTime]::UtcNow.AddSeconds(15)
  while (@(Get-CodexProcesses -Executable $Install.Executable).Count -gt 0 -and
    [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
  if (-not @(Get-CodexProcesses -Executable $Install.Executable).Count) { return }
  if (-not $AllowForce) {
    throw 'Codex 没有在 15 秒内正常关闭。请手动退出后重试，或显式使用 -ForceRestart。'
  }
  foreach ($process in @(Get-CodexProcesses -Executable $Install.Executable)) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 800
  if (@(Get-CodexProcesses -Executable $Install.Executable).Count) {
    throw 'Codex 仍未能安全关闭，已停止启动。'
  }
}

function Start-CodexWithCdp {
  param(
    [Parameter(Mandatory)][object]$Install,
    [Parameter(Mandatory)][int]$CdpPort,
    [Parameter(Mandatory)][string]$UserDataDir
  )
  New-Item -ItemType Directory -Force -Path $UserDataDir | Out-Null
  $arguments = '--remote-debugging-address=127.0.0.1 --remote-debugging-port=' + $CdpPort +
    ' --user-data-dir="' + $UserDataDir + '"'
  $activated = $false
  if ($Install.AppUserModelId) {
    try {
      if (-not ('EVACodexSkin.ApplicationActivationManager' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace EVACodexSkin {
  [ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IApplicationActivationManager {
    [PreserveSig] int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
      [MarshalAs(UnmanagedType.LPWStr)] string arguments, uint options, out uint processId);
    [PreserveSig] int ActivateForFile(string appUserModelId, IntPtr itemArray, string verb, out uint processId);
    [PreserveSig] int ActivateForProtocol(string appUserModelId, IntPtr itemArray, out uint processId);
  }
  public static class ApplicationActivationManager {
    public static uint Activate(string appUserModelId, string arguments) {
      var manager = (IApplicationActivationManager)new Manager();
      uint processId;
      int result = manager.ActivateApplication(appUserModelId, arguments, 0, out processId);
      if (result < 0) Marshal.ThrowExceptionForHR(result);
      return processId;
    }
    [ComImport, Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
    private class Manager { }
  }
}
'@
      }
      Write-Step "通过 Appx 激活官方 Codex: $($Install.AppUserModelId)"
      [EVACodexSkin.ApplicationActivationManager]::Activate($Install.AppUserModelId, $arguments) | Out-Null
      $activated = $true
    } catch {
      Write-Warning "Appx 激活失败，将尝试直接启动已签名的 Store 可执行文件: $($_.Exception.Message)"
    }
  }

  if ($activated) {
    $main = $null
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    while ([DateTime]::UtcNow -lt $deadline) {
      if (Test-CdpEndpoint -CdpPort $CdpPort -Executable $Install.Executable) { return }
      $main = Get-CodexProcesses -Executable $Install.Executable | Select-Object -First 1
      if ($main) { break }
      Start-Sleep -Milliseconds 350
    }
    if ($main -and $main.CommandLine -and
      $main.CommandLine.IndexOf("--remote-debugging-port=$CdpPort", [StringComparison]::OrdinalIgnoreCase) -lt 0) {
      Write-Warning 'Appx 激活丢弃了 CDP 参数，改用直接启动已签名可执行文件。'
      Stop-Codex -Install $Install -AllowForce
      $activated = $false
    } elseif (-not $main) {
      Write-Warning 'Appx 激活没有及时产生 Codex 主进程，改用直接启动已签名可执行文件。'
      $activated = $false
    }
  }

  if (-not $activated) {
    Write-Step "直接启动官方 Codex（独立配置）..."
    Start-Process -FilePath $Install.Executable -ArgumentList $arguments `
      -WorkingDirectory (Split-Path -Parent $Install.Executable) -WindowStyle Normal
  }
}

function Invoke-Injector {
  param(
    [Parameter(Mandatory)][string]$NodePath,
    [Parameter(Mandatory)][string[]]$Arguments,
    [switch]$Capture
  )
  if ($Capture) {
    $output = & $NodePath $InjectorPath @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    return [pscustomobject]@{ ExitCode = $exitCode; Output = @($output) }
  }
  & $NodePath $InjectorPath @Arguments
  if ($LASTEXITCODE -ne 0) { throw "注入器退出码 $LASTEXITCODE" }
}

function Start-Injector {
  param(
    [Parameter(Mandatory)][string]$NodePath,
    [Parameter(Mandatory)][int]$CdpPort,
    [Parameter(Mandatory)][string]$SelectedDriver,
    [Parameter(Mandatory)][string]$BootId,
    [string]$ForceToken
  )
  New-Item -ItemType Directory -Force -Path $StateRoot | Out-Null
  Set-Content -LiteralPath $InjectorLog -Value '' -Encoding UTF8
  Set-Content -LiteralPath $InjectorErrorLog -Value '' -Encoding UTF8
  $argumentLine = @(
    ('"{0}"' -f $InjectorPath),
    '--watch',
    '--port', "$CdpPort",
    '--driver', $SelectedDriver,
    '--boot-id', $BootId,
    '--state-dir', ('"{0}"' -f $StateRoot)
  )
  if ($ForceToken) {
    $argumentLine += @('--force-token', $ForceToken)
  }
  $argumentLine = $argumentLine -join ' '
  $process = Start-Process -FilePath $NodePath -ArgumentList $argumentLine `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $InjectorLog -RedirectStandardError $InjectorErrorLog
  Start-Sleep -Milliseconds 700
  if ($process.HasExited) {
    $detail = if (Test-Path -LiteralPath $InjectorErrorLog) { Get-Content -LiteralPath $InjectorErrorLog -Raw } else { '' }
    throw "注入器启动后立即退出。$detail"
  }
  return $process
}

function Read-Driver {
  param([string]$Requested)
  if ($Requested -in @('asuka', 'rei')) { return $Requested }
  if (Test-Path -LiteralPath $DriverPath -PathType Leaf) {
    $saved = (Get-Content -LiteralPath $DriverPath -Raw -Encoding UTF8).Trim()
    if ($saved -in @('asuka', 'rei')) { return $saved }
  }
  return 'asuka'
}

try {
  $node = Get-NodeRuntime
  $install = Get-CodexInstall -ExplicitPath $CodexExe
  $selectedDriver = Read-Driver -Requested $Driver
  New-Item -ItemType Directory -Force -Path $StateRoot | Out-Null
  Set-Content -LiteralPath $DriverPath -Value $selectedDriver -Encoding ASCII

  if ($Driver -in @('asuka', 'rei')) {
    Set-Content -LiteralPath $DriverPath -Value $Driver -Encoding ASCII
    $selectedDriver = $Driver
  }

  if ($VerifyOnly) {
    $result = Invoke-Injector -NodePath $node.Path -Capture -Arguments @(
      '--verify', '--port', "$Port", '--driver', $selectedDriver,
      '--state-dir', $StateRoot, '--timeout-ms', '15000'
    )
    $result.Output | ForEach-Object { Write-Host $_ }
    exit $result.ExitCode
  }

  $saved = Read-SavedState
  $cdpReady = Test-CdpEndpoint -CdpPort $Port -Executable $install.Executable
  if (-not $cdpReady -and -not $PortExplicit) {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
    if ($listeners.Count) {
      $Port = Get-FreePort -Preferred ($Port + 1)
      Write-Step "端口 $($listeners[0].LocalPort) 已被占用，改用 $Port。"
    }
  }

  if (-not $cdpReady) {
    $running = @(Get-CodexProcesses -Executable $install.Executable)
    if ($running.Count) {
      if (-not $RestartExisting -and -not $PromptRestart) {
        throw '官方 Codex 正在运行，但当前实例没有开启本地 CDP。请先退出 Codex，或用 Start-EVA.cmd 的提示重启一次。'
      }
      if (-not $RestartExisting -and $PromptRestart) {
        if (-not (Confirm-CodexRestart)) {
          Write-Step '已取消，没有关闭 Codex。'
          exit 0
        }
      }
      Stop-RecordedInjector -State $saved
      Stop-Codex -Install $install -AllowForce:$ForceRestart
    }

    Start-CodexWithCdp -Install $install -CdpPort $Port -UserDataDir $ProfilePath
    Write-Step "等待官方 Codex 的本地 CDP 端口 $Port..."
    if (-not (Wait-CdpEndpoint -CdpPort $Port -Executable $install.Executable -TimeoutSeconds 45)) {
      throw "Codex 没有在 45 秒内开放已验证的本地 CDP 端口 $Port。皮肤未注入，官方程序未被修改。"
    }
  } else {
    Write-Step "已检测到本次 Codex 的本地 CDP 端口 $Port。"
  }

  Stop-RecordedInjector -State $saved
  Stop-StaleInjectors
  $bootId = Get-CodexLaunchId -Install $install
  $forceToken = if ($Driver -in @('asuka', 'rei')) {
    [guid]::NewGuid().ToString('N')
  } else {
    $null
  }
  $injector = Start-Injector -NodePath $node.Path -CdpPort $Port `
    -SelectedDriver $selectedDriver -BootId $bootId -ForceToken $forceToken
  $state = [ordered]@{
    schemaVersion = 1
    app = 'EVA-CODEX-SKIN'
    version = $SkinVersion
    port = $Port
    driver = $selectedDriver
    bootId = $bootId
    injectorPid = $injector.Id
    injectorPath = $InjectorPath
    nodePath = $node.Path
    nodeVersion = $node.Version
    codexExe = $install.Executable
    codexVersion = $install.Version
    codexPackageFullName = $install.PackageFullName
    profilePath = $ProfilePath
    createdAt = [DateTime]::UtcNow.ToString('o')
  }
  $temporary = "$StatePath.$PID.tmp"
  $state | ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding UTF8
  Move-Item -LiteralPath $temporary -Destination $StatePath -Force

  Start-Sleep -Milliseconds 1200
  $runtime = $null
  if (Test-Path -LiteralPath $RuntimePath -PathType Leaf) {
    try { $runtime = Get-Content -LiteralPath $RuntimePath -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
  }
  if ($runtime -and $runtime.driver -in @('asuka', 'rei') -and $runtime.driver -ne $selectedDriver) {
    $selectedDriver = $runtime.driver
    Set-Content -LiteralPath $DriverPath -Value $selectedDriver -Encoding ASCII
    $state.driver = $selectedDriver
    $temporary = "$StatePath.$PID.tmp"
    $state | ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $StatePath -Force
  }
  Write-Host ''
  if ($runtime -and $runtime.status -eq 'applied') {
    Write-Host "EVA 皮肤已应用到官方 Codex（$selectedDriver）。" -ForegroundColor Green
    Write-Host "CDP: 127.0.0.1:$Port  |  日志: $InjectorErrorLog"
  } else {
    Write-Host "官方 Codex 已启动，注入器正在等待 Codex 主界面。" -ForegroundColor Yellow
    Write-Host '如果这是首次使用独立配置，请先在窗口中登录；登录后皮肤会自动应用。'
    Write-Host "CDP: 127.0.0.1:$Port  |  日志: $InjectorErrorLog"
  }
  Write-Host ''
  Write-Host "安全提示：CDP 只绑定 127.0.0.1，但本地程序仍可能读取调试通道。使用完可运行 Restore-EVA.cmd 或关闭 Codex。"
} catch {
  $message = @(
    "EVA 换肤失败：$($_.Exception.Message)",
    '',
    "日志：$InjectorErrorLog"
  ) -join [Environment]::NewLine
  if ($GuiPrompt) {
    Show-GuiMessage -Message $message -Kind Error
  } else {
    Write-Host ''
    Write-Host $message -ForegroundColor Red
  }
  exit 1
}
