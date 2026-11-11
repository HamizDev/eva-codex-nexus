# 公开源码验收清单

- [x] 当前发行形态为官方 Codex Desktop + `codex-skin/` 换肤层；
- [x] 仓库不包含旧独立工作台、`codex app-server` bridge、Workbench 启动入口或终端/Git/插件面板；
- [x] 仓库不包含角色 GIF、头像、立绘、语音、打字音或音乐；
- [x] 根 `package.json` 与 `codex-skin/injector.mjs` 版本一致；
- [x] `npm test`、`npm run manifest`、`npm run verify:public` 通过；
- [x] `MANIFEST.json` 与当前源码逐文件 SHA-256 一致；
- [x] 真实 Codex renderer 注入、主题切换、`--verify` 与 `--remove` 通过；
- [x] 启动动画、刷新不重播、驾驶员选择、应用内换肤和设置持久化通过；
- [x] 完成/审批自动提醒默认关闭，并通过状态机与隔离浏览器回归。

发布前执行：

```powershell
npm test
npm run manifest
npm run verify:public
```

不得上传 `%LOCALAPPDATA%\EVACodexSkin`、CDP 配置、登录凭据、`node_modules/`、运行日志、未获明确再分发许可的角色素材、语音或音乐。
