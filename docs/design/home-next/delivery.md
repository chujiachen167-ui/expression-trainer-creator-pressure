# TKT-HOME-001 交付记录

日期：2026-09-05。状态：CONDITIONAL — 两套独立方案已实现，等待 Founder 审美选型；不是正式首页发布。

## 立即打开

- [A/B 对照入口](http://127.0.0.1:8766/docs/design/home-next/index.html)
- [A：品牌先被记住](http://127.0.0.1:8766/docs/design/home-next/option-a.html)
- [B：效果先被看见](http://127.0.0.1:8766/docs/design/home-next/option-b.html)
- [A 英文](http://127.0.0.1:8766/docs/design/home-next/option-a.html?lang=en)
- [B 英文](http://127.0.0.1:8766/docs/design/home-next/option-b.html?lang=en)

当前已启动仅监听本机的静态预览服务，根目录为本项目，不改线上服务器配置。关闭电脑或停止进程后，本地地址会失效；文件仍保留。

无需服务器也可直接用浏览器打开：

`C:\Vibe coding program\expression-trainer-vertical-prototypes\docs\design\home-next\index.html`

要重新启动 HTTP 预览，可在 PowerShell 执行：

```powershell
& 'C:\Users\31214\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 8766 --bind 127.0.0.1 --directory 'C:\Vibe coding program\expression-trainer-vertical-prototypes'
```

该运行时路径已在本机确认。若以后应用更新导致路径变化，可通过应用的工作区依赖查询重新获取。

## 交付文件

均位于 `C:\Vibe coding program\expression-trainer-vertical-prototypes\docs\design\home-next\`：

- `index.html` / `compare.css` / `compare.js`：A/B 对照入口，可选手机尺寸与语言。
- `option-a.html` / `option-b.html`：可单独打开的完整页面。
- `preview.css` / `preview.js`：两套共享的品牌基础、内容、响应式排版和交互。
- `reference-notes.md`：四个参考与许可边界。
- `decision-sheet.md`：选型比较、提案文案、正式采用成本。
- `delivery.md`：本交付记录。

## 已做检查

- 两个 JS 文件 `node --check` 通过。
- `git diff --check` 无空白错误；历史 roadmap 文件出现行尾提示，不涉及本次修改。
- 两个原型、对照入口、两个 CSS、两个 JS、参考与决策文档共 9 项本地 HTTP 请求均返回 200。
- Logo、LICENSE、V1/V2/V3、联系页引用的目标文件存在。
- 源码使用原生页面和按钮，没有接入麦克风、摄像头、AI 网络请求和正式草稿存储。
- 本次仅新建 `docs/design/home-next/` 内容。已有 roadmap 和工单改动保留，正式首页、配置、训练页未修改。

未进行浏览器逐项交互自动化、真实设备兼容性或 AI 视觉评分；没有将源码检查和 HTTP 200 称为完整验收。手机断点已实现，实际视觉适配交由 Founder 查看。桌面模式随可用宽度伸缩，最大 1366；手机模式最大 390，窄窗口会继续缩窄。

## 交互与边界

- A：句子悬停 / 聚焦显示改写，点击可切换；「换一句」切换三个预置样例。
- B：三个步骤可前后切换；「换一句」重置到新样例的第一步。
- 两套都有中英文切换、训练层锚点、实际训练入口及页尾链接。
- 两套不默认自动播放，静态与减少动态条件下也能阅读。A 的原有 Logo 仅悬停轻微扶正，不冒充新版本眼球追踪动效。
- 英文模式是本预览的语言。跳转已有训练页后沿用正式产品自己的语言设置，不替你修改其本地存储。
- 无账号假数据、付费入口、假用户证言或观众兴趣曲线。
- **没有接入现有调控板，也没有改动保存的参数。** 待你选中一套后，再做正式集成与参数映射。
- 未提交、推送、部署。现有首页不变。

## Founder 最短验收顺序

1. 对照页先看 A，再看 B；有需要点击「单独打开」获得完整宽度。
2. 在你倾向的方案里点一次示例交互，切一次英文和手机模式。
3. 告诉执行岗「选 A / 选 B / 都不选」，再给出最影响观感的两三处。此时才进入正式接入或下一轮修改。
