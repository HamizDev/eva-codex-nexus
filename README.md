<div align="center">

<img src="codex-skin/assets/nerv-logo.svg" width="84" alt="NERV 标志" />

# EVA Codex Nexus

**选择你的驾驶员，给原生 Codex 换一层 EVA 外壳。**

为**官方 Codex 桌面客户端**打造的 EVA 双角色皮肤，不是另做一个 Codex 工作台。<br />
明日香的红与黑，绫波丽的白与蓝；侧栏、项目、会话、输入框、审批与快捷键仍保持 Codex 原生。

[![Release](https://img.shields.io/badge/release-v0.4.3-b62026)](https://github.com/HamizDev/eva-codex-nexus/tree/v0.4.3) [![License](https://img.shields.io/badge/code-MIT-176b91)](LICENSE) [![Platform](https://img.shields.io/badge/platform-Windows-236c9d)](#环境要求)

[**下载最新版本**](https://github.com/HamizDev/eva-codex-nexus/archive/refs/tags/v0.4.3.zip) · [安装](#安装) · [使用流程](#使用流程) · [启动动画](#eva-启动素材包) · [更新日志](CHANGELOG.md) · [问题反馈](https://github.com/HamizDev/eva-codex-nexus/issues)

`eva-codex-nexus` · 当前版本 **v0.4.3（开发预览）**<br />
构建与验证基线：`OpenAI.Codex 26.1106.6628.0` · Chromium `157.0.8103.51`

</div>

> 非官方项目，与 OpenAI、Studio Khara、Gainax 及相关权利方均无关联。

从 v0.1.0 开始，默认入口启动的是**你电脑上已安装的官方 Codex**。侧栏、项目、会话、输入框、审批、菜单和快捷键仍然是 Codex 原生的，只额外叠加 EVA 的配色、线框和装饰层。v0.2.0 增加了无控制台启动、官方 Codex 图标的桌面快捷方式，以及可选的 EVA 主题素材包；v0.2.1 修复了 Windows PowerShell 5.1 下 CDP 目标列表误判、导致启动器拒绝注入的问题；v0.2.2 补齐了侧栏悬浮说明、改动汇总卡片、文件变更提示、用户气泡和发送按钮的面板配色；v0.3.0 增加应用内明日香/绫波丽切换、排队消息导轨适配，并完成真实窗口缩放验证；v0.3.1 修复用户消息气泡对比度，适配内置浏览器的标签、导航、地址栏、导入横幅和工具卡片，并在浏览器打开时自动收起驾驶员切换条；v0.3.2 适配右上角摘要面板的标题、分组线、文件行、缩略图和操作状态；v0.4.0 把角色立绘、选择语音、欢迎语音、审核/完成提醒和打字音接入本地媒体包，新增两类自动提醒开关、`表示設定` 面板、立绘透明度、主题内切换与完整媒体开关；v0.4.1 增加首次启动的驾驶员选择/拖放、修复启动层注入时机与完成音误播，并移除旧独立工作台和相关依赖；v0.4.2 将公开素材命名统一为 EVA Theme；v0.4.3 将设置面板改为可折叠的浮动面板，支持自由拖动、简繁日英四语言即时切换和估算输出速度 HUD。

## 安装

公开 GitHub 仓库包含换肤代码和 `eva-theme/` 素材包。`Install-EVA-DesktopShortcut.cmd` 和 `Start-EVA.cmd` 会在启动前自动校验并导入素材到本机 `%LOCALAPPDATA%\EVACodexSkin\eva-theme`，所以正常安装和启动不会再得到“无素材基础版”。`Import-EVA-Theme.cmd` 仍保留用于手动修复或重新导入。`eva-theme/assets` 下的媒体不适用代码的 MIT 许可，而适用独立的限制性许可：可以在本机使用，但未经权利人明确书面授权，不得复制、镜像或再发布到其他仓库、Release、安装包或产品。

### 效果范围

| 安装内容 | 可用效果 |
| --- | --- |
| 正常安装或启动 | 启动器自动导入仓库内 `eva-theme/`，得到完整启动演出、GIF/警报/插入栓、角色头像与立绘、选择/启动/欢迎/审核/完成语音、打字音和启动 BGM |
| 仅克隆仓库、未运行安装器/启动器 | 还没有安装皮肤；手动运行 `Import-EVA-Theme.cmd` 可先准备素材 |

### 自己安装

1. 从 Microsoft Store 安装官方 Codex 桌面客户端，并至少正常打开一次。
2. 安装 Node.js 22 或更高版本，确认 `node --version` 可以运行。
3. 下载本仓库 ZIP 或执行 `git clone https://github.com/HamizDev/eva-codex-nexus.git`，把仓库放在普通本地目录，不要直接从压缩包临时目录启动。
4. 默认安装会由第 5 步的快捷方式安装器自动导入仓库自带的 `eva-theme/` 素材包。需要手动修复或重新导入时，也可以运行：

   ```powershell
   Import-EVA-Theme.cmd
   # 或：Import-EVA-Theme.cmd "D:\path\to\eva-theme"
   ```

   素材只会复制到 `%LOCALAPPDATA%\EVACodexSkin\eva-theme`，不会改变仓库中的源文件。正常使用不需要手动执行这一步；目录、校验规则和媒体许可见 [EVA-THEME.md](EVA-THEME.md)、[eva-theme/MEDIA-LICENSE.md](eva-theme/MEDIA-LICENSE.md)。

5. 在仓库根目录运行 `Install-EVA-DesktopShortcut.cmd`；它会先导入 `eva-theme/` 素材，再创建桌面入口。之后从桌面 `EVA Codex` 启动；也可以直接运行 `Start-EVA.cmd`，启动器同样会自动准备素材。
6. 如果官方 Codex 已经打开且没有本地 CDP，启动器会提示重启一次。确认后它会重新打开官方 Codex。通常可以复用原本的登录状态；由于使用了独立的 CDP 配置目录，少数环境首次进入时可能需要重新登录一次。
7. 验证安装：

   ```powershell
   node codex-skin\injector.mjs --verify --port 9345
   ```

   返回 `installed: true`、`pass: true`、`version: "0.4.3"` 和 `driver`（当前驾驶员），即表示注入成功。若 `pass: false`，先查看日志，不要继续重启或修改官方客户端文件。

### 交给 AI 安装

可以把下面这段提示词连同仓库地址一起发给能访问本机终端的 AI：

```text
请在这个仓库根目录安装 EVA Codex Nexus。
先完整阅读 README.md、EVA-THEME.md、codex-skin/Start-EVA.ps1 和 codex-skin/injector.mjs，再开始操作。

步骤：
1. 用 Get-AppxPackage OpenAI.Codex 确认官方 Codex 已安装；只允许使用已签名、已注册的 Appx。
2. 检查 node --version >= 22、PowerShell 版本和仓库绝对路径。
3. 仓库的 eva-theme/ 包含角色 GIF、头像、立绘、语音、音效和 BGM；它们受 eva-theme/MEDIA-LICENSE.md 限制。不要把这些素材复制到其他仓库、Release 或安装包，也不要从第三方仓库补抓或生成媒体。
4. 运行 Install-EVA-DesktopShortcut.cmd；安装器会自动导入 eva-theme/ 素材，然后创建桌面入口。如果用户只想临时代理，可改用 Start-EVA.cmd，启动器同样会自动导入。
5. 导入后检查 %LOCALAPPDATA%\EVACodexSkin\eva-theme\manifest.json，确认 assets 数量至少为 20；如果素材导入失败，停止安装并报告错误，不要声称安装成功或悄悄退回无素材版。
6. 如果 Codex 正在运行且没有 CDP，先询问用户是否允许重启；不要静默关闭窗口。
7. 最后运行 node codex-skin\injector.mjs --verify --port 9345，并报告 Codex 版本、皮肤版本、素材包状态、installed/pass 结果和日志路径。

禁止修改 WindowsApps、app.asar、签名、auth.json、API Key、Base URL、模型配置或系统安全设置。
```

AI 安装时最重要的判断是：**默认安装必须自动带入 `eva-theme/` 素材，导入不等于获得再发布授权**。只让 AI 看仓库并运行安装器，应该得到截图中的完整效果；如果素材清单缺失或少于 20 个文件，必须报告失败，不能把无素材版当成安装成功。AI 也不得把素材复制到另一个仓库、Release 或安装包。若用户准备再发布，必须先取得权利人的明确书面授权。

## 入口

| 入口 | 行为 |
| --- | --- |
| 桌面 `EVA Codex` 快捷方式 | **推荐入口**：无控制台、官方 Codex 图标，官方 Codex + EVA 皮肤 |
| `Start-EVA.cmd` | 兼容入口：通过隐藏的 `Start-EVA.vbs` 启动；命令行窗口只短暂出现 |
| `Start-EVA.cmd rei` | 官方 Codex + 00 绫波丽皮肤 |
| `Start-EVA.cmd asuka` | 官方 Codex + 02 明日香皮肤 |
| 应用内右侧 `設 / SETTINGS` | 打开 `表示設定`：切换 02 明日香 / 00 绫波丽、简繁日英四语言、动画/语音/打字音与审核/完成自动提醒、试听五类语音、调整立绘透明度和输出速度 HUD；面板可折叠、自由拖动，选择会持久化 |
| `Start-EVA-Rei.cmd` | 双击切换到 00 绫波丽皮肤 |
| `Restore-EVA.cmd` | 移除当前皮肤，不关闭 Codex；官方文件不被修改 |
| `Install-EVA-DesktopShortcut.cmd` | 重新创建桌面快捷方式；图标取自官方 Codex 客户端 |
| `Import-EVA-Theme.cmd` | 从仓库内或指定素材目录导入启动动画和语音；安装器/启动器会自动执行，手动入口用于修复 |

Windows 的 `.cmd` 文件不能可靠地自定义图标。本项目的做法是创建一个目标为 `wscript.exe` 的 `.lnk` 快捷方式：它直接调用隐藏的 `Start-EVA.vbs`，图标使用 `ChatGPT.exe,0`，因此桌面上看到的是官方 Codex 图标，启动时也不会留下 CMD/PowerShell 黑框。

首次使用默认入口时，如果 Codex 已经打开，脚本会提示**重启一次**，因为当前窗口没有开启本地调试端口。重启后通常仍使用官方 Codex 的登录状态和会话数据；独立 CDP 配置目录首次进入可能需要登录一次。本工具不读取、不修改 `auth.json`、API Key、Base URL 或模型配置。

每次启动一个新的 Codex 进程时，启动器会先准备 `eva-theme/`，再播放启动层。注入器会避开 Codex 启动瞬间的过渡文档，在正式 renderer 主文档稳定后立即挂载启动层，不等聊天页完成渲染；启动序列只在窗口可见时推进，启动时窗口尚未显示也不会被后台计时跳过。如果 renderer 在动画中途重载，会重新挂载并完整播放，只有完整结束或主动跳过后才记为已播放。素材就绪后使用 `nerv-boot.gif → NERV 警报（实时时钟）→ 黑底逐字入口 → 选择驾驶员 → 插入栓/同步` 序列：选择页提供繁中、简中、日语、英语切换、角色立绘和右侧实时时钟，可把明日香或绫波丽的头像拖到左侧插入栓，也可直接点击角色卡或用键盘选择；选择后播放对应驾驶员的应答音和本机启动语音，并可选播放本机 BGM。正常安装和启动不允许静默退回无素材版；素材缺失或少于 20 个文件会直接报错。`Esc`、`Space` 或“跳过 / ESC”按钮可跳过，点击背景不会误退出；完成后刷新 renderer、应用内切换主题或重新附加注入器不会重播。系统开启“减少动态效果”时直接跳过。`表示設定 → 开机动画` 是整套启动流程的总开关，关闭后不会出现驾驶员选择页；启动语音、选择应答、欢迎语音和打字音可继续单独关闭。审核自动语音与完成自动语音默认关闭；手动打开后，待审批出现时播放一次审核提醒，主任务从运行中转为完成时播放一次完成提醒，刷新页面、打开旧会话或浏览历史消息不会误播。

## EVA 启动素材包

仓库内的完整启动素材位于 `eva-theme/`。正常安装器和启动器会自动导入；需要手动修复时，在仓库根目录运行：

```powershell
Import-EVA-Theme.cmd
```

导入器会校验 `eva-theme/assets/manifest.json` 中的字节数和 SHA-256，再把 20 个素材（启动 GIF、警报/插入栓、NERV 标识、两张头像、两张立绘、五类语音、打字音和启动 BGM）复制到 `%LOCALAPPDATA%\EVACodexSkin\eva-theme`，合计 14,586,757 字节。注入器启动时自动读取该目录；校验失败时不会使用损坏或篡改的包。素材只允许在本机导入使用，未经书面授权不得再发布；完整边界和目录结构见 [EVA-THEME.md](EVA-THEME.md) 和 [eva-theme/MEDIA-LICENSE.md](eva-theme/MEDIA-LICENSE.md)。

## 使用流程

默认入口的日常流程和官方 Codex 一致：

- 用官方侧栏切换项目、置顶和最近会话；
- 新建聊天、选择模型、附加文件、发送任务；
- 使用原生审批、停止、回滚和设置；
- 使用原生菜单、搜索、快捷键和窗口行为；
- 关闭窗口即退出本次皮肤会话。

皮肤不是独立客户端，也不是网页套壳。它向官方 renderer 注入配色 CSS、常驻的 `pointer-events: none` 装饰层，以及启动时显示、可跳过且可关闭的启动层；启动层结束后会完全释放输入。应用内切换驾驶员只更新配色、立绘和可选应答音，不会重新播放启动动画。它不会替换 React 组件，不会修改 `app.asar`，不会改签名，也不会绕过登录或订阅配额。

常驻装饰层本身仍为 `pointer-events: none`；右侧设置按钮和 `表示設定` 面板是唯一例外，只有这些控件接收点击，并使用 `-webkit-app-region: no-drag`，不会拖拽或遮挡原生窗口控制。窗口移动或缩放后，覆盖层跟随当前视口重新铺满；窄窗口下设置按钮压缩为 `設`，设置面板改为底部面板。

## 环境要求

- Windows 10/11；
- 官方 Codex 桌面客户端（Microsoft Store 安装，Appx）；
- Node.js 22 或更高版本（注入器使用内置 WebSocket）；
- Windows PowerShell 5.1 或 PowerShell 7；
- 无需安装浏览器插件，也无需修改系统权限。

## 构建与验证基线

| 项目 | 本机构建/验证值 |
| --- | --- |
| 皮肤版本 | `0.4.3` |
| 构建/验证日期 | `2026-11-12` |
| EVA 素材快照 | `0.51.2` / `f8b96381ceda724c58e79ec375e0dfe08d244349`，20 个文件、`14,586,757` 字节 |
| 官方 Codex Appx | `OpenAI.Codex 26.1106.6628.0` |
| Codex 包全名 | `OpenAI.Codex_26.1106.6628.0_x64__2p2nqsd0c76g0` |
| Renderer | Chromium `157.0.8103.51`，V8 `15.7.112.23` |
| Windows | Windows 11 `10.0.26300`，x64 |
| 本机 Node.js | `v24.22.2`（最低要求 22） |
| 本机 PowerShell | `7.6.9`；启动器同时保留 Windows PowerShell 5.1 兼容写法 |

其他 Codex 版本可能仍然可用，但官方客户端更新后 DOM 选择器或 CSS Module 名称可能变化。遇到设置入口、启动层或审批状态失效时，先运行 `--verify`，再把 Codex 版本和日志一起提交到 Issues。上面的版本只是当前实测基线，不代表所有未来版本都已验证。

## 工作方式

1. 通过 `Get-AppxPackage OpenAI.Codex` 找到已签名、已注册的官方客户端；
2. 以 `--remote-debugging-address=127.0.0.1 --remote-debugging-port=9345` 启动一个受控实例；
3. 使用独立的 Chromium 配置目录 `%LOCALAPPDATA%\EVACodexSkin\cdp-profile`，避免污染官方默认配置；
4. 只连接 URL 为 `app://-/index.html` 的页面，拒绝 `avatar-overlay` 宠物层和非回环 WebSocket；
5. 从官方 Codex 主进程的启动时间生成一次性启动指纹；若本机存在已校验的 EVA 主题素材包，则注入 `assets/eva-boot.css` 和带驾驶员选择/拖放的启动序列，否则注入抽象启动层；
6. 注入 `codex-skin/assets/eva-skin.css`、`skin-ui.js` 和常驻装饰层；
7. 读取本地媒体包，提供驾驶员切换、立绘、设置面板、语音试听、开机欢迎语音和可选的审核/完成自动提醒；
8. 监视页面重载、应用内主题切换及原生审批/运行状态，自动重新应用并做事件去重；同一 Codex 进程不重播启动层；
9. `Restore-EVA.cmd` 删除样式、启动层、设置 UI、装饰节点和注入器进程。

实现只使用本项目的官方 Codex CDP 注入、目标校验和 watcher；角色媒体由 `eva-theme/` 独立素材包提供，并受该目录的媒体许可约束。选择器和适配边界记录在 `codex-skin/selectors.json`。

## 安全边界

- CDP 只绑定 `127.0.0.1`，但调试通道本身没有额外认证。皮肤运行期间，本机其他程序理论上可以连接该端口。
- 不要把端口转发到局域网或公网；不要在运行皮肤时执行来路不明的本机程序。
- 退出皮肤：运行 `Restore-EVA.cmd`，或直接关闭该 Codex 窗口。
- 不修改 WindowsApps、`app.asar`、官方签名、账号令牌、网络代理或 Codex 配置。
- 如果官方客户端更新导致选择器失效，皮肤会降级为只注入颜色层；不会接管输入和审批。

## 验证状态

已在 `OpenAI.Codex 26.1106.6628.0`、Chromium `157.0.8103.51` 的真实 `app://-/index.html` renderer 上做过受控实例冒烟：

- 02 明日香与 00 绫波丽两套皮肤均能注入；
- 启动 GIF、NERV 警报、驾驶员选择页、拖放插入栓、驾驶员头像和同步进度均正常渲染；启动语音在本机受控实例中可自动播放；
- 在启动页可点击角色卡完成选择，也可把角色卡拖入插入栓；选择后主题、头像、单位编号和语音时长同步更新；
- 刷新页面不重播启动层，`Esc` 可跳过，完整序列结束后自动清理，“减少动态效果”下不显示；
- `表示設定 → 开机动画` 关闭后，下一次启动不显示选择页且不播放启动序列；应用内切换驾驶员不会触发启动页；
- 侧栏、主区、输入框、原生按钮仍可交互；
- 皮肤层 `pointer-events: none`；
- 应用内点击 `02 ASUKA` / `00 REI` 可即时换肤，`localStorage` 与 `driver.txt` 同步；
- `表示設定` 面板在真实 renderer 中打开、关闭、切换驾驶员和持久化验证通过；1440×1000 下完整内容无需滚动，1280×830 下无横向溢出；
- 内置浏览器打开时保留 `設` 设置入口，并把按钮下移到浏览器侧栏之外；
- 本地媒体包包含 20 个素材，立绘、五类语音试听、输入打字音和启动 BGM 均能读取；
- 审核/完成自动语音状态机在隔离 DOM 样例中通过：打开历史审批不误播，新审批只播一次，“运行中 → 新完成回复”只播一次，两类事件使用不同音源；
- 真实窗口缩放到 `1000×700`、`760×600` 后，覆盖层仍与视口等大，设置按钮保持在窗口内且无横向溢出；
- 真实排队消息导轨使用 EVA 面板色和强调线，测试消息已删除；
- 文件变更胶囊为深色面板、EVA 边框与左侧强调线；
- `--remove` 后样式、覆盖层和 dataset 标记均消失；
- `--verify` 能识别注入前后的状态。

桌面快捷方式已在本机创建并验证：目标为 `wscript.exe`，参数指向 `Start-EVA.vbs`，图标为官方 `ChatGPT.exe,0`，工作目录为仓库根目录。隐藏入口的完整“关闭当前窗口→Appx 激活→重新打开”路径仍受本机 Store 激活行为影响，不能仅由仓库静态检查替代；如果 Appx 激活丢弃 CDP 参数，脚本会自动回退到直接启动已签名的 Store 可执行文件。

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
  Import-EVA-Theme.ps1   # 校验并导入本地 EVA 主题素材
  Restore-EVA.ps1        # 移除皮肤
  injector.mjs           # CDP 目标校验、注入、watcher、verify/remove
  selectors.json         # 稳定 DOM 锚点合同
  assets/
    eva-skin.css         # 两套配色和装饰层
    boot.css             # 无素材包时的抽象启动层
    eva-boot.css         # 完整启动素材包的布局与动画
    skin-ui.js           # 表示設定、立绘、媒体开关、试听与自动提醒
    asuka-mark.svg
    rei-mark.svg
    linework.svg
  tests/
```

## 已知限制

- Codex 更新可能改变 DOM 和 CSS Module 前缀；届时需要先运行 `--verify`，再更新 `selectors.json` 和皮肤 CSS。
- 独立配置目录首次进入时可能需要登录一次；不同环境和版本不保证一定自动复用已有会话。
- 没有实现自动更新、托盘控制、安装器或 macOS/Linux 版本。
- 皮肤不改变模型、账户、计费、配额或任务执行逻辑。
- 公开仓库包含 `eva-theme/` 素材；正常安装器和启动器会自动导入并加载。只有旧版仓库、素材目录被人为删除或导入损坏时才会失败，启动器会报错而不会把无素材版当成成功。
- `eva-theme/assets` 的媒体适用独立限制性许可；克隆或下载仓库不等于获得再发布、镜像或打包进其他项目的授权。公开仓库无法从技术上阻止复制，许可授权仍是再发布的前置条件。
- 启动层使用 `eva-theme/` 中的 GIF、警报、插入栓、头像、立绘、语音和 BGM，并实现了实时时钟、逐字入口、四语言选择页、驾驶员点击/拖放选择和同步进度；机械舱门等更复杂的演出仍不在当前范围内。
- 审核自动语音与完成自动语音默认关闭，需在 `表示設定` 中手动开启；它们依赖 Codex renderer 的当前 DOM 锚点，Store 更新后若状态标记消失会自动降级为不播放，而不会监听任意页面变化。

## 素材与许可

代码采用 MIT，版权署名为 `HamizDev`。`codex-skin/assets` 包含抽象线框、编号和调色板、导入器与自有 CSS；`eva-theme/assets` 另行包含角色 PNG、GIF、语音、音效、BGM 和启动素材，受 [`eva-theme/MEDIA-LICENSE.md`](eva-theme/MEDIA-LICENSE.md) 的独立限制性许可约束，不属于 MIT。README 顶部 NERV 标识仅用于同人主题展示，也不属于 MIT 覆盖范围。

MIT 不覆盖 EVA 角色形象、NERV/EVA 商标、原作音乐、语音或 `eva-theme/assets` 中的媒体。当前仓库只面向官方 Codex Desktop 换肤，不包含旧 Web 工作台、Codex CLI bridge、终端/Git/插件面板或相关依赖。素材边界见 `ASSETS.md`、`ASSET-TODO.md`、`eva-theme/README.md` 和 `eva-theme/MEDIA-LICENSE.md`；来源与第三方许可见 `PROVENANCE.md`、`THIRD_PARTY_NOTICES.md`。
