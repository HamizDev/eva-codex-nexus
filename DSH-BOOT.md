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
```

## 导入时校验

- 读取 DSH `assets/manifest.json`；
- 只允许清单中的 7 个启动素材；
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
5. 完成淡出并恢复官方 Codex 交互。

`Esc`、`Space`、点击背景或“跳过 / ESC”按钮可立即跳过。启动指纹绑定一次官方 Codex 进程；刷新 renderer 不重播。系统启用“减少动态效果”时不显示启动层。

## 音频边界

启动语音仅在本机资源包内使用。9.4 MB 的 `nerv-boot-music.mp3` 没有导入：它属于独立录音/音乐权利，体积也会显著增加注入载荷；本项目不替用户主张该音轨的再分发权。

## 已验证来源

受控验证使用：

- 仓库：`https://github.com/seaison/dsh-plugin-eva-theme`
- commit：`f8b96381ceda724c58e79ec375e0dfe08d244349`
- DSH 版本：`0.51.2`
- 素材：7 个，合计 2,988,499 字节

该快照的 GIF、角色头像、SVG 与语音在导入时全部通过 DSH 清单的字节数和 SHA-256 校验。
