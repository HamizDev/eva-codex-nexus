# 更新日志

## v0.3.0 · 2026-11-11

### 新增

- 在官方 Codex renderer 右侧加入常驻 `PILOT` 切换条，可即时在 `02 ASUKA` 与 `00 REI` 之间切换，无需重启客户端或再次运行启动器。
- 应用内选择写入 `localStorage`，watcher 同步写回 `driver.txt`；刷新、注入器重启和正常再次启动都会保留最后选择。
- `Start-EVA.cmd asuka|rei` 使用一次性覆盖 token：显式启动参数只覆盖一次，不会在之后的应用内选择或页面重载时反复抢回主题。
- 切换条使用独立 `pointer-events: auto` 与 `-webkit-app-region: no-drag`；装饰层继续不接管鼠标，窗口拖动与缩放不受影响。

### 修复

- 为排队消息导轨、卡片边框和“引导/删除”操作补齐 Asuka/Rei 面板色与强调线。
- 为文件变更胶囊补充 EVA 边框、左侧强调线和阴影；实时 DOM 再次确认不再出现白色底。
- 增加 `@media (max-width: 900px)` / `760px` 切换器紧凑布局，窄窗口只保留机体编号。
- `--verify` 现在同时检查切换器可见性、可点击性、激活主题、视口铺满和横向溢出。

### 验证

- 真实 renderer 中用 CDP 鼠标事件完成 `asuka → rei → asuka` 切换，按钮状态与持久化值一致。
- 真实窗口 `1280×828 → 1000×700 → 760×600 → 1280×828` 往返验证，覆盖层、切换器位置和 `overflowX` 均通过。
- 真实排队消息探测到面板背景为 EVA 深色、左侧强调线生效；测试消息随后删除并确认清空。
- 文件变更胶囊实测背景 `rgb(27,27,28 / 0.92)`、边框 `rgb(117,64,43)`、左侧强调线 `rgb(182,32,38)`。
- `npm run test:skin` 20/20 通过。
- `npm test` 54/54 通过；`npm run verify` 与 `npm run verify:public` 均通过 118 个公开源码文件校验。

## v0.2.2 · 2026-11-11

### 修复

- 将原生 `bg-surface-elevated-secondary` 浮层统一映射到 EVA 面板色，修复侧栏悬浮说明、文件变更提示和输出摘要面板的白色背景。
- 将 `bg-background-neutral-soft-alpha` 按钮映射到 EVA 面板色，修复改动卡片中“撤销”“查看变更”的白色底。
- 为改动汇总卡片补充深色面板、边框、悬浮提示阴影和强调线。
- 将用户消息气泡和 `bg-composer-primary` 发送按钮纳入 Asuka/Rei 两套主题，不再沿用官方浅色主题默认值。

### 验证

- 在真实 `app://-/index.html` renderer 上滚动到 18 文件改动卡片，实测卡片背景、按钮背景和边框均为 EVA 面板色。
- 在侧栏最近项目上触发悬浮说明，实测提示框为深色 EVA 面板、边框和强调线均生效。
- 当前视口浅色表面扫描结果为空；用户气泡、文件变更提示和发送按钮均已适配。
- `npm run test:skin` 19/19 通过，新增原生浮层与按钮选择器回归断言。

## v0.2.1 · 2026-11-11

### 修复

- 修复 Windows PowerShell 5.1 将 CDP `/json/list` 的 JSON 数组作为单一对象返回时，`Test-CdpEndpoint` 误判 `9345` 未开放的问题；启动器现在会先展开目标数组再校验 renderer。
- 增加 CDP 目标数组兼容性回归测试，避免再次出现“端口正常监听但提示没有开启本地 CDP”的问题。

### 验证

- 在正在运行的官方 Codex `26.1106.6628.0` renderer 上重新执行启动器，检测到 `127.0.0.1:9345` 并成功应用 Asuka 皮肤。
- `--verify` 返回 `installed: true`、`stylePresent: true`、`overlayPresent: true`、`pass: true`。
- 19 项皮肤测试通过，包含新增的 Windows PowerShell 5.1 数组兼容测试。

## v0.2.0 · 2026-11-11

### 新增

- 新增 `Start-EVA.vbs` 隐藏启动入口；桌面快捷方式目标为 `wscript.exe`，不再留下 CMD/PowerShell 控制台窗口。
- 新增 `Install-EVA-DesktopShortcut.cmd` / `scripts/Install-EVA-DesktopShortcut.ps1`：在桌面创建 `.lnk`，图标直接引用官方 `ChatGPT.exe,0`，与官方 Codex 图标一致。
- 新增 DSH 启动动画本地资源包：`Import-DSH-Boot.cmd` 从本机 `dsh-plugin-eva-theme` 仓库导入并校验 GIF、警报 SVG、插入栓 SVG、Asuka/Rei 头像与启动语音。
- 新增 `codex-skin/assets/dsh-boot.css` 与 DSH 启动状态机：GIF → NERV 警报 → 插入栓/驾驶员同步，播放对应启动语音，完成淡出。
- 无 DSH 资源包时保留原抽象启动层作为回退；有包时自动读取 `%LOCALAPPDATA%\EVACodexSkin\dsh-boot`。
- 新增 `DSH-BOOT.md`，记录导入方式、校验规则、本地目录和媒体许可边界。

### 修复与维护

- `Start-EVA.ps1` 新增 `-GuiPrompt`：隐藏启动时用 Windows 对话框显示“需要重启一次”和失败原因，避免卡在不可见的 `Read-Host`。
- 启动器将 DSH 启动包路径以 `--boot-pack` 传给注入器；启动包缺失、哈希不符或含主动 SVG 内容时拒绝使用并回退。
- DSH 启动包不进入公开仓库；GIF、角色图、语音和音乐继续适用 DSH 的独立 NOTICE，不因代码 MIT 自动获得再分发许可。
- 版本统一升级到 `0.2.0`，同步根/workbench package、lockfile、服务端、启动器、桥接标识和测试断言。

### 验证

- `npm run test:skin` 18/18 通过。
- 在 `OpenAI.Codex 26.1106.6628.0` / Chromium `157.0.8103.51` 的独立受控实例中，DSH GIF、警报、插入栓、头像、同步环和启动语音均渲染/播放通过。
- 验证冷启动仅播放一次、刷新不重播、`Esc` 跳过、`Space`/背景点击跳过、减少动态效果直接跳过、序列结束自动清理。
- 桌面快捷方式已创建并校验：目标、参数、工作目录与官方 Codex 图标路径正确；当前正在使用的 Codex PID 5048 未被关闭或重启。

## v0.1.1 · 2026-11-11

### 新增

- 官方 Codex 冷启动时增加一次性 EVA 启动层：Asuka 使用 02 红黑，Rei 使用 00 白蓝，展示同步环、机体编号与 SYNC RATIO。
- 启动动画约 2～4 秒，点击或按 `Esc` 可跳过；正常进入 Codex 后自动淡出。
- 使用官方 Codex 主进程启动指纹和 `localStorage` 标记，同一进程只播放一次；renderer 刷新、主题切换和注入器重启不重播。
- 尊重 `prefers-reduced-motion: reduce`，该设置下直接跳过启动层。
- 新增 `codex-skin/assets/boot.css`，全部为抽象 CSS 线框，不包含角色图片、原作语音、音乐或远程资源。

### 修复与维护

- 恢复流程会同时清理启动层、启动样式和启动指纹运行时对象。
- 启动器通过 `Get-CodexLaunchId` 生成稳定启动 ID，并传给注入器。
- 增加启动层源码、CSS、CLI 参数和 PowerShell 启动器契约测试。

### 验证

- 在 `OpenAI.Codex 26.1106.6628.0` / Chromium `157.0.8103.51` 的真实 renderer 上完成冷启动、刷新不重播、Esc 跳过、Rei 主题、减少动态效果和 `--remove` 清理验证。
- 当前正在使用的 Codex 窗口没有被关闭或重启。

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
