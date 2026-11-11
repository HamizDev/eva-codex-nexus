# EVA 主题素材包

公开仓库不包含角色 GIF、头像、立绘、语音、打字音或音乐。需要完整启动动画时，使用本机已有素材目录运行导入器；所有媒体只保存到本机，不进入 Git。

## 使用

```powershell
Import-EVA-Theme.cmd "D:\path\to\eva-theme"
```

如果素材目录位于仓库相邻的 `..\skin-research\eva-theme`，也可以直接双击 `Import-EVA-Theme.cmd`。环境变量 `EVA_THEME_SOURCE_ROOT` 同样可以指定素材目录。

导入后的日常启动不需要再次运行导入器。`Start-EVA.vbs` / `Start-EVA.cmd` 启动的注入器会自动读取：

```text
%LOCALAPPDATA%\EVACodexSkin\eva-theme\
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

## 导入校验

- 读取素材目录的 `assets/manifest.json`；
- 读取清单中的 7 个必需素材和 11 个可选扩展素材；
- 校验源文件字节数和 SHA-256；
- 复制后再次校验目标文件 SHA-256；
- 记录素材版本、Git commit、来源路径和导入时间；
- 拒绝包含脚本、事件处理器、远程 URL 或 `@import` 的 SVG；
- 生成 `PACK-NOTICE.txt`，标明只允许本机使用。

启动时若素材包缺失，自动回退到 `codex-skin/assets/boot.css` 的抽象启动层。若包存在但校验失败，注入器会拒绝加载该包并在日志中报错。

## 启动序列

1. 播放 `nerv-boot.gif`，约 3.84 秒；
2. 播放 NERV 六边形紧急警报，约 3 秒；
3. 显示驾驶员选择页；可拖动明日香/绫波丽头像到左侧插入栓，也可点击角色卡或用键盘选择；
4. 播放对应驾驶员的 `voice-select.mp3` 应答音，并更新主题、插入栓、头像、单位编号和语音时长；
5. 进入同步阶段并播放当前驾驶员的 `voice-boot.mp3`，同步进度按其时长展示；
6. 完成淡出、恢复官方 Codex 交互，并触发一次欢迎语音事件。

这套启动序列是为官方 Codex 单独编写的换肤组件，不运行其他客户端或插件。当前包含 `GIF → 警报 → 驾驶员选择 → 插入栓/同步`，选择支持点击、键盘和拖放；暂不包含更复杂的逐字引导与机械舱门动画。启动页会显示本地素材包的版本和短 commit；同步环、百分比与时码以实际语音播放位置为准，语音不可用时回退到固定时长进度。

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

启动语音仅在本机素材包内使用。9.4 MB 的背景音乐没有导入：它属于独立录音/音乐权利，体积也会显著增加注入载荷；本项目不替用户主张该音轨的再分发权。

## 已验证快照

本地受控验证使用 18 个素材，合计 5,170,918 字节。GIF、头像、立绘、SVG、五类语音与打字音均在导入时通过清单字节数和 SHA-256 校验。旧的 7 文件素材包仍可加载，缺少的立绘、试听和打字音会自动禁用。
