# 来源说明

当前仓库只包含**官方 Codex 桌面客户端换肤层**，不包含独立 Codex 客户端或网页工作台。

## 本项目实现

- `codex-skin/Start-EVA.ps1`：发现并启动本机已安装、已签名的官方 Codex，校验本地 CDP 端点；
- `codex-skin/injector.mjs`：目标校验、启动层、皮肤注入、热更新、`verify` 与 `remove`；
- `codex-skin/assets/`：EVA 双角色配色、抽象线框、装饰层、设置面板与自动提醒逻辑；
- `scripts/`：桌面快捷方式、源码清单和发布边界检查。

这些代码由 `HamizDev` 维护，采用根目录 MIT 许可。

## 外部来源

- **DSH EVA Theme**：<https://github.com/seaison/dsh-plugin-eva-theme>。参考双驾驶员配色、启动流程、音效生命周期和设置结构；其代码许可为 MIT，全文见 `licenses/DSH-EVA-MIT.txt`。
- **DSH 本地媒体**：GIF、警报/插入栓、头像、角色线稿、语音和打字音不进入公开仓库，只通过 `Import-DSH-Boot.ps1` 从用户本机的 DSH 主题仓库校验并复制到 `%LOCALAPPDATA%\EVACodexSkin\dsh-boot`。
- **NERV 顶部标志**：取自 DSH EVA Theme 的 `assets/svg/nerv-logo.svg`，仅用于同人主题展示；项目 MIT 不覆盖 EVA/NERV 图形、商标或角色权利。
- **官方 Codex**：由使用者自行安装。本项目不修改 `WindowsApps`、`app.asar`、签名、账号令牌、代理、Base URL 或模型配置。

## 媒体边界

MIT 只覆盖本项目代码，不覆盖 EVA 角色形象、名称、音乐、语音、动画或 NERV/EVA 商标。导入 DSH 媒体不等于获得公开再分发权；公开版本仍只提供导入器、自有 CSS 和说明。详细素材边界见 `ASSETS.md`、`ASSET-TODO.md` 与 `DSH-BOOT.md`。
