[CmdletBinding()]
param(
  [ValidateSet('remember', 'asuka', 'rei')]
  [string]$Driver = 'remember',
  [string]$Name = 'EVA Codex',
  [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$Launcher = Join-Path $Root 'Start-EVA.vbs'
$ThemeRoot = Join-Path $Root 'eva-theme'
$ThemeManifest = Join-Path $ThemeRoot 'assets\manifest.json'
$ThemeImporter = Join-Path $Root 'codex-skin\Import-EVA-Theme.ps1'
$ThemeDestination = Join-Path $env:LOCALAPPDATA 'EVACodexSkin\eva-theme'
if (-not (Test-Path -LiteralPath $Launcher -PathType Leaf)) {
  throw "缺少隐藏启动入口：$Launcher"
}

function Find-CodexExecutable {
  $package = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue |
    Sort-Object Version -Descending |
    Select-Object -First 1
  if ($package) {
    $candidates = @(
      (Join-Path $package.InstallLocation 'app\ChatGPT.exe'),
      (Join-Path $package.InstallLocation 'app\Codex.exe')
    )
    foreach ($candidate in $candidates) {
      if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        return [pscustomobject]@{
          Path = (Resolve-Path -LiteralPath $candidate).Path
          Version = [string]$package.Version
        }
      }
    }
  }
  $fallback = @(
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\ChatGPT.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\ChatGPT\ChatGPT.exe'),
    (Join-Path $env:ProgramFiles 'ChatGPT\ChatGPT.exe')
  ) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  if (-not $fallback) { throw '未找到官方 Codex 客户端，无法使用官方图标。' }
  return [pscustomobject]@{
    Path = (Resolve-Path -LiteralPath $fallback).Path
    Version = [Diagnostics.FileVersionInfo]::GetVersionInfo($fallback).FileVersion
  }
}

$codex = Find-CodexExecutable
if (-not (Test-Path -LiteralPath $ThemeManifest -PathType Leaf)) {
  throw "缺少内置 EVA 素材包清单：$ThemeManifest"
}
if (-not (Test-Path -LiteralPath $ThemeImporter -PathType Leaf)) {
  throw "缺少 EVA 素材导入器：$ThemeImporter"
}
& $ThemeImporter -SourceRoot $ThemeRoot -Destination $ThemeDestination | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $ThemeDestination 'manifest.json') -PathType Leaf)) {
  throw "EVA 素材没有成功导入：$ThemeDestination"
}
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not (Test-Path -LiteralPath $desktop -PathType Container)) {
  throw "找不到桌面目录：$desktop"
}
$shortcutPath = Join-Path $desktop ($Name + '.lnk')

if (-not $VerifyOnly) {
  $wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
  if (-not (Test-Path -LiteralPath $wscript -PathType Leaf)) {
    throw "找不到 Windows Script Host：$wscript"
  }
  $argumentText = '"' + $Launcher + '"'
  if ($Driver -ne 'remember') { $argumentText += ' ' + $Driver }
  $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $wscript
  $shortcut.Arguments = $argumentText
  $shortcut.WorkingDirectory = $Root
  $shortcut.IconLocation = $codex.Path + ',0'
  $shortcut.Description = '官方 Codex + EVA 皮肤（无控制台窗口）'
  $shortcut.WindowStyle = 7
  $shortcut.Save()
}

if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) {
  throw "桌面快捷方式未创建：$shortcutPath"
}
$saved = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
if ($saved.TargetPath -notmatch '\\wscript\.exe$') {
  throw "快捷方式目标异常：$($saved.TargetPath)"
}
if ($saved.Arguments.IndexOf($Launcher, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
  throw "快捷方式参数没有指向 Start-EVA.vbs：$($saved.Arguments)"
}
if ($saved.IconLocation.IndexOf($codex.Path, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
  throw "快捷方式没有使用官方 Codex 图标：$($saved.IconLocation)"
}

[pscustomobject]@{
  status = 'PASS'
  shortcut = $shortcutPath
  target = $saved.TargetPath
  arguments = $saved.Arguments
  workingDirectory = $saved.WorkingDirectory
  icon = $saved.IconLocation
  codexVersion = $codex.Version
} | ConvertTo-Json
