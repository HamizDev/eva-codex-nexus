# EVA Codex Nexus · v0.1.1 开发交接

基线日期 2026-11-11。当前默认形态为**官方 Codex Desktop + EVA 皮肤**；旧的独立工作台保留为备用入口，不再作为默认启动方式。

## 官方皮肤链

- `Start-EVA.cmd` → `codex-skin/Start-EVA.ps1`；
- `Start-EVA.ps1` 通过 `Get-AppxPackage OpenAI.Codex` 发现已签名的官方客户端，校验 Authenticode，并验证 CDP 监听进程确实属于该安装；
- 以 `--remote-debugging-address=127.0.0.1 --remote-debugging-port=9345 --user-data-dir=%LOCALAPPDATA%\EVACodexSkin\cdp-profile` 启动受控实例；
- `codex-skin/injector.mjs` 只接受 `app://-/index.html`，拒绝 `avatar-overlay`、非回环 WebSocket 和非官方页面；
- 启动器根据官方 Codex 主进程启动时间生成 `bootId`；注入器首次连接时注入 `assets/boot.css`，同一进程只显示一次，刷新和主题切换不重播；点击、`Esc` 或 `prefers-reduced-motion` 可跳过；
- CSS 与装饰层由 `Page.addScriptToEvaluateOnNewDocument` 和 `Page.loadEventFired` 维持，watcher 在页面重载和 driver 切换时重新应用；
- `Restore-EVA.ps1` 清理启动层、样式、覆盖层、dataset 标记，并在校验 PID/命令行后停止注入器；
- 不修改 WindowsApps、`app.asar`、签名、认证、Base URL、API Key 或 Codex 协议。

## 备用工作台链

- `Start-EVA-Workbench.cmd` → `workbench/start.ps1` → `workbench/server.cjs` → 官方 `codex app-server`；
- 前端在 `workbench/public/`；主题、Markdown、终端、Git、插件和审批逻辑继续沿用 v0.0.2 的实现。

## 关键验收规则

1. `npm test` 全通过（含 workbench 和 `codex-skin/tests`）。
2. `npm run manifest && npm run verify:public` 无错误，公开源码不包含 `%LOCALAPPDATA%\EVACodexSkin`、CDP 配置、凭据、原素材或本地运行数据。
3. 官方 renderer 更新后先运行 `node codex-skin/injector.mjs --verify --port 9345`，再更新 `codex-skin/selectors.json` 和 `assets/eva-skin.css`。
4. 完整启动路径应在用户方便时执行一次：关闭当前 Codex → `Start-EVA.cmd` → 自动重开 → 确认侧栏、聊天、输入框和审批可交互。
5. 所有上传的影音素材都要独立核对授权。MIT 软件许可不覆盖原作角色、声音、音乐和商标。

## 已验证与未验证

- 已验证：`OpenAI.Codex 26.1106.6628.0` / Chromium `157.0.8103.51` 的受控第二实例上，冷启动启动层、刷新不重播、Asuka/Rei 注入、watcher 切换、Esc 跳过、减少动态效果、`--verify`、`--remove` 均通过；当前正在使用的 Codex 未被强制关闭。
- 未验证：从“当前 Codex 正在运行且没有 CDP”到“关闭→Appx 激活→重开”的完整交互路径；需要在真实日常窗口上再跑一次。
- 未验证：Store 自动更新到新 DOM 后的选择器兼容性。

## 后续优先级

1. 在真实日常窗口执行完整重启路径，并记录 Appx 激活是否保留 CDP 参数；若丢弃则确认直接可执行文件回退。
2. 为设置页、菜单、弹窗、代码块和审批面板补截图级回归。
3. 增加可选的“暂停皮肤但不关闭 Codex”控制（当前恢复需要 `Restore-EVA.cmd` 或关闭窗口）。
4. 为 Store 更新做选择器 doctor 和降级提示。
5. 继续保留原工作台，不将官方皮肤的选择器假设反向写进旧工作台。
