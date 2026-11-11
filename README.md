# EVA Codex Nexus

> 给**官方 Codex 客户端**换上一层 EVA 皮肤，而不是另做一个 Codex 工作台。
> **当前版本：v0.1.1（开发预览）**。非官方项目，与 OpenAI、Studio Khara、Gainax 及相关权利方均无关联。

从 v0.1.0 开始，默认入口 `Start-EVA.cmd` 启动的是**你电脑上已安装的官方 Codex**。侧栏、项目、会话、输入框、审批、菜单和快捷键仍然是 Codex 原生的，只额外叠加 EVA 的配色、线框和装饰层。v0.1.1 增加了每次启动播放一次的抽象 EVA 启动层。现有独立工作台保留为备用入口，不再抢占默认启动方式。

## 两种入口

| 入口 | 行为 |
| --- | --- |
| `Start-EVA.cmd` | **默认入口**：官方 Codex + EVA 皮肤（默认 02 明日香） |
| `Start-EVA.cmd rei` | 官方 Codex + 00 绫波丽皮肤 |
| `Start-EVA.cmd asuka` | 官方 Codex + 02 明日香皮肤 |
| `Start-EVA-Rei.cmd` | 双击切换到 00 绫波丽皮肤 |
| `Restore-EVA.cmd` | 移除当前皮肤，不关闭 Codex；官方文件不被修改 |
| `Start-EVA-Workbench.cmd` | 旧的独立 EVA 工作台，继续保留 |

首次使用默认入口时，如果 Codex 已经打开，脚本会提示**重启一次**，因为当前窗口没有开启本地调试端口。重启后会继续使用官方 Codex 的账号和会话数据；本工具不读取、不修改 `auth.json`、API Key、Base URL 或模型配置。

每次由 `Start-EVA.cmd` 启动一个新的 Codex 进程时，会先播放约 2～4 秒的启动层；点击或按 `Esc` 可跳过。刷新 renderer、切换主题或重新附加注入器不会重播；系统开启“减少动态效果”时直接跳过。

## 使用流程

默认入口的日常流程和官方 Codex 一致：

- 用官方侧栏切换项目、置顶和最近会话；
- 新建聊天、选择模型、附加文件、发送任务；
- 使用原生审批、停止、回滚和设置；
- 使用原生菜单、搜索、快捷键和窗口行为；
- 关闭窗口即退出本次皮肤会话。

皮肤不是独立客户端，也不是网页套壳。它向官方 renderer 注入配色 CSS、常驻的 `pointer-events: none` 装饰层，以及启动时短暂显示的启动层；启动层结束后会完全释放输入。它不会替换 React 组件，不会修改 `app.asar`，不会改签名，也不会绕过登录或订阅配额。

## 环境要求

- Windows 10/11；
- 官方 Codex 桌面客户端（Microsoft Store 安装，Appx）；
- Node.js 22 或更高版本（官方皮肤使用内置 WebSocket；旧工作台仍可用 Node.js 20+）；
- Windows PowerShell 5.1 或 PowerShell 7；
- 无需安装浏览器插件，也无需修改系统权限。

## 工作方式

1. 通过 `Get-AppxPackage OpenAI.Codex` 找到已签名、已注册的官方客户端；
2. 以 `--remote-debugging-address=127.0.0.1 --remote-debugging-port=9345` 启动一个受控实例；
3. 使用独立的 Chromium 配置目录 `%LOCALAPPDATA%\EVACodexSkin\cdp-profile`，避免污染官方默认配置；
4. 只连接 URL 为 `app://-/index.html` 的页面，拒绝 `avatar-overlay` 宠物层和非回环 WebSocket；
5. 从官方 Codex 主进程的启动时间生成一次性启动指纹，首次连接时注入 `assets/boot.css` 和抽象启动层；
6. 注入 `codex-skin/assets/eva-skin.css` 和常驻抽象装饰层；
7. 监视页面重载和主题切换，自动重新应用，但同一 Codex 进程不重播启动层；
8. `Restore-EVA.cmd` 删除样式、启动层、装饰节点和注入器进程。

实现参考了现有 Codex 换肤项目的回环 CDP、目标校验、`Page.addScriptToEvaluateOnNewDocument` 和 watcher 架构；没有把它们的角色图片、音轨或主题素材打包进本仓库。选择器和适配边界记录在 `codex-skin/selectors.json`。

## 安全边界

- CDP 只绑定 `127.0.0.1`，但调试通道本身没有额外认证。皮肤运行期间，本机其他程序理论上可以连接该端口。
- 不要把端口转发到局域网或公网；不要在运行皮肤时执行来路不明的本机程序。
- 退出皮肤：运行 `Restore-EVA.cmd`，或直接关闭该 Codex 窗口。
- 不修改 WindowsApps、`app.asar`、官方签名、账号令牌、网络代理或 Codex 配置。
- 如果官方客户端更新导致选择器失效，皮肤会降级为只注入颜色层；不会接管输入和审批。

## 验证状态

已在 `OpenAI.Codex 26.1106.6628.0`、Chromium `157.0.8103.51` 的真实 `app://-/index.html` renderer 上做过受控实例冒烟：

- 02 明日香与 00 绫波丽两套皮肤均能注入；
- 冷启动时启动层在 Codex shell 就绪前出现，Asuka / Rei 两套编号和配色均正常；
- 刷新页面不重播启动层，`Esc` 可跳过，“减少动态效果”下不显示；
- 侧栏、主区、输入框、原生按钮仍可交互；
- 皮肤层 `pointer-events: none`；
- 切换 driver 后 watcher 能重新应用；
- `--remove` 后样式、覆盖层和 dataset 标记均消失；
- `--verify` 能识别注入前后的状态。

没有在本次会话中强行重启你正在使用的 Codex 窗口；`Start-EVA.cmd` 的完整“关闭当前窗口→Appx 激活→重新打开”路径需要你在方便时执行一次。如果 Appx 激活丢弃 CDP 参数，脚本会自动回退到直接启动已签名的 Store 可执行文件。

## 开发与发布检查

```powershell
npm test
npm run manifest
npm run verify:public
```

只跑皮肤测试：

```powershell
npm run test:skin
```

手动检查注入状态：

```powershell
node codex-skin\injector.mjs --verify --port 9345
node codex-skin\injector.mjs --remove --port 9345
```

## 目录

```text
codex-skin/
  Start-EVA.ps1          # 官方 Codex 启动/重启/注入
  Restore-EVA.ps1        # 移除皮肤
  injector.mjs           # CDP 目标校验、注入、watcher、verify/remove
  selectors.json         # 稳定 DOM 锚点合同
  assets/
    eva-skin.css         # 两套配色和装饰层
    boot.css             # 单次启动层
    asuka-mark.svg
    rei-mark.svg
    linework.svg
  tests/
workbench/               # 旧独立工作台，保留
```

## 已知限制

- Codex 更新可能改变 DOM 和 CSS Module 前缀；届时需要先运行 `--verify`，再更新 `selectors.json` 和皮肤 CSS。
- 独立配置目录首次进入时可能需要登录一次；不同环境和版本不保证一定自动复用已有会话。
- 没有实现自动更新、托盘控制、安装器或 macOS/Linux 版本。
- 皮肤不改变模型、账户、计费、配额或任务执行逻辑。
- 启动层只有抽象数字、线框和扫描动效，不含角色插画、原作语音或音乐。

## 素材与许可

代码采用 MIT；原工作台底座 `Iris-change/eva-codex-workbench` 的版权声明继续保留。公开包只包含抽象线框、编号和调色板，不包含 DSH 角色 PNG、GIF、语音、音乐或动画片段。

MIT 不覆盖 EVA 角色形象、NERV/EVA 商标、原作音乐或语音。素材边界见 `ASSETS.md`、`ASSET-TODO.md` 和 `codex-skin/assets/README.md`；第三方参考见 `THIRD_PARTY_NOTICES.md`。
