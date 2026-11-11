# v0.1.0 公开源码验收清单

- [x] 根 / workbench package 与 lockfile 均为 v0.1.0
- [x] README、CHANGELOG、上游来源与素材声明更新
- [x] 主题跟随系统、Markdown、状态提示测试纳入 `npm test`
- [x] 官方 Codex 皮肤启动器、CDP 目标校验、Asuka/Rei 注入和恢复测试纳入 `npm run test:skin`
- [x] 真实 `OpenAI.Codex 26.1106.6628.0` renderer 受控实例冒烟：注入、切换、verify、remove
- [ ] 新设备 Windows 10 / 11 启动与 Codex CLI 真实联调
- [ ] 绫波丽启动序列与授权素材最终确认
- [ ] 在用户方便时执行一次完整“关闭当前 Codex → Start-EVA.cmd → 自动重开”路径
- [x] GitHub 仓库已创建并维护（`HamizDev/eva-codex-nexus`）

**每次发布前执行：** `npm test`、`npm run manifest`、`npm run verify:public`。

不得上传 `workbench/data/`、`%LOCALAPPDATA%\EVACodexSkin`、CDP 配置、CLI 账号文件、`node_modules/`、开发者日志、私有音轨、未获明确再分发许可的角色和背景音乐。
