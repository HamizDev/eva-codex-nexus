# EVA Codex Nexus 素材说明

本仓库是官方 Codex 桌面客户端的换肤层，不包含独立工作台、网页客户端或 Codex CLI 桥接。

## 公开仓库包含

- `codex-skin/assets/asuka-mark.svg`、`rei-mark.svg`、`linework.svg`：项目自有抽象线框和编号；
- `codex-skin/assets/eva-skin.css`、`boot.css`、`eva-boot.css`：自有配色、装饰层和启动层；
- `codex-skin/assets/nerv-logo.svg`：README 顶部同人标识，仅按同人主题边界使用；
- `codex-skin/assets/skin-ui.js`：设置面板、立绘、媒体开关、试听与自动提醒逻辑；
- `eva-theme/`：可选启动素材包，包含 20 个媒体文件、清单、来源说明和独立媒体许可；
- 素材导入器、PowerShell 启动器、CDP 注入器、测试和发布校验脚本。

## 素材包边界

角色 GIF、警报/插入栓、头像、线稿立绘、启动/选择/欢迎/审核/完成语音、打字音和音乐位于 `eva-theme/assets`，随仓库提供源码和管理清单。桌面快捷方式安装器和启动器会自动调用 `Import-EVA-Theme.ps1` 校验并复制到：

```text
%LOCALAPPDATA%\EVACodexSkin\eva-theme
```

导入包包含 20 个受控媒体文件，合计 14,586,757 字节，其中启动 BGM 约 9.4 MB。素材不适用代码 MIT；未经权利人明确书面授权，不得复制、镜像、再发布到其他仓库、Release、安装包或产品。具体条款见 `eva-theme/MEDIA-LICENSE.md`。

## 字体

公开包使用系统字体回退，不包含字体二进制文件。

## 许可

项目代码采用 MIT；`eva-theme/assets` 的媒体采用独立限制性许可；EVA/NERV 图形、商标、角色、声音和音乐仍需各自授权。详细来源见 `eva-theme/NOTICE.md`、`PROVENANCE.md` 和 `THIRD_PARTY_NOTICES.md`。
