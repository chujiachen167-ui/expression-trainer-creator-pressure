# TKT-V2-001 执行报告

日期：2026-09-05。工程交付状态：**PASS**。

PASS 只表示本单工程交付通过。Founder 体验验收和 Mac 实机字幕验收另列，不在本报告中冒领。

## 基线与分支

- 主仓库：`C:\Vibe coding program\expression-trainer-vertical-prototypes`
- 开工时主仓库 `HEAD`：`d6f414d` / `main`（`Add cross-browser web transcription fallback`）
- 主仓库当时另有未提交文档：`docs/roadmap/`、`docs/work-orders/`。本执行未回退这些文档，也未在主目录改产品代码。
- 工作树：`C:\Vibe coding program\expression-trainer-v2-execution`
- 分支：`codex/v2-judgment-review`
- 开工记录：`git rev-parse --show-toplevel` → 工作树路径；工作树从 `d6f414d` 检出。
- 未推送、未部署、未操作 Cloudflare / DNS / 支付 / GPU / 外部数字人。

## 变更文件

新增：

- `v2-session-model.js`：会话 / 片段 / 判断事件，DOM 无关
- `v2-rule-judge.js`：可替换判断器的规则实现 `rules-v1.0.0`
- `v2-review.js`：复盘、同题比较、复盘 JSON
- `v2-interest-panel.js`：V2 时间曲线、原句定位、复盘 UI
- `dev/v2-replay.html`：开发回放入口（测试数据，不进正式打包）
- `tests/v2-judgment.test.js`
- `docs/v2/judgment-contract.md`
- `docs/delivery/TKT-V2-001-report.md`

修改：

- `app.js`：转写适配入口写入片段；停止时等待已接受终稿；V2 追问复用同一事件；压力 / 受众改动下一轮生效
- `web-stt.js`：区分音频片段边界与结果到达时间
- `v2-ai-audience.html`：接入 V2 面板与新模块
- `shared.css`：V2 曲线 / 复盘样式；窄屏先练习后曲线
- `control-panel.js`：V2 曲线复盘外观与下一轮判断参数
- `locales/zh-CN.js`、`locales/en-US.js`
- `scripts/package-web.js`、`package.json`
- `tests/brand-logo.test.js`：调控板分页由 8 增至 9（新增 V2 曲线复盘页）
- `tests/package-web.test.js`、`tests/qa-element-editor.test.js`、`tests/v2-topic-picker.test.js`

未改首页、Logo、文字动效、既有用户配色值。未接入新付费服务。V1 / V3 仍走原兴趣曲线与原追问路径。

## 启动 / 预览

正式练习（工作树内）：

1. `cd "C:\Vibe coding program\expression-trainer-v2-execution"`
2. `npm start` 打开桌面端，进入 V2；或用本地静态服务打开 `v2-ai-audience.html`（麦克风需要 localhost / HTTPS）

开发回放（不依赖 Mac 实机字幕）：

- 打开 `dev/v2-replay.html`
- 页面标明测试数据；复用正式 `CreatorV2Session` / `CreatorV2RuleJudge` / `CreatorV2Review`
- 不得把这里的演示数据当成用户真实会话，也不得当成 Mac 实机通过

## 测试命令与退出码

均在工作树执行：

| 命令 | 退出码 |
|---|---|
| `npm run check` | 0 |
| `npm test` | 0 |
| `npm run package:web` | 0 |
| `git diff --check` | 0（仅有 Windows `LF will be replaced by CRLF` 提示，无空白错误） |

打包重建了工作树 `dist/`。其中包含 `v2-session-model.js`、`v2-rule-judge.js`、`v2-review.js`、`v2-interest-panel.js`。不含 `dev/`、回放页、用户独有文件、Electron、`node_modules`、`models`。

旧测试更新：`tests/brand-logo.test.js` 将调控板 tab 数从 8 改为 9，并走一遍新的 `v2-interest` 分页。这是本单新增外观分区，不是删测掩盖失败。

## 未通过项

无工程检查失败项。

## 时间精度边界

- 词级时间：仅当适配器提供 `wordTimings` 时显示词级定位
- 网页 Whisper：使用录音分片起止，不用网络返回时间当发言时间
- 浏览器 Web Speech：无可靠音频边界时标为估算（`~`）
- 粘贴全文：`timePrecision = none`，不生成前三秒结论，不提供虚假跳转
- 录像跳转：练习开始与录制开始的偏移会扣除；未录制 / 不能 seek / 时间未知则回退逐字稿

## 已知限制

- 规则判断器不是语义理解。已在曲线说明和接口文档中标明。
- V2 正式页当前没有 V1 那套本地录像控件；有可跳转映射时按钮才会出现。回放入口可注入测试映射。
- Mac 实机字幕验收并行，本单用受控输入验证。受控输入通过 ≠ Mac 实机通过。
- 英文规则覆盖基本词边界和大小写，不是完整英语修辞分析。
- 分数是相对模拟兴趣（12–92，初始 50），不是留存概率。

## 人工验收（不超过 8 步）

1. 打开 V2，应用一个受众模板，开始训练。右侧标题应为“模拟观众兴趣趋势”，并有“不是真实观看率”的边界说明。无发言时不要出现假曲线。
2. 说几句后，曲线横轴应按会话时间而不是 18 个均分点。点选一个事件，逐字稿应定位到对应片段并标出证据。
3. 结束训练。复盘最多三个关键事件、开场判断或信息不足、一条下一轮动作。空白轮或转写失败不应把失败算成表达差。
4. 点“再练同一题”，第二轮结束后应引用前后原句。不要把第二轮写成必然更好。中途改受众或压力应提示下一轮生效，条件不同则不可直接比较。
5. 点“保存复盘 JSON”。导出前能看出含逐字稿；文件不含音视频、密钥或设备信息。刷新可提示未保存，但不阻断离开。
6. 打开调控板“V2 曲线复盘”。改颜色、字号、图表高度、提示密度，应只影响 V2 外观，不改已经产生的训练结果。保存项目配置应含这些外观参数，不含训练正文。
7. 打开 `dev/v2-replay.html`，分别跑：不等间隔片段、粘贴全文、同题第二轮、可跳转录像、转写失败。确认测试横幅在，且正式 V2 页没有这个入口。
8. Founder 自行看是否好用。执行者不做高级感自动视觉验收。

## Founder 体验与 Mac 实机

- Founder 体验：未判定。
- Mac 实机字幕：未完成，不阻塞本单，也不能宣传为已通过。
