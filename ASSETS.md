# EVA Codex Nexus 素材管理（v0.2.1）

本代码仓库不包含 DSH 原版角色 PNG、GIF、语音 MP3 或动漫背景音乐。v0.2.0 增加了 DSH 启动资源导入器，但导入结果只写入 `%LOCALAPPDATA%\EVACodexSkin\dsh-boot`，不进入 Git 或公开源码包。本地启动器的音轨文件 `workbench/public/media/audio-unit02-fluid/voice.wav` 仍是可选扩展，也不在 GitHub 源码包中。

当前工作台现存的部分 NERV 风格 SVG 为此前预览底座继承；公开展示前应再次核对相应品牌标志与原创作品的授权边界，必要时替换为原创的中性符号。

`workbench/public/media/pilot/` 和 `workbench/public/media/eva/` 放置旧工作台的示意图。官方 Codex 皮肤公开包只使用 `codex-skin/assets/` 中的抽象编号、线框、启动扫描、调色板和 DSH 风格 CSS；这些文件不含角色插画、语音或音乐。DSH 启动包由用户从本地仓库导入，导入器与许可边界见 [DSH-BOOT.md](DSH-BOOT.md)。

后续如更换两名驾驶员的正式插画、动态素材或音轨，请记录：来源 URL、版权所有者、文件版本、许可证 / 单独授权、SHA-256，并在独立 NOTICE 中登记。**设计参考 DSH 的代码许可证不等于继承其音乐授权。**

视觉资产计划见 [ASSET-TODO.md](ASSET-TODO.md)，上游来源见 [UPSTREAM.md](UPSTREAM.md)。

字体：为公开包改为系统字体回退，不包含任何字体文件。
