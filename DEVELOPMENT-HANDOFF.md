# EVA Codex Nexus · v0.0.1 开发交接

基线日期 2026-11-09。以 `0.4.0-preview` 本地开发包为程序基础，重新开启 v0.0.1 版本线，并对照 GitHub `Iris-change/eva-codex-workbench` 及 `seaison/dsh-plugin-eva-theme` 的公开 `main` 分支。

## 当前架构

- `workbench/bridge.cjs`：通过官方 Codex CLI 的 `codex app-server --listen stdio://` 进行连接，不修改官方客户端。
- `workbench/server.cjs`：localhost HTTP、项目状态、会话和审批接口。
- `workbench/public/index.html`、`app.js`：主 UI；`theme.js` 和 `unit00.css` 管理主题。
- `workbench/public/markdown-lite.js`：安全 Markdown 子集，不接受可执行 HTML。
- `workbench/public/pilot-alerts.js`：状态变化通知，默认静音；`system-clock.js`：本机时间。
- `scripts/generate-manifest.cjs` 与 `check-release.cjs`：发布物清单和私人文件阻断。

## 关键验收规则

1. `npm test` 全通过（v0.0.1 当前 31 个 Node 自动测试）。
2. `npm run manifest && npm run verify:public` 无错误，所有构件版本一致，公开 ZIP 无凭据 / 原素材 / 本地运行数据。
3. Windows 实机另需验证：登录、断线重连、消息流、图片、审批允许/拒绝、终端、Git、插件和退出。
4. 开场当前仍为二号机：绫波丽仅工作台配色预览，不能宣称 DSH 双角色启动完整移植。
5. 所有上传的影音素材都要独立核对授权。MIT 软件许可不覆盖原作角色、声音和音乐。

## 后续优先级

1. Windows 最新 Codex CLI 真实运行验收及协议覆盖。
2. 减少全量 SSE 和长聊天 DOM 重建，增加历史分页/内存上限。
3. 完善两名驾驶员的统一启动状态机、系统减少动态效果及媒体同步。
4. 视觉资源库、版权追溯、测试截图、可配置 HUD 和 Windows 安装器。
