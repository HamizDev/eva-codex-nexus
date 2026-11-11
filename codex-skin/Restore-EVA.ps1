[CmdletBinding()]
param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 0
)

$ErrorActionPreference = 'Stop'
$StateRoot = Join-Path $env:LOCALAPPDATA 'EVACodexSkin'
$StatePath = Join-Path $StateRoot 'state.json'
$RuntimePath = Join-Path $StateRoot 'runtime.json'
$InjectorPath = Join-Path $PSScriptRoot 'injector.mjs'

function Write-Step {
  param([Parameter(Mandatory)][string]$Message)
  Write-Host "[EVA] $Message"
}

function Get-NodeRuntime {
  $command = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $command) { throw '未找到 Node.js。' }
  return $command.Source
}

$state = $null
if (Test-Path -LiteralPath $StatePath -PathType Leaf) {
  try { $state = Get-Content -LiteralPath $StatePath -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
}
if ($Port -eq 0) {
  if ($state -and $state.port) { $Port = [int]$state.port } else { $Port = 9345 }
}

$injectorStopped = $false
if ($state -and $state.injectorPid) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.injectorPid)" -ErrorAction SilentlyContinue
  if ($process) {
    $command = [string]$process.CommandLine
    if ($command -and
      $command.IndexOf($InjectorPath, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
      $command.IndexOf("--port $([int]$state.port)", [StringComparison]::OrdinalIgnoreCase) -ge 0) {
      Write-Step "停止注入器 PID $($state.injectorPid)..."
      Stop-Process -Id ([int]$state.injectorPid) -ErrorAction Stop
      Wait-Process -Id ([int]$state.injectorPid) -Timeout 8 -ErrorAction SilentlyContinue
      $injectorStopped = $true
    } else {
      Write-Warning '记录的 PID 与 EVA 注入器不匹配，未停止该进程。'
    }
  }
}

$removed = $false
try {
  $node = Get-NodeRuntime
  Write-Step "从当前官方 Codex renderer 移除皮肤..."
  $output = & $node $InjectorPath --remove --port "$Port" --state-dir $StateRoot 2>&1
  $exitCode = $LASTEXITCODE
  $output | ForEach-Object { Write-Host $_ }
  $removed = $exitCode -eq 0
} catch {
  Write-Warning "无法连接 CDP 端口 $Port：$($_.Exception.Message)"
}

if ($injectorStopped -and -not $removed) {
  Write-Step '注入器已停止；当前 Codex 若仍显示皮肤，关闭并重新打开官方 Codex 即可恢复。'
}
if ($removed) {
  Write-Step '皮肤已移除，官方 Codex 的布局和交互未被改动。'
}

Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $RuntimePath -Force -ErrorAction SilentlyContinue
Write-Step '恢复完成。下次双击 Start-EVA.cmd 可重新换肤。'
