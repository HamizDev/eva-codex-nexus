# v0.3.1 公开源码验收清单

- [x] 根 / workbench package 与 lockfile 均为 v0.3.1
- [x] README、CHANGELOG、上游来源与素材声明更新
- [x] 主题跟随系统、Markdown、状态提示测试纳入 `npm test`
- [x] 官方 Codex 皮肤启动器、CDP 目标校验、Asuka/Rei 注入和恢复测试纳入 `npm run test:skin`
- [x] 真实 `OpenAI.Codex 26.1106.6628.0` renderer 受控实例冒烟：注入、切换、verify、remove
- [x] 真实 renderer 冷启动启动层、刷新不重播、Esc 跳过、Rei 启动层和减少动态效果验证
- [x] DSH 启动资源本地导入、字节数/SHA-256 校验和媒体隔离
- [x] DSH GIF、警报、插入栓、头像、同步环与启动语音的真实 renderer 验证
- [x] 桌面快捷方式使用官方 Codex 图标、目标 `wscript.exe`、隐藏 VBS 启动
- [x] DSH 媒体未进入公开仓库；公开包仅含导入器、自有 CSS 和说明
- [x] Windows PowerShell 5.1 的 CDP `/json/list` 嵌套数组兼容修复已验证
- [x] 侧栏悬浮说明、改动汇总卡片、文件变更提示、用户气泡与发送按钮已适配 EVA 面板色
- [x] 应用内 02 明日香 / 00 绫波丽切换、选择持久化和状态文件同步已验证
- [x] 排队消息导轨与操作按钮适配已验证，测试消息已删除
- [x] 真实窗口 `1000×700`、`760×600` 缩放与拖动位置验证通过
- [x] 文件变更胶囊实时 DOM 背景、边框与强调线验证通过
- [x] Asuka/Rei 用户气泡内层 Markdown 最终计算颜色均为高对比度
- [x] 内置浏览器标签、导航、地址栏、导入横幅和工具卡片适配验证通过
- [x] 浏览器打开时切换条自动收起，关闭后恢复可见和可点击
- [x] 根许可以 `HamizDev` 为主版权人，纯参考上游条目已清理
- [x] `--remove` 同时清理启动层、启动样式与皮肤节点
- [ ] 新设备 Windows 10 / 11 启动与 Codex CLI 真实联调
- [ ] 角色插画、语音与音乐等授权素材最终确认
- [ ] 在用户方便时执行一次完整“关闭当前 Codex → 桌面快捷方式/隐藏 VBS → 自动重开”路径
- [x] GitHub 仓库已创建并维护（`HamizDev/eva-codex-nexus`）

**每次发布前执行：** `npm test`、`npm run manifest`、`npm run verify:public`。

不得上传 `workbench/data/`、`%LOCALAPPDATA%\EVACodexSkin`、CDP 配置、CLI 账号文件、`node_modules/`、开发者日志、私有音轨、未获明确再分发许可的角色和背景音乐。
