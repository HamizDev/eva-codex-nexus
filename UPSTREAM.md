# 上游来源与移植边界

本项目是非官方 Codex 美化项目，与 OpenAI、Studio Khara、Gainax 及相关权利方无隶属或背书关系。

从 `v0.1.0` 起，默认入口是**官方 Codex Desktop + 本地 EVA 皮肤层**；旧的独立 Web 工作台仍作为备用入口保留。两条链都不修改官方安装包、签名、账号令牌或 Codex 协议。

- **底座来源**：[`Iris-change/eva-codex-workbench`](https://github.com/Iris-change/eva-codex-workbench)，原工作台源码为 MIT，已在根 `LICENSE` 保留原始版权署名。
- **设计参考**：[`seaison/dsh-plugin-eva-theme`](https://github.com/seaison/dsh-plugin-eva-theme)，其代码为 MIT；本版本参考双驾驶员配色、语义令牌、音效生命周期和性能原则，未直接导入其 DSH 专用宿主桥接代码。
- **官方皮肤实现参考**：
  - [`Fei-Away/Codex-Dream-Skin`](https://github.com/Fei-Away/Codex-Dream-Skin)：回环 CDP 启动、早期注入、watcher 与恢复架构；
  - [`zhulin025/Codex-QQ-Skin`](https://github.com/zhulin025/Codex-QQ-Skin)：Windows Appx 激活与连接检查；
  - [`HeiGeAi/heige-codex-skin-studio`](https://github.com/HeiGeAi/heige-codex-skin-studio)：renderer 目标分类；
  - [`freestylefly/codex-themes`](https://github.com/freestylefly/codex-themes)：Electron watcher 与平台适配思路。
- **Codex 服务**：备用工作台通过用户本机安装的官方 `codex app-server` 调用；默认皮肤直接启动官方 Desktop；不提供盗版服务、不绕过订阅用量。

⚠ **媒体权利独立于 MIT**：EVA 角色形象、商标、NERV 标志、动画片段、音乐和语音等需独立授权。参考仓库自述拥有相应媒体授权，不意味着本仓库继承相同授权。`v0.1.0` 不打包 DSH 原版 PNG、MP3、GIF 或背景音乐。替换素材需记录作者、许可、SHA-256 与来源。

来自前一开发包的 `CODE-ORIGINS.md`、`PROVENANCE.md`、`THIRD_PARTY_NOTICES.md` 仍保留，避免丢失祖先项目来源。
