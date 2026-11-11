# DSH 启动动画本地资源包

`dsh-plugin-eva-theme` 的代码采用 MIT，但其 `NOTICE.md` 明确说明 GIF、NERV 标志、角色头像、语音和音乐不包含在代码 MIT 许可中。因此 EVA Codex Nexus **不把 DSH 媒体提交到公开仓库**，而是提供本地导入器。

## 使用

先在本机准备 DSH 主题仓库，然后执行：

```powershell
Import-DSH-Boot.cmd "D:\path\to\dsh-plugin-eva-theme"
```

如果 DSH 仓库位于本仓库相邻的 `..\skin-research\dsh-eva-theme`，也可以直接双击 `Import-DSH-Boot.cmd`。环境变量 `DSH_EVA_THEME_ROOT` 也可指向该仓库。

导入后的每天启动不需要再次运行导入器。`Start-EVA.vbs` / `Start-EVA.cmd` 启动的注入器会自动读取：

```text
%LOCALAPPDATA%\EVACodexSkin\dsh-boot\
  manifest.json
  PACK-NOTICE.txt
  assets\
    nerv-boot.gif
    nerv-emergency.svg
    eva-entry-plug.svg
    asuka-avatar-closed-eyes.png
    rei-avatar-closed-eyes.png
    asuka-voice-boot.mp3
    rei-voice-boot.mp3
    asuka-portrait-lineart.png
    rei-portrait-lineart.png
    asuka-voice-select.mp3
    rei-voice-select.mp3
    asuka-voice-welcome.mp3
    rei-voice-welcome.mp3
    asuka-voice-approval.mp3
    rei-voice-approval.mp3
    asuka-voice-complete.mp3
    rei-voice-complete.mp3
    nerv-ui-typing.mp3
```

## 导入时校验

- 读取 DSH `assets/manifest.json`；
- 读取清单中的 7 个必需素材和 11 个可选扩展素材；
- 校验源文件字节数和 SHA-256；
- 复制后再次校验目标文件 SHA-256；
- 记录 DSH 版本、Git commit、来源路径和导入时间；
- 拒绝包含脚本、事件处理器、远程 URL 或 `@import` 的 SVG；
- 生成 `PACK-NOTICE.txt`，标明只允许本机使用。

启动时若资源包缺失，自动回退到 `codex-skin/assets/boot.css` 的抽象启动层。若包存在但校验失败，注入器会拒绝加载该包并在日志中报错。

## 启动序列

1. 播放 DSH `nerv-boot.gif`，约 3.84 秒；
2. 播放 NERV 六边形紧急警报，约 3 秒；
3. 显示插入栓、当前驾驶员头像和同步环；
4. 播放当前驾驶员的 `voice-boot.mp3`，同步进度按其时长展示；
5. 完成淡出、恢复官方 Codex 交互，并触发一次欢迎语音事件。

`Esc`、`Space`、点击背景或“跳过 / ESC”按钮可立即跳过。启动指纹绑定一次官方 Codex 进程；刷新 renderer 不重播。系统启用“减少动态效果”时不显示启动层。

## 表示設定与角色媒体

导入扩展素材后，右侧 `設 / SETTINGS` 会打开仿 DSH 的 `表示設定`：

- 直接切换 02 明日香 / 00 绫波丽，并持久化选择；
- 单独开关开机动画、启动语音、选择应答、欢迎语音、输入打字音、审核自动语音和完成自动语音；
- 试听启动、选择、欢迎、审核、完成五类驾驶员语音；
- 开关角色立绘并调整 3%–28% 的背景强度。

欢迎语音在本次启动动画完成并交接给 Codex 后播放一次。审核自动语音与完成自动语音默认关闭；开启后，前者在待审批出现时播放一次，后者在主任务从运行中转为完成时播放一次。初始化、刷新或打开旧会话时不会为历史审批和旧完成回复补播。

## 音频边界

启动语音仅在本机资源包内使用。9.4 MB 的 `nerv-boot-music.mp3` 没有导入：它属于独立录音/音乐权利，体积也会显著增加注入载荷；本项目不替用户主张该音轨的再分发权。

## 已验证来源

受控验证使用：

- 仓库：`https://github.com/seaison/dsh-plugin-eva-theme`
- commit：`f8b96381ceda724c58e79ec375e0dfe08d244349`
- DSH 版本：`0.51.2`
- 素材：18 个，合计 5,170,918 字节

该快照的 GIF、角色头像、角色立绘、SVG、五类语音与打字音在导入时全部通过 DSH 清单的字节数和 SHA-256 校验。旧的 7 文件本地包仍可加载，缺少的立绘、试听和打字音会自动禁用。
