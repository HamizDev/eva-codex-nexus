# 上游来源与移植边界

本项目是非官方 Codex 本地工作台，不是官方 Codex Desktop 的插件，也不是 DSH 插件。

- **底座来源**：[`Iris-change/eva-codex-workbench`](https://github.com/Iris-change/eva-codex-workbench)，原工作台源码为 MIT，已在根 `LICENSE` 保留原始版权署名。
- **设计参考**：[`seaison/dsh-plugin-eva-theme`](https://github.com/seaison/dsh-plugin-eva-theme)，其代码为 MIT；本版本参考双驾驶员配色、语义令牌、音效生命周期和性能原则，未直接导入其 DSH 专用宿主桥接代码。
- **Codex 服务**：通过用户本机安装的官方 `codex app-server` 调用；不提供盗版服务、不绕过订阅用量。

⚠ **媒体权利独立于 MIT**：EVA 角色形象、商标、NERV 标志、动画片段、音乐和语音等需独立授权。参考仓库自述拥有相应媒体授权，不意味着本仓库继承相同授权。`0.0.1` 不打包 DSH 原版 PNG、MP3、GIF 或背景音乐。替换素材需记录作者、许可、SHA-256 与来源。

来自前一开发包的 `CODE-ORIGINS.md`、`PROVENANCE.md`、`THIRD_PARTY_NOTICES.md` 仍保留，避免丢失祖先项目来源。
