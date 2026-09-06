# Read Yourself 首页融合版交接报告

日期：2026-09-06
用途：交给新的 Codex 会话继续开发，替代当前过长的会话上下文。
当前结论：方案 A 已被 Founder 选中并融合进正式首页；最后一项 Vertical Marquee 连续滚动修正已完成代码实现与非视觉检查，等待 Founder 人工验收。验收通过后，本轮首页 UI 优化即可收尾。

## 1. 新会话首先要知道的事

- 主仓库：`C:\Vibe coding program\expression-trainer-vertical-prototypes`
- 当前分支：`main`
- 当前本地与远端基准：`d6f414d Add cross-browser web transcription fallback`
- `origin/main` 也停在 `d6f414d`。
- 首页融合工作尚未提交、尚未推送、尚未部署，全部保留在当前工作树中。
- **禁止执行 `git reset --hard`、`git checkout --`、清理未跟踪文件或用远端版本覆盖本地。** 这些未提交文件就是本轮成果，不是垃圾文件。
- Founder 负责视觉与产品验收。执行岗只做必要的语法、行为契约和回归检查，不要用自动截图或 AI 审美结论替代人工验收。
- 当前项目是原生 HTML / CSS / JavaScript + Electron；网页由 Cloudflare Pages 打包。不要迁移 React、Vue，也不要为一个组件改技术栈。

## 2. 产品定位与不可偏离的边界

Read Yourself 面向自媒体新手与创作者，核心是镜头表达训练：选择任务、开口练习、看到具体诊断、回看并同题重练。V1、V2、V3 是同一诊断底座上的训练层，不要改造成通用面试软件、会议工具、课程商城或 MCN 运营后台。

产品表达必须诚实：

- 首页滚动句子是预置表达示例，不是假装实时 AI 生成。
- V2 的观众兴趣度将来只能称为模拟判断，不能宣传为真实留存率、真实心理测量或平台流量预测。
- 权限、录制、转写失败必须区分；不能把识别服务失败说成麦克风失败。
- 保留上游 Expression Trainer 的诊断核心、开源署名及第三方许可。

## 3. 首页方案的决策过程

两套完整提案保存在：

- `docs/design/home-next/index.html`：A/B 对照入口
- `docs/design/home-next/option-a.html`：A，品牌先被记住
- `docs/design/home-next/option-b.html`：B，效果先被看见
- `docs/design/home-next/delivery.md`：提案交付记录
- `docs/design/home-next/decision-sheet.md`：方案差异与边界

Founder 明确偏好方案 A，之后决定将 A 的构图与原首页已有的配色、Logo 动效、True Focus、Vertical Marquee / Gooey 文案效果融合，而不是照抄 A 原型。

正式融合前的首页存档：

`docs/design/home-next/home-before-fusion-2026-09-05.zip`

这个压缩包用于人工回看旧版本。不要在没有核对路径结构的情况下直接覆盖解压到仓库。

## 4. 已确认的首页最终设计

### 顶栏

- 使用方案 A 的克制顶栏结构。
- 左侧为小 Logo + `Read Yourself.` 品牌字标。
- 中间仅保留“训练方式”“关于项目”。
- 右侧保留中文 / English 切换，并将账户入口表现为圆形头像。
- 账户仍是诚实的本地访客入口，不伪造云账户、会员或订阅。

### 左侧首屏

- 保留眉题 `EXPRESSION TRAINER / CREATOR PRESSURE`。
- 主标题使用 Read Yourself，并保留 React Bits True Focus 聚焦动效。
- 默认排版为两行、跨行聚焦；调控板仍可切换一行横排。
- 主标题两行使用同一主题色，不能做成刻意的双色 AI 风标题。
- True Focus 原速度参数继续由调控板控制；Founder 认为旧节奏整体可接受，仅聚焦切换稍快时可自行调慢。
- 英文副标题文字保留：`When your ideas become content, would you read it yourself?`
- Warp Text 动效默认关闭，但“文字动效”调控页中的参数和开关必须保留，不能删除功能。
- 保留用途说明与“从 V1 开始练习”“了解训练方式”入口；不要增加多余斜箭头。

### 右侧首屏

- 大 Logo 使用项目原有眼睛 / 嘴唇 / 相机图形。
- 恢复既有的全局鼠标跟随与自然眨眼逻辑，不使用 A 原型中“悬停倾斜、离开复位变淡”的简化动效。
- 保留 `READ / SPEAK / REPEAT`。
- Logo 下方是固定高度的单句展示窗口。

### Vertical Marquee / Gooey 文案区

这是当前最需要人工验收的部分。

最终要求：

- 屏幕一次主要看见一句完整句子，允许自然折行。
- 多组句子必须**连续、匀速、缓慢地纵向流动**，不是停留数秒后快速翻页，也不是快速上滑轮播。
- 触碰上下边缘时只做文字透明度渐隐；区域本身没有卡片底色、渐变、圆角、边框、标签或状态灯。
- 鼠标悬停在句子上时暂停滚动，并通过 Codrops Gooey 液化效果将原句隐去、露出优化句；离开后恢复原句并继续滚动。
- 原句的问题词随机使用下划线、文字背景、高亮或虚线框三类表达；优化句通过字号、字重和颜色建立层级。
- 首页取消手动“换一句”按钮。开发者仍可在调控板选择自动、跟随系统减少动态或手动阅读模式。
- 调控板的“上一句 / 下一句”只用于开发者预览。
- `components.transcriptCover.scrollDuration` 是真实速度参数，数值越大越慢。当前项目保存值为 `26000` 毫秒。
- 错误的“单句停留（毫秒）”调控项已经移除。历史 `cycleMs` 字段可能仍留在旧配置中，但运行时不再使用，不应重新接回。
- 单句与旧版多句流都使用同一个 Magic UI 连续滚动引擎；展示方式可以在调控板双向切换。
- 中文与英文各有独立示例文本，编辑格式仍为每组两行：第一行原句，第二行优化句，组间空行。

### THE PRACTICE 与训练层

- 删除“选择今天要承受的压力”、附加副标题及右侧 `01—03`。
- `THE PRACTICE` 字号放大，上下分隔线间距收紧。
- V1、V2、V3 改为三条横向训练入口。
- CTA 靠近正文，使用水平向右箭头，不使用斜箭头。
- 平时背景透明；悬停或键盘聚焦时出现低强度红蓝 / 粉青渐变。
- 页面整体恢复原先温暖的淡粉、浅红渐变背景，不用 A 原型的纯平灰白背景。

### 页脚

- 保留专业产品式深色页脚与真实链接。
- 继续使用“保留你的个性。练清楚你的表达。”
- 不加入虚假的备案号、用户数量、合作品牌、客户证言或商业承诺。

## 5. 当前代码实现

首页融合主要涉及：

- `index.html`：正式首页结构替换为 A 融合版。
- `home-fusion.css`：首页专属构图、响应式、训练层悬停及单句窗口样式。
- `home-fusion.js`：一次性配置迁移、头部 Logo 移动、语言切换。
- `launcher-transcript.js`：单句 / 多句展示、Magic UI 连续滚动、Gooey 悬停改写、面板步进。
- `vertical-marquee-config.js`：单句模式、英文示例及滚动配置标准化。
- `launcher-text-effects.js`：True Focus 两行 / 一行布局适配。
- `control-panel.js`：Vertical Marquee 与 True Focus 的新增调控项、配置迁移和旧草稿备份。
- `creator-project-config.js`：当前 Founder 保存的首页默认参数。
- `docs/creator-pressure-config.json`：项目参数 JSON 对应更新。
- `locales/zh-CN.js`、`locales/en-US.js`：融合版文案。
- `scripts/package-web.js`：将 `home-fusion.css`、`home-fusion.js` 纳入网页发布包。
- `tests/home-fusion.test.js`：非视觉契约测试。

当前工作树状态：

```text
 M control-panel.js
 M creator-project-config.js
 M docs/creator-pressure-config.json
 M docs/roadmap/2026-09-next-stage.md
 M index.html
 M launcher-text-effects.js
 M launcher-transcript.js
 M locales/en-US.js
 M locales/zh-CN.js
 M scripts/package-web.js
 M vertical-marquee-config.js
?? docs/design/
?? docs/roadmap/2026-09-05-execution-plan.md
?? docs/work-orders/
?? home-fusion.css
?? home-fusion.js
?? tests/home-fusion.test.js
```

以上改动应整体保留。`creator-project-config.js` 与 `docs/creator-pressure-config.json` 包含 Founder 当前调定参数，不能用默认配置覆盖。

## 6. 最新一次修正：连续滚动

此前错误实现将单句模式做成：停留约 3 秒 → 360ms 快速退出 → 420ms 快速进入。它绕过了 `scrollDuration`，因此 Founder 愘觉像“快速上滑”，也无法真正调速。

2026-09-06 已改为：

- 单句窗口重新使用 `vendor/magic-ui/marquee.js` 的连续线性滚动。
- 每条句子按展示窗口高度形成一个连续槽位。
- `scrollDuration` 重新直接控制 CSS 动画 `--duration`。
- 保留边缘渐隐、悬停暂停、Gooey 改写与调控板上一句 / 下一句预览。
- 从调控板删除误导性的 `cycleMs` 输入。

完成的非视觉检查：

```powershell
npm run check --if-present
node tests\home-fusion.test.js
git diff --check
```

结果：语法检查通过；首页融合测试通过；未发现空白错误。测试输出为：

```text
PASS home fusion: migration, controls, locale, continuous engine, speed binding and manual mode (not visual QA)
```

这只证明代码契约，不证明滚动节奏、裁切和视觉观感已经符合 Founder 预期。

## 7. 新会话的第一项工作：Founder 人工验收

优先打开：

`http://127.0.0.1:8766/index.html`

如果本地服务已停止，可在项目目录外或 PowerShell 中重新启动：

```powershell
& 'C:\Users\31214\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 8766 --bind 127.0.0.1 --directory 'C:\Vibe coding program\expression-trainer-vertical-prototypes'
```

Founder 最短验收清单：

1. 刷新首页，确认主标题 True Focus 跨两行自然移动，没有被重置为 A 原型的静态标题。
2. 观察右侧单句窗口至少一轮：文字应连续匀速向上流动，不应停住后突然换页。
3. 调整“调控板 → Vertical Marquee → 一组循环时长”：改大明显变慢，改小明显变快；当前默认 26000ms。
4. 鼠标移入句子：滚动暂停，原句液化为优化句；移出后回到原句并继续。
5. 确认上下渐隐只作用于文字，没有额外底色或卡片感。
6. 在调控板切换“单句窗口 / 多句连续流”，确认能双向切回且不会卡死。
7. 切换中英文，确认副标题、训练卡与示例句都存在，英文长文本没有破坏布局。
8. 看一次 390px 左右窄屏：首页无横向溢出，主任务与 V1 入口仍清楚。

若 Founder 不满意，下一次修改只围绕实际反馈处理，优先调：槽位高度、窗口高度、句间距、循环时长、遮罩范围。不要再次改回定时轮播。

## 8. 验收通过后的收尾动作

只有 Founder 明确说首页验收通过后再执行：

1. 更新本交接报告和 `docs/design/home-next/delivery.md` 的状态，说明方案 A 融合版已采用。
2. 重新检查完整差异，重点确认没有覆盖用户参数或混入临时文件。
3. 至少运行：

   ```powershell
   npm run check
   node tests\home-fusion.test.js
   npm test
   git diff --check
   ```

4. 向 Founder报告拟提交文件和风险。
5. 只有收到“提交 / 推送 GitHub”授权后才提交或推送。部署 Cloudflare 也要单独确认，不把 Git 推送自动等同于已通过线上验收。

## 9. 下一大版本主线（首页收尾之后）

当前产品主线已确定为：

1. V2 判断事件与时间轴。
2. 模拟观众兴趣趋势右侧栏。
3. 关键句解释、证据定位与同题复盘。
4. 数字观众状态由同一判断事件驱动。
5. 真实训练演示回填首页，小范围传播验证。

详细执行工单：

- `docs/work-orders/TKT-V2-001.md`
- `docs/roadmap/2026-09-05-execution-plan.md`

注意：这些文档中关于“首页方案尚未执行”的描述已经过时。本报告是 2026-09-06 的最新首页状态；V2 工单的产品边界仍有效。

数字人 / 数字观众阶段可以先做本地规则、事件、复盘和免费展示原型，但以下事项仍是停止门：新增付费服务、持续 GPU、商业数字人供应商、音视频离开本地、供应商锁定或开源 / 商用许可不清。发生这些情况必须先由 Founder 决定成本、隐私与赞助方案。

## 10. 可直接粘贴给新会话的首条指令

> 请先完整阅读 `C:\Vibe coding program\expression-trainer-vertical-prototypes\docs\handoff\2026-09-06-homepage-fusion-handoff.md`，再检查该仓库当前未提交改动。不要 reset、checkout、清理或覆盖任何现有文件。当前首要任务是协助我人工验收方案 A 的正式首页融合版，特别是右侧 Vertical Marquee 是否已经恢复为连续、匀速、可用 `scrollDuration` 调速的单句流，并保留悬停暂停与 Gooey 原句改写。自动检查不能替代我的视觉验收；我反馈问题后只做针对性修改。验收通过前不要提交、推送或部署。首页收尾后，再以 `docs/work-orders/TKT-V2-001.md` 为下一大版本主线。
