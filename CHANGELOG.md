# 更新日志

## v0.1.0 · 2026-11-11

### 架构变更

- 默认入口从独立 Web 工作台切换为**官方 Codex + EVA 皮肤**：保留官方侧栏、项目、会话、输入框、审批、菜单和快捷键，只叠加 EVA 配色与非交互装饰层。
- 新增 `codex-skin/`：Appx 发现与签名校验、回环 CDP 启动、renderer 目标识别、CSS/JS 注入、页面重载重注入、主题切换和恢复。
- `Start-EVA.cmd` 改为官方皮肤入口；新增 `Restore-EVA.cmd`；旧的独立工作台保留为 `Start-EVA-Workbench.cmd`。
- 使用 `%LOCALAPPDATA%\EVACodexSkin\cdp-profile` 隔离 Chromium 配置，不修改 WindowsApps、`app.asar`、签名、认证或 API 配置。

### 新增

- 02 明日香红黑主题与 00 绫波丽白蓝主题，支持 `Start-EVA.cmd asuka` / `Start-EVA.cmd rei` 切换。
- `codex-skin/selectors.json` 稳定选择器合同，覆盖 `_MainContentSurface_`、`ComposerLayoutRoot`、`ConversationSidebar`、header、菜单和 dialog。
- 回环 WebSocket 校验、宠物 overlay 排除、Codex shell 探针、`Page.addScriptToEvaluateOnNewDocument` 早期注入和 `Page.loadEventFired` 重注入。
- `Restore-EVA.cmd` 通过 CDP 清理 DOM 节点，并校验 PID 后停止注入器。
- 皮肤测试：目标识别、CDP URL 拒绝、选择器合同、CSS 安全边界、PowerShell BOM/启动契约、恢复流程和版本一致性。

### 验证

- 在 `OpenAI.Codex 26.1106.6628.0` / Chromium `157.0.8103.51` 的受控第二实例上完成 Asuka、Rei 注入、watcher 切换、`--verify` 和 `--remove` 冒烟。
- 当前正在使用的 Codex 窗口没有被强制关闭；完整 Appx 重启路径仍需用户在方便时执行一次。
- `npm test`、`npm run manifest`、`npm run verify:public` 结果见本次发布提交。

## v0.0.2 · 2026-11-11

### 修复

- 适配新版 Codex CLI 的审批决定：命令审批不再固定发送 `decline`；缺少该选项时改用 `cancel`，拒绝和“仅允许本次”均已实测通过。
- 新增审批决定回归测试，覆盖 `decline`、`cancel` 与旧版 CLI 决定列表。
- 统一版本号到 `0.0.2`，同步根 package、workbench package、lockfile、服务端、启动脚本和 app-server 客户端标识。

### 维护

- 重新生成 `MANIFEST.json`，移除已删除文件的过期引用。
- 统一文本文件换行符，避免新 clone 后 Git 面板出现仅由 CRLF 造成的修改。

### 验证

- `npm test` 34/34 全通过。
- `npm run manifest` 与干净源码树上的 `npm run verify:public` 通过。

## v0.0.1 · 2026-11-09

以 **EVA Codex Nexus** 为新的项目名称，基于既有 EVA Codex Workbench 开启独立版本线，从 `0.0.1` 重新编号；**不是删减版或重新编写 Codex 引擎**。

### 中文化与建仓规范

- GitHub 仓库名统一为 `eva-codex-nexus`，README、发布说明与提交规范以简体中文为主。
- 项目 UI 标题与 Codex 客户端标识统一为 EVA Codex Nexus，并将 app-server 初始化版本同步到 `0.0.1`。
- 保留 Iris-change 与其他第三方原作者的版权和来源声明。

### 已实现

- 保留上游工作台 Codex app-server 桥接、流式消息、人工审批、项目与会话、本地终端、Git、插件管理。
- 深浅色系统跟随：Windows 深色 → 02 明日香红黑；浅色 → 00 绫波丽白蓝。支持手动覆盖与持久化。
- 提取 DSH 配色思路，强化明日香红黑对比；保留绫波丽基础主题。
- 独立系统时钟（本地显示，不对外传输），避免虚构 TPS 指标。
- 安全的轻量 Markdown 结构渲染：标题、粗体、列表、引用、链接、表格和代码块复制；只创建 DOM 文本节点，不执行模型输出中的 HTML。
- 审批/任务完成提示音：基于真实会话状态变化触发，默认关闭，采用独立原创电子短音，不复制动漫语音或配乐。
- 取消内置字体文件分发，标题改用系统字体回退；
- 新增上游与版权追溯、素材替换说明、中文建仓指南；公开发布校验避免包含 `data/`、凭据和可选授权音轨。

### 尚未完成

- 00 绫波丽独立启动序列、完整驾驶员拖放与语音生命周期。
- 正式角色图素材与音乐的授权核实、替换及视觉精准还原。
- 大历史记录的增量更新与分页、最新版 Codex CLI 的 Windows 全流程联调。
- 安装器和自动更新。
