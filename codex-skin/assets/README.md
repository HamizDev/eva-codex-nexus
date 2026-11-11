# 皮肤素材边界

`codex-skin/assets` 只包含抽象线框、编号和调色板，不包含动画角色截图、角色头像、语音、音乐或视频。

- `asuka-mark.svg`、`rei-mark.svg`：本项目自有的抽象编号标志。
- `linework.svg`：由现有工作台的抽象线框改色，仅作背景纹理，不表现角色。
- `eva-skin.css`：项目自有 CSS，注入官方 Codex renderer 时只改颜色、边框和非交互装饰层。

若以后加入角色插画或音轨，必须先在 `ASSETS.md`、独立 NOTICE 和发布清单中登记来源、许可、文件版本与 SHA-256；代码的 MIT 许可不覆盖第三方媒体。
