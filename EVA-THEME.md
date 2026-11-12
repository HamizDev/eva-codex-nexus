# EVA 主题素材包

公开仓库包含 `eva-theme/` 素材包。桌面快捷方式安装器和启动器会自动校验并导入它；手动运行导入器仅用于修复或重新导入。媒体会复制到本机，仓库中的源文件仍受 `eva-theme/MEDIA-LICENSE.md` 限制，未经书面授权不得再发布。

## 使用

```powershell
Import-EVA-Theme.cmd
# 或显式指定其他合法素材目录：
Import-EVA-Theme.cmd "D:\path\to\eva-theme"
```

不带参数时，导入器优先读取仓库根的 `eva-theme/`。正常安装和启动会自动执行这一步；环境变量 `EVA_THEME_SOURCE_ROOT` 或命令行参数仍可指定其他合法素材目录。

导入后的日常启动不需要再次运行导入器。`Start-EVA.vbs` / `Start-EVA.cmd` 启动的注入器会自动读取：

```text
%LOCALAPPDATA%\EVACodexSkin\eva-theme\
  manifest.json
  PACK-NOTICE.txt
  assets\
    nerv-boot.gif
    nerv-emergency.svg
    eva-entry-plug.svg
    nerv-logo.svg
    asuka-avatar-closed-eyes.png
    rei-avatar-closed-eyes.png
    asuka-portrait-lineart.png
    rei-portrait-lineart.png
    asuka-voice-boot.mp3
    rei-voice-boot.mp3
    asuka-voice-select.mp3
    rei-voice-select.mp3
    asuka-voice-welcome.mp3
    rei-voice-welcome.mp3
    asuka-voice-approval.mp3
    rei-voice-approval.mp3
    asuka-voice-complete.mp3
    rei-voice-complete.mp3
    nerv-ui-typing.mp3
    nerv-boot-music.mp3
```

## 导入校验

- 读取素材目录的 `assets/manifest.json`；
- 读取清单中的 7 个必需素材和 13 个可选扩展素材；
- 校验源文件字节数和 SHA-256；
- 复制后再次校验目标文件 SHA-256；
- 记录素材版本、Git commit、来源路径和导入时间；
- 拒绝包含脚本、事件处理器、远程 URL 或 `@import` 的 SVG；
- 生成 `PACK-NOTICE.txt`，标明只允许本机使用。

安装器和启动器会在启动前自动导入素材；若素材包缺失、少于 20 个文件或校验失败，导入器会报错并阻止启动，不会静默使用无素材版本。

## 启动序列

1. 播放 `nerv-boot.gif`，约 3.84 秒；
2. 播放带实时本地时钟的 NERV 六边形紧急警报，约 3 秒；
3. 显示黑底驾驶员入口页，逐字显示「選擇你的駕駛員」，扫描线、两侧角色线稿和实时时钟持续演出，约 4.2 秒；
4. 显示驾驶员选择页；可切换界面语言，拖动明日香/绫波丽头像到左侧插入栓，也可点击角色卡或用键盘选择；
5. 播放对应驾驶员的 `voice-select.mp3` 应答音，并更新主题、插入栓、头像、单位编号和语音时长；
6. 进入同步阶段并播放当前驾驶员的 `voice-boot.mp3`，同步进度按其时长展示；
7. 完成淡出、恢复官方 Codex 交互，并触发一次欢迎语音事件。

启动层会循环播放本地 `nerv-boot-music.mp3`，右下角按钮可静音或恢复；选择驾驶员后 BGM 自动降低音量。这套启动序列是为官方 Codex 单独编写的换肤组件，不运行其他客户端或插件。当前包含 `GIF → NERV 警报（实时时钟）→ 黑底逐字入口 → 驾驶员选择 → 插入栓/同步`，选择支持点击、键盘和拖放；选择页支持繁中、简中、日语、英语切换，并显示角色立绘、编号和实时时钟。启动页会显示本地素材包的版本和短 commit；同步环、百分比与时码以实际语音播放位置为准，语音不可用时回退到固定时长进度。

`Esc`、`Space` 或“跳过 / ESC”按钮可立即跳过。启动指纹绑定一次官方 Codex 进程；刷新 renderer 不重播。系统启用“减少动态效果”时不显示启动层。

官方客户端冷启动时会先显示一个临时加载页，再导航到正式的 `app://-/index.html`。启动层只会在正式 Codex 页面注入；如果启动尚未完成时页面再次重载，会撤销“已播放”标记并在新页面重新开始，避免启动动画被临时页面吞掉。

## 表示設定与角色媒体

导入扩展素材后，右侧 `設 / SETTINGS` 会打开 `表示設定`：

- 直接切换 02 明日香 / 00 绫波丽，并持久化选择；
- 单独开关开机动画、启动语音、选择应答、欢迎语音、输入打字音、审核自动语音和完成自动语音；
- 试听启动、选择、欢迎、审核、完成五类驾驶员语音；
- 开关角色立绘并调整 3%–28% 的背景强度。

欢迎语音在本次启动动画完成并交接给 Codex 后播放一次。审核自动语音与完成自动语音默认关闭；开启后，前者在待审批出现时播放一次，后者在主任务从运行中转为完成时播放一次。初始化、刷新或打开旧会话时不会为历史审批和旧完成回复补播。

`开机动画` 是整套启动流程的总开关：关闭后，下一次启动不会出现 GIF、警报、驾驶员选择页或同步页。进入 Codex 后再切换驾驶员只更新主题、立绘和可选的应答音，不会重新播放启动动画。

## 音频边界

启动语音和 9.4 MB 的启动 BGM 都只在本机素材包内使用。仓库中的 `eva-theme/assets` 是可选源包，不等于公开再发布授权；媒体权利和再发布条件仍由 `eva-theme/MEDIA-LICENSE.md`、上游声明及相关权利人条款约束。

## 已验证快照

本地受控验证使用 20 个素材，合计 14,586,757 字节。GIF、头像、立绘、SVG、五类语音、打字音和启动 BGM 均在导入时通过清单字节数和 SHA-256 校验。旧的 7 文件素材包仍可加载，缺少的立绘、试听、打字音和 BGM 会自动禁用。仓库源包版本和 commit 见 `eva-theme/assets/manifest.json`。
