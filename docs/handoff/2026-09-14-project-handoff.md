# Read Yourself 项目交接报告

日期：2026-09-14  
用途：在新的 Codex 会话继续默认二维观众、Live2D 本机导入与 LiveTalking 分轨开发。  
本报告承接 `2026-09-09-project-handoff.md`，以本次磁盘、Git、线上配置和 Founder 决议为准。

## 0. 新会话直接粘贴这段

```text
继续 Read Yourself / Expression Trainer · Creator Pressure 项目。

主仓库：C:\Vibe coding program\expression-trainer-vertical-prototypes
分支：main
远端：https://github.com/chujiachen167-ui/expression-trainer-creator-pressure.git
正式网站：https://read-yourself.com

先完整阅读：
1. docs/handoff/2026-09-14-project-handoff.md
2. .better-web-ui.md
3. docs/v2/judgment-contract.md
4. docs/avatar/live2d.md
5. docs/avatar/livetalking.md
6. docs/delivery/TKT-V2-003-remediation-report.md
7. docs/delivery/TKT-V2-004-live2d-entry-correction.md

先运行 git status --short --branch、git diff --stat、git log -3 --oneline。工作区仍有整批未提交的 V2/Live2D 修复，禁止 reset、checkout、clean 或覆盖。

Founder 最新决议：
- 用可爱、会眨眼和形变的 GrokBot 风格二维角色替换僵硬白色四态脸，作为网页和本机的官方默认观众。
- 本机用户可以改用自己导入的 Live2D；模型只留在本机，不上传。
- LiveTalking 真人数字人是另一条主动选择的轨道；不是 Live2D 的高级版，不在训练中突然闯入。
- B 模式继续静音：只用表情、姿态和文字表达兴趣，不做 TTS、不追问、不打断。

开工前先核对 Founder 看到的具体开源仓库链接。当前最匹配候选是 https://github.com/Coiggahou2002/grokbot-web ，它是 nasawz/GrokBot 的 TypeScript/Canvas 端口；两者当前均标注 BSD-3-Clause，不是 MIT，也不是 xAI 官方直接发布。若 Founder 指的是其他 MIT 项目，改用其准确链接并重新核验 LICENSE、版权声明和商标边界。

不要直接把 Grok 名称、Logo 或 xAI 品牌写进 Read Yourself。保留上游许可证与版权声明，用 Read Yourself 自己的角色名称、颜色和状态语义。
```

## 1. 当前已发布基线

| 项目 | 状态 |
|---|---|
| 本次参数提交 | `e2bcfe7 Publish latest founder visual settings` |
| `main` / `origin/main` | 已推送并对齐到 `e2bcfe7`（创建本报告前） |
| 参数保存时间 | JS：`2026-09-14T05:04:31.676Z`；JSON：`2026-09-14T05:04:36.680Z` |
| 线上配置 | 已直接读取 `https://read-yourself.com/creator-project-config.js`，确认返回上述 JS 保存时间 |
| 本次发布范围 | 仅 `creator-project-config.js` 与 `docs/creator-pressure-config.json` |
| 未随本次发布 | V2 修复、Live2D 本机运行文件、Cubism SDK/样例、GrokBot 候选代码 |

本次新增参数包括：三个受众模板说明文字改为白色，以及 V2 左栏指定区域背景改为 `#ebcade`。线上已能读取这些新值；尚未代替 Founder 做逐页视觉验收。

## 2. Founder 最新产品边界

### 2.1 三种观众表现不是升级等级

1. **官方默认二维观众**
   - 网页版和本机版都可用，零 GPU、无需账号、无需用户导入。
   - 下一阶段用 GrokBot 风格的 Canvas 角色替换当前白色圆脸。
   - 它只承接 V2 已有判断事件，不自己决定分数。
2. **用户本地 Live2D**
   - 只在安装 GitHub 本机版后可导入本地模型文件夹。
   - 模型不上传；无后端、无账号、无创意工坊。
   - 官方默认 Live2D 仍处于本机验证阶段，不能作为公开网站已上线能力宣传。
3. **LiveTalking 真人数字人**
   - 用户在训练开始前主动选择形象/Provider，随后面对面 talking。
   - 与默认二维观众、Live2D 平行，不是压力事件，也不是所谓高级版。
   - 公开 HTTPS 网站仍缺 GPU、HTTPS、WebRTC/STUN/TURN、成本、隐私和商业模型许可方案。

### 2.2 B 模式行为保持不变

- 全程静音，不调用 TTS。
- 不追问、不插话、不抢占麦克风。
- 表情和兴趣曲线必须来自同一组可解释判断事件。
- 无证据时不随机改变兴趣分数；角色可眨眼、注视和轻微呼吸，但这些待机动作不能伪装成评价变化。

## 3. GrokBot 风格角色的开源核验

### 3.1 当前找到的最匹配来源

- Flutter 原项目：`https://github.com/nasawz/GrokBot`
  - 25 种表情、18 种外形、39 种状态。
  - Flutter `CustomPaint` 实现。
  - GitHub 当前显示 BSD-3-Clause。
- Web 端口：`https://github.com/Coiggahou2002/grokbot-web`
  - TypeScript + Canvas 2D，零运行时依赖，适合现有原生 HTML/CSS/JS 栈。
  - 明确说明表情点集、外形、状态池和动画数学来自上游。
  - 当前同样是 BSD-3-Clause，并要求保留上游版权声明。

结论：可以作为技术候选，但不能写成“xAI 官方以 MIT 开源”。开源代码许可也不自动授予 Grok/xAI 商标使用权。Read Yourself 应使用自己的名称、配色和角色叙事。

### 3.2 建议接入方式

- 不迁移整站到 Flutter、React 或新的前端框架。
- 优先以固定版本 vendoring 或可审计浏览器构建接入 Web 端口，并加入：
  - 上游 `LICENSE` 和版权声明；
  - 固定来源仓库与 commit；
  - `THIRD_PARTY_NOTICES.md` 条目；
  - 独立 `ReadYourselfAudienceAvatar` 适配层。
- 保留现有 `CreatorAudienceStage.applyEvent(tile, event)` 入口，使表现层可随时替换。
- 建议状态映射先做小而确定的一组：
  - `listen` → `listening`
  - `confused` → `confused`
  - `interest` → `curious` 或 `excited`
  - `drop` → `bored` 或 `drowsy`
- 评价状态不启用随机自动换表情；仅允许眨眼、视线和轻微待机动作。最终表情由 Founder 视觉验收拍板。

## 4. 当前未提交工作必须保留

`e2bcfe7` 之外，主工作区仍有一批未提交的 V2 修复和本机 Live2D 工作。主要内容：

- V2 静音观众、兴趣曲线证据事件、去重反馈。
- V1 诊断核心、粘贴逐字稿和优化台词稿迁入 V2。
- 左侧独立、常驻的“数字观众形象”入口。
- 本机 Live2D 模型文件夹验证、导入、运行适配器和 Electron IPC。
- LiveTalking Provider 边界与连接探测。
- 页面离开/bfcache 后覆盖层恢复修复。
- 对应测试、研究、工单和交付报告。

特别注意：

- `local-runtime/` 含开发者本人获准下载的 Cubism SDK、本机 bridge 和官方样例，仅用于本地验证；不得误加入 Git 或网页包。
- `.codex_tmp/` 含学校材料生成过程和浏览器缓存，不属于产品发布。
- `docs/school-materials/` 是学校创业申请材料，与产品代码提交应分开。
- `BingSiteAuth.xml` 等既有未提交差异不要擅自重写或删除。

## 5. 本轮验证证据

### 参数提交的精确版本 `e2bcfe7`

- `node --check creator-project-config.js`：PASS。
- 项目配置、全局保存、正式运行配置、网页打包相关 5 项测试：5/5 PASS。
- `npm run package:web`：PASS，网页包生成成功。
- `git diff --check`：PASS。
- 以上在 detached 验证工作树中针对 `e2bcfe7` 执行，未混入主工作区的 V2 脏改动。

### 当前主工作区

- `npm test`：PASS。
- `npm run package:web`：PASS。
- 该结果覆盖当前磁盘上的 V2/Live2D 工作，但自动 DOM/契约测试不能替代真实浏览器、视觉、麦克风、Live2D 模型和 GPU/WebRTC 验收。

## 6. 下一会话执行顺序

1. 重新读取 Git 状态，确认 `e2bcfe7` 已在远端，未提交 V2/Live2D 文件仍完整。
2. 让 Founder 提供其看到的准确 GrokBot 表情仓库链接；若即为 `grokbot-web`，记录固定 commit 与 BSD-3-Clause 归属后继续。
3. 只替换默认二维观众表现层，不改 `v2-rule-judge.js` 的评分语义，不动兴趣曲线算法。
4. 增加角色适配器和四态映射；保留现有白脸作为暂时技术降级层，验收通过后再决定是否删除。
5. 跑定向单测、全量 `npm test`、`npm run check`、`npm run package:web`、`git diff --check`。
6. 给 Founder 一张短而详细的人工验收清单，至少覆盖：默认角色、四态映射、静音不打断、Live2D 切换、失败降级、网页版不暴露本地 SDK。
7. Founder 验收后再单独决定是否提交、推送和部署角色替换；不要因为本轮参数已上线而推断新角色也获准上线。

## 7. 不得误报

- 当前公开网站的新参数已上线，但 GrokBot 风格角色尚未接入。
- 当前白色圆脸仍是兼容表现层，不是 Live2D。
- Hiyori 成功冒烟只证明本机适配链路，不证明任意用户模型都兼容。
- LiveTalking 仍没有公开 HTTPS GPU 生产服务。
- “自动回归通过”不等于 Founder 已完成人工验收。

