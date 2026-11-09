# EVA Codex Nexus v0.0.1：GitHub 建仓指南

**仓库名称**：`eva-codex-nexus`  
**推荐账号**：`HamizDev`  
**默认分支**：`main`  
**公开方式**：Public（公开仓库）

## 仓库描述（中文）

> 一款受《新世纪福音战士》EVA 与 NERV 系统启发的 Codex 开发工作台，融合双驾驶员主题、沉浸式启动动画与 AI 编程体验。

建议 GitHub Topics：`codex`、`ai-coding`、`eva-theme`、`nerv`、`windows`。

## 第一次推送

先在 GitHub 创建空仓库，不勾选自动创建 README、许可证或 .gitignore。然后在解压后的 `eva-codex-nexus` 目录，使用 PowerShell 执行：

```powershell
npm test
npm run manifest
npm run verify:public
git init
git branch -M main
git add .
git status --short
git commit -m "初始化项目：发布 EVA Codex Nexus v0.0.1 预览版"
git remote add origin https://github.com/HamizDev/eva-codex-nexus.git
git push -u origin main
```

如果创建在其他账号或组织下，调整 `git remote add origin` 的 URL。如果远端已经有提交，先检查远端历史，不要强制覆盖。

## 中文提交规范

- `新增：实现绫波丽专用启动序列`
- `修复：解决 Windows 启动器重复连接旧进程`
- `优化：降低长会话渲染开销`
- `文档：补充安装指南与常见问题`
- `发布：发布 v0.0.2 预览版`

README、更新日志、Release 正文和 Issue 模板均以简体中文为主；许可证、第三方代码署名、CLI 命令和技术标识保留必要原文。

## 发布前检查

不能提交 `workbench/data/`、`node_modules/`、本机登录文件、凭据、未授权的角色图片或音轨。当前是源码预览版，还未包含独立安装器，也未进行 Windows 新设备的完整实机验收。
