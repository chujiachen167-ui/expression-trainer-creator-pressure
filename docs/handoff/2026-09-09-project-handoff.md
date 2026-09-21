# Read Yourself 项目交接报告

日期：2026-09-09  
用途：在新的 Codex 会话窗口继续当前项目。  
本报告以 2026-09-09 的磁盘、Git 和测试结果为准，替代 `2026-09-08-coding-handoff.md` 作为最新入口；旧报告保留作历史记录。

## 0. 新会话直接粘贴这段

```text
继续 Read Yourself / Expression Trainer · Creator Pressure 项目。

主仓库：C:\Vibe coding program\expression-trainer-vertical-prototypes
当前分支：main
当前 HEAD：04f685c Apply shipped extraCopy in production without the QA panel
远端：https://github.com/chujiachen167-ui/expression-trainer-creator-pressure.git

先完整阅读：
1. docs/handoff/2026-09-09-project-handoff.md
2. .better-web-ui.md
3. docs/v2/judgment-contract.md
4. docs/design/2026-09-08-v2-recording-workspace.md
5. docs/avatar/livetalking.md
6. docs/avatar/live2d.md

当前 main 与 origin/main 同指向 04f685c，但工作区有一批未提交的 V2 数字观众阶段 2 改动。先看 git status 和 diff，禁止 reset、checkout、clean 或覆盖这些改动。

另一个工作树 C:\Vibe coding program\expression-trainer-v2-execution 停在旧分支 codex/v2-judgment-review @ 3e485d5，不要在那里继续正式开发。

当前在建主线：V2 用自有 SVG 二维观众表达“在听 / 没跟上 / 兴趣回升 / 注意力下降”，并为本地或未来 HTTPS GPU LiveTalking 服务保留 WebRTC Provider。生产配置仍是 mock；没有公开 HTTPS GPU 地址，不能宣称网站数字人已接通。

2026-09-09 已验证：npm run check、npm test、npm run package:web 均退出 0。自动测试以 DOM/契约为主，不代表视觉、真实设备、真实 GPU 或线上部署验收。

不要继续此前关于“9 月 6 日旧参数覆盖”的未完成讨论；Founder 已明确表示那段工作可以不再处理。除非收到新的明确反馈，不要主动重做首页或旧参数迁移。

不要擅自提交、推送、部署 Cloudflare、引入付费服务或改品牌 Logo。先由 Founder 指定下一项并进行视觉/交互验收。
```

## 1. 当前仓库快照

| 项目 | 当前状态 |
|---|---|
| 主目录 | `C:\Vibe coding program\expression-trainer-vertical-prototypes` |
| 分支 | `main` |
| HEAD | `04f685c53a38bdb8861e6e305ef3a139a178c3f4` |
| origin/main | 与本地 HEAD 对齐（本次检查时） |
| 远端 | `https://github.com/chujiachen167-ui/expression-trainer-creator-pressure.git` |
| 项目版本 | `0.2.2` |
| 项目配置最近保存 | `2026-09-08T13:55:02.477Z` |
| 工作区 | **脏；有未提交改动，必须保留** |
| 网站 | `https://read-yourself.com`，本次没有核验线上部署版本 |
| 本地生产预览 | `npm run package:web` 后运行 `npm run preview:web`，打开 `http://127.0.0.1:8976/` |

本次只新增此交接文档；没有 commit、push 或部署。

## 2. 已提交基线（04f685c）

`04f685c` 已修复正式网页隐藏调控板时仍能应用项目中保存的 `extraCopy` 文案，并补充对应生产运行测试。基线还包含：

- 首页融合版、Logo 动效、纵向表达流和已保存的 Founder 配置。
- V1 镜头表达基线、V2 数字观众压力场、V3 创作者实战页。
- V2 会话模型、规则判断、兴趣曲线、复盘、同题比较和 JSON 导出。
- V2 监看台视觉结构：左右侧栏、观众/创作者舞台、场记式转写区和可收起实时反馈。
- 桌面 Sherpa-ONNX 与网页 Web Speech / 可选 Cloudflare Whisper 的既有通道。

注意：本次没有打开线上网站核对 Cloudflare Pages 当前是否已经部署到 `04f685c`，因此只能确认 GitHub 基线，不能把线上状态写成已验收。

## 3. 当前未提交工作：V2 数字观众阶段 2

### 3.1 新增文件

- `avatar-runtime.js`
  - 生产数字人运行配置入口。
  - 当前固定 `provider: "mock"`、`serverUrl: "http://127.0.0.1:8010"`。
  - 只有将来获得公开 HTTPS GPU 服务后，生产网页才可能切到 `live`。
- `v2-audience-expression.js`
  - 把 V2 判断事件映射成四个状态：`listen`、`confused`、`interest`、`drop`。
- `v2-audience-stage.js`
  - 用仓库自有 SVG 面部呈现四态；事件后约 5.2 秒回到“在听”。
  - LiveTalking 视频成功接入后隐藏 SVG 降级层。
- `tests/avatar-provider.test.js`
  - 覆盖开发草稿、生产运行配置、mock/live Provider 边界。
- `tests/v2-audience-expression.test.js`
  - 覆盖事件到表情状态映射和观众舞台挂载。
- `docs/avatar/livetalking.md`
  - 说明本地 LiveTalking、HTTPS/GPU/WebRTC 边界和接入步骤。
- `docs/avatar/live2d.md`
  - 说明当前是自有 SVG 表情层，不是已接入 Cubism 的正式 Live2D 模型。
- `scripts/setup-livetalking.ps1`
  - 本地 LiveTalking 启动提示脚本；不负责把 GPU 服务部署到网站。

### 3.2 已修改文件

- `app.js`
  - 应用受众模板时挂载二维观众。
  - V2 判断事件驱动观众表情。
  - “试听反应”同时触发表情与 Provider 播报，但不写入正式训练会话。
- `avatar-provider.js`
  - 新增生产运行配置、连接探测、HTTPS 页面访问 HTTP 本机服务的混合内容提示、STUN 配置和更诚实的失败降级。
- `control-panel.js`
  - 保存 LiveTalking 配置后执行可达性探测并显示原因。
- `v2-focus.css`
  - 新增 SVG 观众四态样式；实时视频接通后隐藏 SVG。
- `v2-ai-audience.html`
  - 加载运行配置、表情映射和二维观众舞台脚本。
- `v1-camera-baseline.html`、`v3-creator-studio.html`
  - 加载共享 `avatar-runtime.js`，尚未增加 V2 式表情舞台。
- `scripts/package-web.js`
  - 将三个新浏览器运行文件加入网页打包白名单。
- `package.json`
  - 将新文件加入语法检查，将两个新测试加入全量测试。
- `tests/audience-engine.test.js`、`tests/package-web.test.js`
  - 补充 Provider 接口和网页产物覆盖。
- `docs/handoff/2026-09-08-coding-handoff.md`
  - 本地仅修改了“下一刀”为 B+C 并行说明；旧报告仍写着过期 HEAD，不应再作为首要入口。

## 4. 不得误报的边界

1. **当前不是“线上数字人已完成”。** `avatar-runtime.js` 仍使用 `mock`；网页只会显示浏览器演示/二维 SVG 降级层。
2. **HTTPS 网站不能直连用户电脑的 HTTP localhost。** `https://read-yourself.com` 无法直接访问 `http://127.0.0.1:8010`。要上线 LiveTalking，必须另有公开 HTTPS GPU 服务，并处理 WebRTC、UDP、STUN/TURN、许可、成本和隐私。
3. **当前二维脸不是 Live2D Cubism。** Cubism Core 和正式模型都没有进入仓库；不要在文案或汇报中混称。
4. **相邻 LiveTalking 仓库独立存在。** `C:\Vibe coding program\LiveTalking` 当前是独立 `main`，HEAD `c4f8c16`；它不属于 Read Yourself Git 仓库，也不能随 Pages 打包。
5. **自动测试不是视觉验收。** 四态表情的美学、舞台尺寸、遮挡、动效节奏和真实用户感受尚未由 Founder 验收。
6. **没有真实 LiveTalking 连接证据。** 本次没有启动 GPU 服务、没有跑真实 WebRTC 视频、没有验证 `/offer` 或 `/human` 的真实成功响应。
7. **没有线上与 Mac 实机证据。** 本次没有验证 Cloudflare Pages 当前版本、Mac 麦克风/字幕或 Cloudflare Whisper 实际可用性。

## 5. 2026-09-09 验证结果

| 检查 | 结果 | 证据边界 |
|---|---|---|
| `npm run check` | PASS，退出码 0 | JavaScript 语法与清单完整性 |
| `npm test` | PASS，退出码 0 | 全量 DOM/契约测试；包含新增 Provider 与四态表情测试 |
| `npm run package:web` | PASS，退出码 0 | `dist` 成功重建，新运行文件进入网页产物 |
| `git diff --check` | PASS，退出码 0 | 无空白错误；终端提示部分文件未来可能 LF→CRLF |
| Electron `npm run smoke` | 本次未运行 | 不得写成通过 |
| 浏览器视觉验收 | 本次未做 | 不得写成通过 |
| LiveTalking 实连 | 本次未做 | 不得写成通过 |
| 线上网站验收 | 本次未做 | 不得写成通过 |

## 6. 新会话的安全接手顺序

1. 进入主仓库，先运行 `git status --short --branch` 和 `git diff --stat`，确认本报告列出的改动仍在。
2. 阅读 `app.js`、`avatar-provider.js`、`avatar-runtime.js`、`v2-audience-expression.js`、`v2-audience-stage.js` 的未提交差异。
3. 启动本地页面，优先用 mock 检查：选择观众、试听反应、四态切换、5.2 秒复位、右栏事件和字幕区域是否互相遮挡。
4. 由 Founder 做一次 V2 视觉验收；重点不是“能显示”，而是表情形象是否符合 Read Yourself 的专业与艺术审美。
5. 若要验证 LiveTalking，只在本地 HTTP 预览或 Electron 中连接 `http://127.0.0.1:8010`；把真实启动日志、GPU 型号、`/offer` 和 `/human` 结果记录下来。
6. 若 Founder 不接受当前 SVG 表情方向，保留 Provider/事件接口，重做表现层即可，不要推翻 V2 判断模型。
7. 通过验收后再决定提交范围。commit、push、Cloudflare 部署是三个独立动作，分别确认；不要因“保存参数”推断已经授权发布。

## 7. 常用命令

```powershell
cd "C:\Vibe coding program\expression-trainer-vertical-prototypes"

git status --short --branch
git diff --stat

npm run check
npm test

npm start

npm run package:web
npm run preview:web
# http://127.0.0.1:8976/
```

若只看 V2：

```text
http://127.0.0.1:8976/v2-ai-audience.html
```

## 8. 关键文件阅读顺序

1. `docs/handoff/2026-09-09-project-handoff.md`
2. `.better-web-ui.md`
3. `docs/v2/judgment-contract.md`
4. `v2-session-model.js`、`v2-rule-judge.js`、`v2-review.js`
5. `v2-ai-audience.html`、`v2-focus.css`、`v2-focus.js`
6. `v2-audience-expression.js`、`v2-audience-stage.js`
7. `avatar-runtime.js`、`avatar-provider.js`、`app.js`
8. `docs/avatar/livetalking.md`、`docs/avatar/live2d.md`
9. `control-panel.js`、`creator-project-config.js`
10. `scripts/package-web.js` 和新增测试

## 9. 当前建议的下一项工作

优先做一次 **V2 数字观众表现层的 Founder 本地验收**，再决定保留、重画或替换 SVG 四态。技术接口已经足以支撑换表现层；当前最需要确认的是品牌气质和交互感受，而不是继续扩展 Provider 数量。

此前“9 月 6 日旧源码参数没有被新参数覆盖”的讨论，Founder 已在 2026-09-09 明确要求不再处理。除非后续重新提出并给出当前页面证据，新会话不要把它当作待办恢复。
