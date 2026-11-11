# EVA Codex Nexus 素材说明

本仓库是官方 Codex 桌面客户端的换肤层，不包含独立工作台、网页客户端或 Codex CLI 桥接。

## 公开仓库包含

- `codex-skin/assets/asuka-mark.svg`、`rei-mark.svg`、`linework.svg`：项目自有抽象线框和编号；
- `codex-skin/assets/eva-skin.css`、`boot.css`、`dsh-boot.css`：自有配色、装饰层和无媒体包时的启动层；
- `codex-skin/assets/nerv-logo.svg`：README 顶部同人标识，来自 DSH EVA Theme，按原素材边界使用；
- `codex-skin/assets/skin-ui.js`：设置面板、立绘、媒体开关、试听与自动提醒逻辑；
- DSH 导入器、PowerShell 启动器、CDP 注入器、测试和发布校验脚本。

## 不进入公开仓库

DSH 的 GIF、警报/插入栓、角色头像、线稿立绘、启动/选择/欢迎/审核/完成语音、打字音和音乐均不提交。需要时由 `Import-DSH-Boot.ps1` 从用户本机的 `dsh-plugin-eva-theme` 仓库校验并复制到：

```text
%LOCALAPPDATA%\EVACodexSkin\dsh-boot
```

导入包包含 18 个受控媒体文件，合计 5,170,918 字节。公开仓库只保留导入器、清单校验代码、自有 CSS 和说明。

## 字体

公开包使用系统字体回退，不包含字体二进制文件。

## 许可

项目代码采用 MIT。DSH 代码许可不覆盖其角色媒体；EVA/NERV 图形、商标、角色、声音和音乐需要独立授权。详细来源见 `PROVENANCE.md`，第三方清单见 `THIRD_PARTY_NOTICES.md`。
