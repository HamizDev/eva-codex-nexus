# EVA Codex Nexus v0.0.1 首次推送脚本
# 仅适用于全新空仓库，不覆盖远程历史。请确认源码目录及脚本内容后再运行。
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$repository = 'https://github.com/HamizDev/eva-codex-nexus.git'

function Invoke-Git {
    & git @args
    if ($LASTEXITCODE -ne 0) { throw "Git 命令执行失败（退出码 $LASTEXITCODE）：git $($args -join ' ')" }
}

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw '未找到 Git，请先安装 Git for Windows。'
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw '未找到 Node.js，请先安装 Node.js 20 或更高版本。'
    }

    Write-Host '[1/5] 验证本地源码与敏感文件...' -ForegroundColor Cyan
    & node scripts/check-release.cjs --public
    if ($LASTEXITCODE -ne 0) { throw '发布校验未通过，已取消推送。' }
    if (-not (Test-Path -LiteralPath '.git' -PathType Container)) {
        Invoke-Git init -b main
    }

    $origin = (& git remote get-url origin 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $origin) {
        Invoke-Git remote add origin $repository
    } elseif ($origin.Trim().TrimEnd('/') -notin @(
        $repository,
        'git@github.com:HamizDev/eva-codex-nexus.git'
    )) {
        throw "当前 origin 指向其他仓库：$origin。已停止，避免误推送。"
    }

    Write-Host '[2/5] 确认远程 main 没有现有提交...' -ForegroundColor Cyan
    $remoteRefs = & git ls-remote --heads origin main
    if ($LASTEXITCODE -ne 0) { throw '无法访问 GitHub，请先完成 GitHub 登录或检查网络。' }
    if ($remoteRefs) { throw '远程 main 已存在提交：为避免覆盖历史，此首次推送脚本已停止。' }

    Write-Host '[3/5] 暂存项目文件...' -ForegroundColor Cyan
    Invoke-Git add -A
    $staged = & git diff --cached --name-only
    if (-not $staged) { throw '没有可提交的文件。' }
    # 双重防护：明确阻止私人数据与认证材料进入首次提交。
    if ($staged | Where-Object { $_ -match '(^|/)(data|node_modules|sandbox|\.git|\.env)(/|$)|(^|/)(auth|credentials|secrets)\.json$|\.(?:pem|p12|pfx|key)$' }) {
        throw '暂存区包含私人文件或依赖目录，已取消推送。'
    }

    Write-Host '[4/5] 创建中文首个提交...' -ForegroundColor Cyan
    Invoke-Git branch -M main
    Invoke-Git commit -m '初始化：发布 EVA Codex Nexus v0.0.1 中文预览版'

    Write-Host '[5/5] 推送 main 到 GitHub（使用本机 Git 凭据）...' -ForegroundColor Cyan
    Invoke-Git push -u origin main
    Write-Host "已完成： https://github.com/HamizDev/eva-codex-nexus" -ForegroundColor Green
} catch {
    Write-Host "推送中止：$($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
