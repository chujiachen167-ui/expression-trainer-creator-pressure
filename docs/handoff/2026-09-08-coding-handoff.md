# Read Yourself 编码交接报告

日期：2026-09-08。用途：在新的会话窗口继续开发。本文件覆盖当前 `main` 上已推送状态，替代过期的首页融合交接与未更新的路线图描述。

## 0. 新会话请先粘贴这段

```
你在 Read Yourself / Expression Trainer · Creator Pressure 主仓库继续编码。

主目录：C:\Vibe coding program\expression-trainer-vertical-prototypes
当前分支：main
当前提交：d9f906e Add a coding handoff for the next session.
远端：https://github.com/chujiachen167-ui/expression-trainer-creator-pressure.git
origin/main 已与本地 d9f906e 对齐。补充本文件后工作区会有未提交改动。

先读：
- docs/handoff/2026-09-08-coding-handoff.md（本文件）
- .better-web-ui.md
- docs/v2/judgment-contract.md
- docs/design/2026-09-08-v2-recording-workspace.md

不要 git reset --hard，不要切换走 main 影响其他窗口。
独立工作树 C:\Vibe coding program\expression-trainer-v2-execution 停在旧提交 3e485d5，不要在那里继续改；正式代码以主仓库 main 为准。
不要改首页品牌名、Logo 图形、不要接入新付费服务、不要擅自部署 Cloudflare。
技术栈保持原生 HTML/CSS/JavaScript + Electron。
extraCopy 生产应用已修，等 Pages 重建后由 Founder 在网站无痕窗口验收。不要当成“生产故意不用遗漏文案”。
```

## 1. 仓库与运行

| 项 | 值 |
|---|---|
| 主仓库 | `C:\Vibe coding program\expression-trainer-vertical-prototypes` |
| 分支 | `main` @ `d9f906e`，已 push。本文件补充后本地会脏 |
| 线上 | `https://read-yourself.com`（Cloudflare Pages）。当前线上仍是 `d9f906e`。extraCopy 生产应用已修，需本次提交进 Pages 后验收 |
| 独立工作树 | `C:\Vibe coding program\expression-trainer-v2-execution` / `codex/v2-judgment-review` @ `3e485d5`。过期，勿再改 |

启动：

```powershell
cd "C:\Vibe coding program\expression-trainer-vertical-prototypes"
npm start
```

独立工作树缺 Sherpa 模型时，把主仓库 `models/sherpa-onnx-streaming-paraformer-bilingual-zh-en` 接到工作树同路径（junction）。主仓库本机若已装模型，直接 `npm start`。

网页预览：

```powershell
npm run package:web
npm run preview:web
```

预览地址：`http://127.0.0.1:8976/`。打包会给 `<body data-environment="production">`，**忽略浏览器 localStorage 草稿**。Electron / 直接打开源码会合并草稿。

检查：

```powershell
npm run check
npm test
```

## 2. 产品是什么

面向自媒体新手的镜头表达训练，不是课程、MCN、会议软件或面试工具。闭环：选题 → 开口练 → 看到可定位的反馈 → 同题重练比较。

V1 / V2 / V3 共用诊断底座，不是三个产品。

必须诚实：

- 首页滚动句是预置示例，不是实时 AI。
- V2 兴趣是规则模拟，不是真实观看率、心理测量或流量预测。
- 转写失败不能说成麦克风失败。
- 规则判断器 `rules-v1.0.0` 不是语义模型。

## 3. 已经落在 main 上的能力

### 首页（融合方案 A）

- 正式首页是 `home-fusion`：克制顶栏、Read Yourself 主标题、右侧大 Logo + Vertical Marquee。
- 大 Logo 必须完整落在右栏内，**禁止靠撑宽页面或横向滚动条来露全图**。当前背景 Logo 用完整 viewBox `0 220 1254 820`，首页 CSS 把图层锁在 `width:100%; left:0`。
- 右上角暂停键 `Ⅱ` 已删除。眨眼、鼠标跟随、以及跟着眨眼切换的字幕改写必须继续工作。
- 文案以 2026-09-06 保存的首页文案为准；位移/宽高类旧微调会在 `homeFusion.visualVersion` 迁移时清掉。当前 visualVersion：**5**。
- Warp Text 默认关，调控板开关保留。

关键文件：`index.html`、`home-fusion.css`、`home-fusion.js`、`launcher-logo-motion.js`、`launcher-transcript.js`、`creator-project-config.js`。

### V2 判断与复盘（TKT-V2-001，已合入 main）

- 会话/片段/事件模型：`v2-session-model.js`
- 规则判断器：`v2-rule-judge.js`
- 复盘与同题比较、导出 JSON：`v2-review.js`
- 时间轴曲线与原句定位：`v2-interest-panel.js`
- 开发回放（不进正式打包）：`dev/v2-replay.html`
- 契约：`docs/v2/judgment-contract.md`
- 工单执行报告：`docs/delivery/TKT-V2-001-report.md`（部分路径仍写独立工作树，以 main 代码为准）

兴趣是相对模拟分（12–92，初始 50）。无发言、转写失败不评分。粘贴全文没有精确时间。

### V2 监看台视觉

- `v2-focus.js` / `v2-focus.css`：左栏暖灰设置、右栏可收起、转写改为舞台下方场记纸带、兴趣图叠在观众画面上。
- 设计说明：`docs/design/2026-09-08-v2-recording-workspace.md`（文中“未提交”已过期，代码已在 `ad578a3`，现随 `d9f906e` 在线上）。
- 不改 V1 配色与布局。
- `v2Focus.visualVersion`：**3**。旧 V2 侧栏色和舞台固定宽度会迁移成分成比例 `v2Stage.audienceShare`。

### 调控板与配置

- 项目配置：`creator-project-config.js`
- JSON 副本：`docs/creator-pressure-config.json`
- 最近一次 Founder 保存：`savedAt: 2026-09-08T13:55:02.477Z`，已随 `ad578a3` 提交。extraCopy 生产应用见第 4 节，等本次提交随 Pages 上线后验收。
- 观众选择窗不再 `showModal()`，避免盖住调控板。调控板 z-index 420/421，选择窗 400/401。
- 右栏展开/收起箭头已水平翻转：展开时朝外，收起后朝内。

### 转写

- 桌面：Sherpa-ONNX，模型在 `models/`（gitignore）。
- 浏览器：Web Speech，或同域 Cloudflare Whisper（默认关闭）。
- 网页 Whisper 区分音频分片时间和网络返回时间。

## 4. 明确未完成 / 不要冒领

1. **本机文案上线：extraCopy 生产应用已修，等 Pages 重建后由 Founder 在网站无痕窗口验收。**
   - 这是遗留缺口，不是“生产故意不用 extraCopy”。约定一直是：生产隐藏调控板、忽略 localStorage 草稿，但**项目 JS 里的文案要上线**。当时只给 `fineTune` 做了 `applyShipped()`，`extraCopy` 只挂在调控板 `mount()` 上。
   - 对照句：页脚应变为「你从不缺乏面对镜头开口的勇气，就从现在开始！」；右侧「READ / SPEAK / REPEAT」按已保存 extraCopy 为空。V1「设备选择与录制」、V2 被清空的标题/说明同样走 extraCopy。
   - 叠加原因仍在：Electron / 直接打开源码会叠浏览器草稿 `expression-trainer.creator-qa.v1`。验收请用无痕窗口打开 `https://read-yourself.com`，不要用本机开发窗口当线上。
   - 「保存到项目」仍不会自动 commit / 部署。本次修的是应用层；推上 GitHub 后等 Pages 资源戳离开 `d9f906e8e9e6` 再看。
   - `copy` 主表里仍有过期的 `launcher.h2.8` / `launcher.span.6` 等旧首页键，融合首页有效键是 `data-qa-copy-key`（如 `fusion.footer.title`、`launcher.h1.1`）。不要靠改 HTML 默认句绕过 extraCopy，除非 Founder 要把那句升成源码正文。
2. **Mac 实机字幕验收**：并行，未通过。不能宣传网页字幕在 Mac 上已稳定。
3. **阶段 2 数字人视频**：统一事件接口已有，实时生成数字人、付费供应商未授权接入。
4. **Founder 审美验收**：首页 Logo 完整度、V2 监看台是否“好用/高级”，仍由 Founder 看。执行岗不做自动视觉打分。
5. **V2 正式页没有 V1 那套本地录像控件**；有时间映射才显示跳转，开发回放可注入测试映射。

## 5. 编码时的硬边界

- 栈：原生 HTML/CSS/JS + Electron。不为单个组件引入 Vue/React。
- 网页打包白名单：`scripts/package-web.js`。新的浏览器运行文件必须加入；`dev/` 回放页不得进 dist。
- 不改首页品牌名、眼睛相机 Logo 图形资产、不偷偷改已批准文案。
- 不接入新的付费 API / GPU / 外部数字人，除非 Founder 单独立项。
- 配置保存不能把训练正文写进公开的 `creator-project-config.js`。
- 浏览器草稿：`expression-trainer.creator-qa.v1`。生产预览忽略草稿。布局迁移靠 `homeFusion.visualVersion` / `v2Focus.visualVersion`，不要反复重置 Founder 新保存的微调。

## 6. 建议阅读顺序（编码）

1. `docs/handoff/2026-09-08-coding-handoff.md`
2. `.better-web-ui.md`
3. `docs/v2/judgment-contract.md`
4. `v2-session-model.js`、`v2-rule-judge.js`、`app.js` 中 V2 桥接
5. `v2-ai-audience.html`、`v2-focus.css`、`v2-focus.js`
6. `index.html`、`home-fusion.js`、`home-fusion.css`
7. `control-panel.js`、`creator-project-config.js`
8. `tests/v2-judgment.test.js`、`tests/v2-focus.test.js`、`tests/home-fusion.test.js`

工单原文（历史）：

- `docs/work-orders/TKT-V2-001.md`（判断闭环，工程已合入）
- `docs/work-orders/TKT-HOME-001.md`（首页 A/B，方案 A 已融合进正式首页）

## 7. 新会话可能接到的下一刀

按产品主线，而不是再开平行首页大改：

1. Founder 继续体验 V2：选题、观众选择+调控板、收起箭头、曲线定位原句、同题比较、导出 JSON。
2. **网站端验收 extraCopy**：本机代码已修，推送后等 Pages 重建。无痕打开 `read-yourself.com` 看页脚和首页右侧说明。Whisper 开关仍默认关。
3. 阶段 2：用现有判断事件驱动一个观众形象的倾听 / 疑惑 / 兴趣回升，先做本地免费原型。
4. Mac 字幕验收仍可并行，用 `docs/stt/web-stt-cloudflare.md` 和真实设备记录，不要和 V2 规则开发绑死。

未接到明确工单时，先问 Founder 下一件要改的界面，不要自行扩展数字人或改首页品牌。
