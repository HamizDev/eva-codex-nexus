# EVA Theme 素材包

这个目录是 EVA Codex Nexus 的可选启动素材包，包含 20 个媒体文件：

- 1 个启动 GIF；
- 3 个 NERV / 插入栓 SVG；
- 4 个角色头像或线稿立绘；
- 12 个语音、音效或启动 BGM。

素材包的校验清单在 [`assets/manifest.json`](assets/manifest.json)，包含每个文件的字节数和 SHA-256。`Install-EVA-DesktopShortcut.cmd` 和 `Start-EVA.cmd` 会自动读取并导入这里；手动修复时可在仓库根目录执行：

```powershell
Import-EVA-Theme.cmd
```

导入器会把素材复制到 `%LOCALAPPDATA%\EVACodexSkin\eva-theme`，安装器和启动器会自动完成这一步。也可以显式传入其他合法素材目录：

```powershell
Import-EVA-Theme.cmd "D:\path\to\eva-theme"
```

## 许可

`eva-theme/assets` 下的媒体不适用项目代码的 MIT 许可，而适用本目录的 [`MEDIA-LICENSE.md`](MEDIA-LICENSE.md)：

- 可以在本机导入并配合 EVA Codex Nexus 使用；
- 未经权利人明确书面授权，不得复制、镜像、发布、再分发，或将其放入另一个仓库、Release、安装包、服务或产品；
- 后续新增驾驶员或素材时，必须同时更新清单、来源说明和媒体许可边界。

公开仓库保留这些文件是为了可持续维护和本地导入，不代表授权再发布。EVA/NERV 角色、标识、声音和音乐的权利仍属于各自权利人；完整边界见 [`NOTICE.md`](NOTICE.md)。
