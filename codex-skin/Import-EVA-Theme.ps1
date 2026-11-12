[CmdletBinding()]
param(
  [string]$SourceRoot,
  [string]$Destination,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$StateRoot = Join-Path $env:LOCALAPPDATA 'EVACodexSkin'
if (-not $Destination) { $Destination = Join-Path $StateRoot 'eva-theme' }
$Destination = [IO.Path]::GetFullPath($Destination)
$RepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$BundledThemeRoot = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'eva-theme'))

function Resolve-EvaThemeSource {
  param([string]$Requested)
  $candidates = @()
  if ($Requested) {
    $candidates += $Requested
  } else {
    if ($env:EVA_THEME_SOURCE_ROOT) { $candidates += $env:EVA_THEME_SOURCE_ROOT }
    $candidates += @(
      (Join-Path $RepoRoot 'eva-theme')
    )
    $researchRoot = Join-Path (Split-Path -Parent $RepoRoot) 'skin-research'
    if (Test-Path -LiteralPath $researchRoot -PathType Container) {
      $candidates += @(Get-ChildItem -LiteralPath $researchRoot -Directory -ErrorAction SilentlyContinue |
        ForEach-Object { $_.FullName })
    }
  }
  foreach ($candidate in $candidates) {
    if (-not $candidate) { continue }
    $full = [IO.Path]::GetFullPath($candidate)
    if (Test-Path -LiteralPath (Join-Path $full 'assets\manifest.json') -PathType Leaf) {
      return $full
    }
  }
  throw '没有找到本地 EVA 主题素材目录。请运行 Import-EVA-Theme.cmd "D:\path\to\eva-theme"。'
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

$source = Resolve-EvaThemeSource -Requested $SourceRoot
$assetManifestPath = Join-Path $source 'assets\manifest.json'
$noticePath = Join-Path $source 'NOTICE.md'
$licensePath = Join-Path $source 'MEDIA-LICENSE.md'
if (-not (Test-Path -LiteralPath $licensePath -PathType Leaf)) {
  $licensePath = Join-Path $source 'LICENSE'
}
$packagePath = Join-Path $source 'package.json'
foreach ($required in @($assetManifestPath, $noticePath, $licensePath)) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
    throw "本地素材目录缺少必要文件：$required"
  }
}

$assetManifest = Get-Content -LiteralPath $assetManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$package = if (Test-Path -LiteralPath $packagePath -PathType Leaf) {
  Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json
} else {
  $null
}
$commit = if ($assetManifest.sourceCommit) {
  [string]$assetManifest.sourceCommit
} else {
  $value = $null
  try {
    $value = (& git -C $source rev-parse HEAD 2>$null).Trim()
    if ($LASTEXITCODE -ne 0) { $value = $null }
  } catch {}
  $value
}

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
  'logo',
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
  'typing',
  'bootBgm'
)
$assets = @()
foreach ($id in $requiredAssetIds) {
  $sourceEntry = $assetManifest.assets.$id
  if (-not $sourceEntry -or -not $sourceEntry.file) {
    throw "素材清单缺少 $id。"
  }
}
foreach ($id in $requiredAssetIds + $optionalAssetIds) {
  $sourceEntry = $assetManifest.assets.$id
  if (-not $sourceEntry -or -not $sourceEntry.file) {
    if ($optionalAssetIds -contains $id) { continue }
    throw "素材清单缺少 $id。"
  }
  $relative = [string]$sourceEntry.file
  if ($relative -match '(^|[\\/])\.\.([\\/]|$)' -or [IO.Path]::IsPathRooted($relative)) {
    throw "素材路径不安全：$relative"
  }
  $sourceFile = Join-Path (Join-Path $source 'assets') $relative
  if (-not (Test-PathWithinRoot -Root (Join-Path $source 'assets') -Path $sourceFile) -or
    -not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
    throw "素材不存在或越界：$sourceFile"
  }
  $bytes = (Get-Item -LiteralPath $sourceFile).Length
  $sha = Get-Sha256 -Path $sourceFile
  if ($sourceEntry.bytes -and [long]$sourceEntry.bytes -ne $bytes) {
    throw "素材大小校验失败：$relative（清单 $($sourceEntry.bytes)，实际 $bytes）"
  }
  if ($sourceEntry.sha256 -and ([string]$sourceEntry.sha256).ToLowerInvariant() -ne $sha) {
    throw "素材 SHA-256 校验失败：$relative"
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
      Write-Host "启动素材已经是最新版本（$($commit.Substring(0, 8))）。"
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
    throw "复制后的素材校验失败：$targetFile"
  }
}

$manifest = [ordered]@{
  schemaVersion = 1
  package = 'eva-theme-pack'
  sourceRepository = if ([string]::Equals($source, $BundledThemeRoot, [StringComparison]::OrdinalIgnoreCase)) { 'eva-codex-nexus/eva-theme' } else { 'local-only' }
  sourceCommit = $commit
  sourceVersion = if ($package) { [string]$package.version } elseif ($assetManifest.sourceVersion) { [string]$assetManifest.sourceVersion } else { $null }
  importedAt = [DateTime]::UtcNow.ToString('o')
  redistribution = 'local-only; see MEDIA-LICENSE.md; no redistribution without written permission'
  features = @(
    'boot-sequence',
    'boot-bgm',
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
  'EVA Codex theme media',
  '',
  'This directory contains media imported for use on this computer.',
  'The source media is subject to eva-theme/MEDIA-LICENSE.md.',
  'Do not copy, mirror, publish, or redistribute it without prior',
  'written permission from HamizDev.',
  '',
  "Source: $source",
  "Commit: $commit",
  "Source notice: $noticePath",
  "Source license: $licensePath",
  '',
  'EVA characters, NERV marks, voices and music belong to their respective',
  'rightsholders. Keep the source NOTICE and LICENSE with the original checkout.'
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
