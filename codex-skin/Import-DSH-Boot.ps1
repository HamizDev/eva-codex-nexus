[CmdletBinding()]
param(
  [string]$SourceRoot,
  [string]$Destination,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$StateRoot = Join-Path $env:LOCALAPPDATA 'EVACodexSkin'
if (-not $Destination) { $Destination = Join-Path $StateRoot 'dsh-boot' }
$Destination = [IO.Path]::GetFullPath($Destination)
$RepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

function Resolve-DshSource {
  param([string]$Requested)
  $candidates = @()
  if ($Requested) {
    $candidates += $Requested
  } else {
    if ($env:DSH_EVA_THEME_ROOT) { $candidates += $env:DSH_EVA_THEME_ROOT }
    $candidates += @(
      (Join-Path (Split-Path -Parent $RepoRoot) 'skin-research\dsh-eva-theme'),
      (Join-Path $RepoRoot 'dsh-eva-theme')
    )
  }
  foreach ($candidate in $candidates) {
    if (-not $candidate) { continue }
    $full = [IO.Path]::GetFullPath($candidate)
    if (Test-Path -LiteralPath (Join-Path $full 'assets\manifest.json') -PathType Leaf) {
      return $full
    }
  }
  throw '没有找到 DSH EVA 主题仓库。请运行 Import-DSH-Boot.cmd "D:\path\to\dsh-plugin-eva-theme"。'
}

function Get-Sha256 {
  param([Parameter(Mandatory)][string]$Path)
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-PathWithinRoot {
  param(
    [Parameter(Mandatory)][string]$Root,
    [Parameter(Mandatory)][string]$Path
  )
  $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
  $pathFull = [IO.Path]::GetFullPath($Path)
  return $pathFull.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)
}

$source = Resolve-DshSource -Requested $SourceRoot
$assetManifestPath = Join-Path $source 'assets\manifest.json'
$noticePath = Join-Path $source 'NOTICE.md'
$licensePath = Join-Path $source 'LICENSE'
$packagePath = Join-Path $source 'package.json'
foreach ($required in @($assetManifestPath, $noticePath, $licensePath)) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
    throw "DSH 主题缺少必要文件：$required"
  }
}

$assetManifest = Get-Content -LiteralPath $assetManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$package = if (Test-Path -LiteralPath $packagePath -PathType Leaf) {
  Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json
} else {
  $null
}
$commit = $null
try {
  $commit = (& git -C $source rev-parse HEAD 2>$null).Trim()
  if ($LASTEXITCODE -ne 0) { $commit = $null }
} catch {}

$requiredAssetIds = @(
  'boot',
  'emergency',
  'entryPlug',
  'asukaHead',
  'reiHead',
  'asukaVoice',
  'reiVoice'
)
$optionalAssetIds = @(
  'asukaPortrait',
  'reiPortrait',
  'asukaPickVoice',
  'reiPickVoice',
  'asukaWelcome',
  'reiWelcome',
  'asukaApproval',
  'reiApproval',
  'asukaComplete',
  'reiComplete',
  'typing'
)
$assets = @()
foreach ($id in $requiredAssetIds) {
  $sourceEntry = $assetManifest.assets.$id
  if (-not $sourceEntry -or -not $sourceEntry.file) {
    throw "DSH 资源清单缺少 $id。"
  }
}
foreach ($id in $requiredAssetIds + $optionalAssetIds) {
  $sourceEntry = $assetManifest.assets.$id
  if (-not $sourceEntry -or -not $sourceEntry.file) {
    if ($optionalAssetIds -contains $id) { continue }
    throw "DSH 资源清单缺少 $id。"
  }
  $relative = [string]$sourceEntry.file
  if ($relative -match '(^|[\\/])\.\.([\\/]|$)' -or [IO.Path]::IsPathRooted($relative)) {
    throw "DSH 资源路径不安全：$relative"
  }
  $sourceFile = Join-Path (Join-Path $source 'assets') $relative
  if (-not (Test-PathWithinRoot -Root (Join-Path $source 'assets') -Path $sourceFile) -or
    -not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
    throw "DSH 资源不存在或越界：$sourceFile"
  }
  $bytes = (Get-Item -LiteralPath $sourceFile).Length
  $sha = Get-Sha256 -Path $sourceFile
  if ($sourceEntry.bytes -and [long]$sourceEntry.bytes -ne $bytes) {
    throw "DSH 资源大小校验失败：$relative（清单 $($sourceEntry.bytes)，实际 $bytes）"
  }
  if ($sourceEntry.sha256 -and ([string]$sourceEntry.sha256).ToLowerInvariant() -ne $sha) {
    throw "DSH 资源 SHA-256 校验失败：$relative"
  }
  $assets += [ordered]@{
    id = $id
    file = 'assets/' + ([IO.Path]::GetFileName($relative))
    type = [string]$sourceEntry.type
    bytes = $bytes
    sha256 = $sha
    durationSeconds = if ($sourceEntry.durationSeconds) { [double]$sourceEntry.durationSeconds } else { $null }
    sourceFile = $relative
  }
}

if ((Test-Path -LiteralPath $Destination -PathType Container) -and -not $Force) {
  $existingManifest = Join-Path $Destination 'manifest.json'
  if (Test-Path -LiteralPath $existingManifest -PathType Leaf) {
    $existing = Get-Content -LiteralPath $existingManifest -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($existing.sourceCommit -eq $commit -and $commit) {
      Write-Host "DSH 启动资源已经是最新版本（$($commit.Substring(0, 8))）。"
      Write-Host "位置：$Destination"
      return
    }
  }
}

New-Item -ItemType Directory -Force -Path (Join-Path $Destination 'assets') | Out-Null
foreach ($asset in $assets) {
  $sourceFile = Join-Path (Join-Path $source 'assets') ([string]$asset.sourceFile)
  $targetFile = Join-Path $Destination $asset.file
  Copy-Item -LiteralPath $sourceFile -Destination $targetFile -Force
  if ((Get-Sha256 -Path $targetFile) -ne $asset.sha256) {
    throw "复制后的 DSH 资源校验失败：$targetFile"
  }
}

$manifest = [ordered]@{
  schemaVersion = 1
  package = 'dsh-eva-theme-boot-pack'
  sourceRepository = 'https://github.com/seaison/dsh-plugin-eva-theme'
  sourceCommit = $commit
  sourceVersion = if ($package) { [string]$package.version } else { $null }
  importedAt = [DateTime]::UtcNow.ToString('o')
  redistribution = 'local-only; original DSH media license applies'
  features = @(
    'boot-sequence',
    'boot-voice',
    'driver-select-voice',
    'welcome-voice',
    'approval-voice',
    'complete-voice',
    'typing-sound',
    'character-portrait',
    'display-settings'
  )
  assets = $assets | ForEach-Object {
    [ordered]@{
      id = $_.id
      file = $_.file
      type = $_.type
      bytes = $_.bytes
      sha256 = $_.sha256
      durationSeconds = $_.durationSeconds
      sourceFile = $_.sourceFile
    }
  }
}
$manifestPath = Join-Path $Destination 'manifest.json'
$temporary = "$manifestPath.$PID.tmp"
[IO.File]::WriteAllText(
  $temporary,
  ($manifest | ConvertTo-Json -Depth 6) + [Environment]::NewLine,
  [Text.UTF8Encoding]::new($false)
)
Move-Item -LiteralPath $temporary -Destination $manifestPath -Force

$notice = @(
  'EVA Codex + DSH boot pack',
  '',
  'This directory contains media copied from the local dsh-plugin-eva-theme',
  'checkout solely for use on this computer. The files are not part of the',
  'EVA Codex public repository and must not be redistributed with it.',
  '',
  "Source: https://github.com/seaison/dsh-plugin-eva-theme",
  "Commit: $commit",
  "DSH notice: $noticePath",
  "DSH license: $licensePath",
  '',
  'The DSH code is MIT-licensed. Its third-party media is excluded from MIT.',
  'EVA characters, NERV marks, voices and music belong to their respective',
  'rightsholders. Keep the DSH NOTICE and LICENSE with the original checkout.'
) -join [Environment]::NewLine
Set-Content -LiteralPath (Join-Path $Destination 'PACK-NOTICE.txt') -Value $notice -Encoding UTF8

[pscustomobject]@{
  status = 'PASS'
  source = $source
  sourceCommit = $commit
  destination = $Destination
  assets = $assets.Count
  bytes = ($assets | ForEach-Object { [long]$_['bytes'] } | Measure-Object -Sum).Sum
  manifest = $manifestPath
} | ConvertTo-Json
