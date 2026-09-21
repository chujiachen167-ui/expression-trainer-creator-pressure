# TKT-V2-002 执行报告

日期：2026-09-10。CEO 复核状态：**CONDITIONAL（本机官方链路已出真实像素；不得对外宣称公开版 Live2D 已接通）**。

Founder 明确同意软件许可后，执行岗下载并核验了官方 Core、Framework 和 Samples，在隔离目录构建本机 bridge，并用官方 Hiyori 模型取得真实 WebGL 像素。默认运行路径现在要求官方 Framework bridge 且必须读到非透明像素才写入 `ready`；缺 bridge 或 context loss 都恢复 SVG。公开许可、用户自有四态模型的 Electron 端到端和多观众性能仍未验收，因此工程状态不能记为最终 PASS。没有 commit、push 或 Cloudflare 部署。

## 官方本机证据

- Cubism Core：官方托管 latest，运行日志 `Live2D Cubism SDK Core Version 6.0.1`；SHA-256 `8741F739779B5D5210872BD3D7D99F0F1E56E6C87409E7D26D6BB4B80AA1EF47`。
- Cubism Web Framework：`Live2D/CubismWebFramework`，本机提交 `d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b`。
- Cubism Web Samples：`Live2D/CubismWebSamples`，本机提交 `b1de66b0b1f1cb881d95fb6158622aeb6a2827bd`。
- 官方 Demo 构建通过；官方 Hiyori 样例在 Read Yourself 本机 bridge 中完整显示，最终干净浏览器运行无 error/warn。
- 首轮验证真实发现并修复了 Shader 目录、PNG Y 方向和 Pose 初始化；这也是此前模拟 Presenter 测试无法覆盖的问题。
- 真实浏览器调用 `WEBGL_lose_context` 后状态转为 `webgl-unavailable` 并恢复 SVG；重新打开验证页后恢复 `ready`。

## 基线

- 主仓库：`C:\Vibe coding program\expression-trainer-vertical-prototypes`
- 分支：`main`
- 未提交工作保留；本单在既有本地导入/校验/四态边界上补齐像素运行时与失败恢复。

## 变更

新增：

- `live2d-local-runtime.js`：默认加载本机官方 Framework bridge；四态映射；Pose 资源读取；缺 Core / bridge / WebGL / 可见像素或模型加载失败时恢复 SVG。手写 Presenter 不再是默认路径
- `local-runtime/README.md`：说明用户自行放置 `live2dcubismcore.min.js`，该文件不进 Git 与网站打包
- `tests/live2d-local-runtime.test.js`
- `docs/delivery/TKT-V2-002-report.md`

修改：

- `live2d-local-validator.js`：导出路径拼接与受校验文件读取
- `live2d-local-import.js`：显示“只在本机使用”；按适配器状态说明恢复原因；避免重复挂载造成空白画布循环
- `main.js` / `preload.js`：CEO 复核后改为按本次会话授权的不透明模型 ID 读取；绝对路径不进入页面存储，页面也不能通过传入任意目录自行取得读取权限
- `v2-audience-stage.js`：把本地适配器交给运行时
- `main.js` / `preload.js`：仅读取已校验模型文件夹内的清单引用文件
- `v2-ai-audience.html`、`v2-focus.css`、`app.js`（CEO 复核后撤下 V3 死入口；V3 尚无兼容观众舞台）
- `scripts/package-web.js`、`package.json`、`.gitignore`
- 既有 Live2D 测试与 `docs/avatar/live2d.md`、`docs/avatar/local-import.md`、工单状态

## 验收对照

1. 导入按钮是原生 `button`，文案含“只在本机使用”。
2. 合法文件夹仍通过校验并进入本机列表。
3. 缺文件、路径越界、远程引用、超限与非文件夹均给出具体错误。
4. WebGL 不可用、模型加载失败、缺 Cubism Core、缺官方 Framework bridge 或没有可见像素时 `presentation=svg`，SVG 仍在 DOM，不留下空白 canvas。
5. 导入模型不改变 `expressionFromEvent` 判断结果。
6. 网页打包含运行时脚本，不含 `local-runtime/`、Cubism Core、`models/` 或用户绝对路径。
7. 语法、契约与打包测试退出码见下方。

## 测试命令与退出码

均在主仓库执行：

| 命令 | 退出码 |
|---|---|
| `npm run check` | 0 |
| `npm test` | 0 |
| `npm run package:web` | 0 |
| `git diff --check` | 0（仅有 Windows `LF will be replaced by CRLF` 提示，无空白错误） |

补充桌面冒烟：`npm run smoke` 及禁用 GPU 参数重试都在进入渲染断言前退出，宿主 Chromium 报 GPU 进程不可用与缓存目录拒绝访问。该结果仍记为 **BLOCKED（执行环境）**；本次真实像素证据来自隔离的本机浏览器验证页，不等同于 Electron 文件夹选择器端到端 PASS。

`dist` 含 `live2d-local-runtime.js`，不含 `local-runtime/`、`live2dcubismcore.min.js`、`models/`。

## 未冒领

- 尚未用用户自有且明确授权的四表情模型完成 Electron 导入、四态逐项截图和重启后的文件夹再授权。
- 官方 Natori 样例在不运行其 idle motion 时会暴露多姿态部件；当前 bridge 已处理 Pose，但尚未把任意模型的 idle motion 作为静态观众初始化条件。
- 尚未测同一模型同时挂到多观众窗时的 GPU、内存和帧率，因此不能把单画布成功外推为完整观众包性能 PASS。
- 用户可导入任意模型，极可能属于 Live2D 的“可扩展应用”；公开发布前需要官方审核与特别出版许可，不能以一般营收豁免概括。

## CEO 下一步决定

默认路径已切到官方 Cubism Web Framework，本机官方样例的真实像素与失败恢复已验收。下一步不再扩展手写 WebGL 渲染器，而是用用户自有四表情模型完成 Electron 端到端、重启再授权和多观众性能验收；公开版继续以 SVG 为唯一已获发布许可的呈现。
- 未跑真实 GPU LiveTalking，不得写成线上数字人已接通。
- 未做 Founder 视觉验收。
