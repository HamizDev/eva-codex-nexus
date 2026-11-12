# 来源说明

当前仓库只包含**官方 Codex 桌面客户端换肤层**，不包含独立 Codex 客户端或网页工作台。

## 本项目实现

- `codex-skin/Start-EVA.ps1`：发现并启动本机已安装、已签名的官方 Codex，校验本地 CDP 端点；
- `codex-skin/injector.mjs`：目标校验、启动层、皮肤注入、热更新、`verify` 与 `remove`；
- `codex-skin/assets/`：EVA 双角色配色、抽象线框、装饰层、设置面板与自动提醒逻辑；
- `scripts/`：桌面快捷方式、源码清单和发布边界检查。

这些代码由 `HamizDev` 维护，采用根目录 MIT 许可。

## 外部来源

- **EVA 主题素材包**：`eva-theme/assets` 包含 GIF、警报/插入栓、头像、角色线稿、语音、打字音和启动 BGM；源包随仓库维护，安装器和启动器会自动调用 `Import-EVA-Theme.ps1`，校验并复制到 `%LOCALAPPDATA%\EVACodexSkin\eva-theme`。素材受 `eva-theme/MEDIA-LICENSE.md` 的独立限制性许可约束，不适用代码 MIT。
- **NERV 顶部标志**：仅用于同人主题展示；项目 MIT 不覆盖 EVA/NERV 图形、商标或角色权利。
- **官方 Codex**：由使用者自行安装。本项目不修改 `WindowsApps`、`app.asar`、签名、账号令牌、代理、Base URL 或模型配置。

## 媒体边界

MIT 只覆盖本项目代码，不覆盖 `eva-theme/assets` 中的媒体、EVA 角色形象、名称、音乐、语音、动画或 NERV/EVA 商标。仓库保留媒体源包不等于授予公开再发布权；未经书面授权不得镜像、再发布或放入其他仓库、Release、安装包或产品。详细边界见 `ASSETS.md`、`ASSET-TODO.md`、`EVA-THEME.md` 和 `eva-theme/MEDIA-LICENSE.md`。
