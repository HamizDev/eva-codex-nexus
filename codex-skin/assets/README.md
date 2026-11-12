# 皮肤素材边界

`codex-skin/assets` 只包含抽象线框、编号、调色板和设置 UI 代码，不包含动画角色截图、角色头像、角色立绘、语音、音效、音乐或视频；完整媒体源包位于仓库根的 `eva-theme/assets`，受独立媒体许可约束。

- `asuka-mark.svg`、`rei-mark.svg`：本项目自有的抽象编号标志。
- `linework.svg`：由项目自有的抽象线框改色，仅作背景纹理，不表现角色。
- `eva-skin.css`：项目自有 CSS，注入官方 Codex renderer 时只改颜色、边框和非交互装饰层。
- `skin-ui.js`：项目自有的 `表示設定`、驾驶员切换、媒体开关、试听、审核/完成自动提醒与立绘逻辑；不包含媒体数据。
- `boot.css`：项目自有的单次启动层样式，只使用编号、线框和扫描动效；启动结束后完全移除。
- `eva-boot.css`：项目自有的完整启动层样式；它不含角色图片、语音或音乐，只负责布局与动画。媒体由 `Import-EVA-Theme.ps1` 从仓库内的 `eva-theme/` 或用户指定的合法目录导入到 `%LOCALAPPDATA%`，启动时临时编码进 renderer。

`eva-theme/assets` 中的角色插画和音轨已在 `eva-theme/NOTICE.md`、`eva-theme/MEDIA-LICENSE.md`、`ASSETS.md` 和发布清单中登记来源、许可、文件版本与 SHA-256；代码的 MIT 许可不覆盖这些媒体。当前导入路径和再发布边界见根目录 [EVA-THEME.md](../../EVA-THEME.md) 与 [eva-theme/MEDIA-LICENSE.md](../../eva-theme/MEDIA-LICENSE.md)。
