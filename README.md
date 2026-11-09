# EVA Codex Nexus

> 非官方、本地运行的 Codex 开发工作台。灵感来自 EVA 作品及 [DSH EVA Theme](https://github.com/seaison/dsh-plugin-eva-theme)。**首个版本：v0.0.1（开发预览）**。

使用自己电脑上的 **官方 Codex CLI / app-server**，不修改官方 Codex 客户端，不逆向认证，不绕过订阅配额。现有 Windows 本地界面具备 Codex 聊天与流式输出、图片、项目与会话管理、权限审批、停止任务、PowerShell 终端、Git 操作和插件管理等基础能力。

## EVA 主题

- **02 / 明日香**：红黑工作台、NERV 风格界面、现有二号机启动动画。
- **00 / 绫波丽**：白蓝工作台配色预览（**00 号机的专用开场尚未实现**）。
- 支持手动切换，或跟随 Windows 系统深色/浅色模式；偏好仅保存到本机浏览器。
- 本地系统时钟、轻量版 Markdown/代码块/表格阅读；任务完成和人工审批有可开关的本地合成提示音，**默认关闭**，不包含原作语音或音乐。
- 使用现代浏览器的 `prefers-reduced-motion` 选项降低动画干扰。

## Windows 启动

**依赖**：Windows 10/11、Microsoft Edge、Node.js 20+（含 npm）、官方 Codex CLI；需要 Git 功能时安装 Git for Windows。

1. [安装官方 Codex CLI](https://developers.openai.com/codex/cli/)，在 PowerShell 中确认 `codex --version`，并完成你自己的账号登录。
2. 确认 `node --version`、`npm --version` 可用。
3. 下载源码 ZIP 并完整解压（或 `git clone`）。**不要直接从压缩包双击启动**。
4. 双击 `Install-Dependencies.cmd`，或在项目根目录执行 `npm run setup`。
5. 双击 `Start-EVA.cmd`，首次启动按提示进入本地工作台。默认服务地址为 `http://127.0.0.1:43137`。
6. 在工作台中添加你的项目文件夹。默认是只读会话；如允许更改文件，请在新会话中选择“允许项目写入”，需要额外权限时必须人工确认。

调试可运行：

```powershell
npm test
npm run manifest
npm run verify:public
```

工作台退出按钮会停止后台服务。不要公开 `workbench/data/`：里面可能保存会话、附件和运行日志。升级前请备份该目录，不要把你的个人数据打包上传到 GitHub。

## 目前的限制

- 这是 Windows 本地开发预览，**尚未在全新 Windows 设备与最新 CLI 的完整登录、审批和任务闭环中验收**。
- 本工作台的会话存储不等同于官方 Codex 完整历史；没有保证跨设备同步。
- 00 号机尚未实现完整动画、角色头像与角色声线；时钟不代表真实 TPS。
- Markdown 渲染是轻量子集，不是完整 CommonMark/GFM；不会执行原始 HTML。
- Git 操作不提供强推或危险回滚；插件需要本机 Codex CLI 支持相应命令。
- 暂无安装器、自动更新和 macOS/Linux 完整支持。

## 中文社区维护约定

- GitHub 仓库描述、README、更新日志、Issue 与 Release 公告优先使用简体中文；保留 API、命令、路径、技术术语和第三方授权文本的原文。
- Git 提交消息采用中文，建议格式：`新增：支持驾驶员主题切换`、`修复：解决启动失败`、`优化：降低会话刷新开销`、`文档：完善安装说明`。
- 版本从 `v0.0.1` 开始管理；公开发布前执行 `npm test`、`npm run manifest` 和 `npm run verify:public`。
- 欢迎中文 Issue；报告问题时请隐去账号、令牌、聊天记录及项目敏感信息。

## 开源与来源

项目基于 [Iris-change/eva-codex-workbench](https://github.com/Iris-change/eva-codex-workbench) 的 MIT 授权源码继续开发，保留原作者版权声明。DSH EVA 项目提供了主题色板、双驾驶员、视觉组件及性能处理的设计参考。详细见 [UPSTREAM.md](UPSTREAM.md)、[CODE-ORIGINS.md](CODE-ORIGINS.md) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

**代码 MIT 不代表 EVA 角色、商标、原声、音乐可以自由转载**。当前公开版不包含 DSH 原始角色贴图、MP3、GIF 或背景音乐。替换流程见 [ASSET-TODO.md](ASSET-TODO.md) 与 [ASSETS.md](ASSETS.md)。

此项目与 OpenAI、Studio Khara、Gainax 和相关权利方均无官方关联。
