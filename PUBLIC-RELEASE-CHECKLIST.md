# v0.0.2 公开源码验收清单

- [x] 根 / workbench package 与 lockfile 均为 v0.0.2
- [x] README、CHANGELOG、上游来源与素材声明更新
- [x] 主题跟随系统、Markdown、状态提示测试纳入 `npm test`
- [ ] 新设备 Windows 10 / 11 启动与 Codex CLI 真实联调
- [ ] 绫波丽启动序列与授权素材最终确认
- [ ] GitHub 仓库创建与首次推送（用户随后创建）

**每次发布前执行：** `npm test`、`npm run manifest`、`npm run verify:public`。

不得上传 `workbench/data/`、CLI 账号文件、`node_modules/`、开发者日志、私有音轨、未获明确再分发许可的角色和背景音乐。
