# 来源核对记录

核对日期：2026-11-04。

用户已补充原“制作骇爪终端启动动画”对话截图：原开发说明将 HACKCLAW 工作台界面、交互、项目管理、图片输入和 Codex 连接代码列为该对话中逐步开发的部分；Windows 启动器另行参考并复用 Dragon Codex Boot。详细证据范围和边界见 CODE-ORIGINS.md。

此前“整个底座来源未知”的描述已被这条开发记录更新。这不是完整的 Git 历史或所有代码的独立相似性审计，不能把第三方组件和素材一起称为原创。

`v0.3.2` 的推荐启动链：桌面 EVA Codex.lnk → wscript.exe → Start-EVA.vbs → codex-skin/Start-EVA.ps1 → 官方 Appx Codex（回环 CDP）→ codex-skin/injector.mjs → 官方 renderer 的单次启动层、CSS、摘要面板装饰层与驾驶员切换条。该链路不修改 WindowsApps、`app.asar`、签名、认证或 API 配置。

DSH 启动媒体由 `Import-DSH-Boot.ps1` 从用户本机的 `dsh-plugin-eva-theme` 仓库导入到 `%LOCALAPPDATA%\EVACodexSkin\dsh-boot`，导入时按 DSH `assets/manifest.json` 校验字节数和 SHA-256。公开仓库只包含导入器、自有 CSS 和说明，不包含 DSH 的 GIF、角色头像、语音或音乐。受控验证来源为 DSH commit `f8b96381ceda724c58e79ec375e0dfe08d244349`（v0.51.2）。

README 顶部 NERV 标志取自 DSH EVA Theme 的 `assets/svg/nerv-logo.svg`，本地副本 SHA-256 为 `C517C9BC95B38017912AD42F0D7CB0770A0ED15298A881BAF2AAE484185A18AC`。该图形只用于同人主题展示，不随项目代码的 MIT 许可重新授权。

备用启动链仍为：Start-EVA-Workbench.cmd → workbench/start.ps1 → Node server.cjs → 官方 codex app-server；前端为网页、Canvas 和 Three.js。两条链都没有打包或调用原交接包的 DragonCodexBoot.cs/WPF 启动器、上游 MP4 或快捷方式替换工具。

Dragon Codex Boot：https://github.com/yushua0808-cpu/dragon-codex-boot 。2026-11-04 核对上游为 MIT，许可证全文在 licenses/DragonCodexBoot-MIT.txt。保留参考来源和许可，不自动将其用于整个工作台。

后续若找到其他明确复用代码，应补充相应许可。项目自有代码采用 MIT，主版权署名为 `HamizDev`，并保留原工作台底座 `Iris-change` 的原始版权通知。完整私人视觉未公开分发，公开版使用占位素材；见 LICENSE-STATUS.md 和 ASSETS.md。
