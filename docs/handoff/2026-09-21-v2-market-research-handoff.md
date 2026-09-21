# Read Yourself · 市场调研交接报告

日期：2026-09-21  
作者：工程执行（Grok）  
用途：把调研分支上的三份文档收成一份可直接阅读的交接材料，供 CEO / Founder / 学校交流使用。  
性质：桌面研究整理。不把网页搜索、产品宣传或政策文本当作已验证的付费需求。不授权提交、推送或部署。

---

## 0. 完整路径（复制即用）

仓库根目录：

```text
C:\Vibe coding program\expression-trainer-vertical-prototypes
```

你刚才打开的 Git 日志目录（只记录分支指针，不是调研正文）：

```text
C:\Vibe coding program\expression-trainer-vertical-prototypes\.git\logs\refs\heads\research
C:\Vibe coding program\expression-trainer-vertical-prototypes\.git\logs\refs\heads\research\v2-market-position
```

调研正文所在 Git 分支：

```text
research/v2-market-position
提交：305248e  Record V2 market position and uniqueness research.
状态：仅本地，未推送远端
```

调研正文在该分支里的三个文件（当前 `main` 工作区没有这些文件）：

```text
C:\Vibe coding program\expression-trainer-vertical-prototypes\docs\research\2026-09-21-read-yourself-market-and-shanghai-ecosystem-research.md
C:\Vibe coding program\expression-trainer-vertical-prototypes\docs\research\2026-09-21-v2-position-and-uniqueness.md
C:\Vibe coding program\expression-trainer-vertical-prototypes\docs\research\2026-09-10-v2-remediation-open-source-review.md
```

本交接报告（当前这份，已写在 `main` 工作区，未提交）：

```text
C:\Vibe coding program\expression-trainer-vertical-prototypes\docs\handoff\2026-09-21-v2-market-research-handoff.md
```

同日相关交接：

```text
C:\Vibe coding program\expression-trainer-vertical-prototypes\docs\handoff\2026-09-21-daily-report-for-ceo.md
C:\Vibe coding program\expression-trainer-vertical-prototypes\docs\handoff\2026-09-21-ceo-post-acceptance-gap-review.md
```

---

## 1. 怎么打开（资源管理器 / 终端 / 编辑器）

当前工作区在 `main`，且有大量未提交改动。**不要** `git checkout research/v2-market-position`，会和脏工作区打架。用下面方式读原文。

### 1.1 打开资源管理器窗口

PowerShell 或 CMD 里直接粘贴：

```powershell
explorer "C:\Vibe coding program\expression-trainer-vertical-prototypes\docs\handoff"
```

打开 Git 日志目录（你刚才那个路径）：

```powershell
explorer "C:\Vibe coding program\expression-trainer-vertical-prototypes\.git\logs\refs\heads\research"
```

打开仓库根目录：

```powershell
explorer "C:\Vibe coding program\expression-trainer-vertical-prototypes"
```

### 1.2 用记事本打开本报告

```powershell
notepad "C:\Vibe coding program\expression-trainer-vertical-prototypes\docs\handoff\2026-09-21-v2-market-research-handoff.md"
```

### 1.3 在终端里读调研分支上的原文（不切换分支）

先进入仓库：

```powershell
cd "C:\Vibe coding program\expression-trainer-vertical-prototypes"
```

看分支和提交：

```powershell
git branch --list "research/*"
git log -1 --format=full research/v2-market-position
git ls-tree -r --name-only research/v2-market-position -- docs/research
```

把三份原文打印到终端：

```powershell
git show research/v2-market-position:docs/research/2026-09-21-read-yourself-market-and-shanghai-ecosystem-research.md
git show research/v2-market-position:docs/research/2026-09-21-v2-position-and-uniqueness.md
git show research/v2-market-position:docs/research/2026-09-10-v2-remediation-open-source-review.md
```

导出到桌面再双击打开（仍不切换分支）：

```powershell
git show research/v2-market-position:docs/research/2026-09-21-read-yourself-market-and-shanghai-ecosystem-research.md | Out-File -Encoding utf8 "$env:USERPROFILE\Desktop\read-yourself-market.md"
notepad "$env:USERPROFILE\Desktop\read-yourself-market.md"
```

用 VS Code / Cursor 打开仓库并定位本报告：

```powershell
code "C:\Vibe coding program\expression-trainer-vertical-prototypes\docs\handoff\2026-09-21-v2-market-research-handoff.md"
```

### 1.4 那个 `.git\logs\...` 路径里实际有什么

只有 Git reflog 文本，一行一条指针变化。当前内容是：

1. 从 `HEAD` 创建分支 `research/v2-market-position`
2. 提交 `305248e`：`Record V2 market position and uniqueness research.`

它不是对话记录，也不是调研正文。调研正文在 Git 对象里，路径见第 0 节。

---

## 2. 一页结论

1. **赛道真实存在，竞争也真实存在。** 海外 Orai、Yoodli，国内 UMU uShow、微演说，都已经把「录制/练习 → 自动分析 → 具体反馈 → 再练」做成产品。用户愿意用表达训练工具；Read Yourself 不能只靠「有转写、能抓口头禅」当卖点。
2. **当前最值得验证的切口：** 面向中文镜头口播新手、学生和知识分享者的低压力镜头表达训练。用户独自完整讲完后，得到可解释的文字诊断、逐字稿优化，以及静音数字观众对节奏的可见反应。
3. **产品能立住，靠的是卖另一件事。** 市面主流是判决工具：粘贴文案打钩子分、上传成片预测留存、拆竞品再润色。它们服务「发之前 / 发之后 / 拆别人」。Read Yourself 卖的是排练房：在明确受众面前开口练，看见是哪一句让人听懂、相信、愿意继续看，然后同题再练。
4. **目前没有充分证据证明用户会付费。** 已有可运行原型、目标用户定义、类别验证和竞品扫描。还缺 10–20 名目标用户访谈、连续复练数据和真实付费意愿。对外不要说「已有市场验证」。
5. **上海短期最可行的不是找大公司战略合作或 VC。** 先走学校孵化：场地、导师、首批测试者、企业登记支持。对外合作的第一个可交付物是 2–4 周、10–30 人的试用试点。融资可以准备材料，但不能当成项目存活前提。

---

## 3. 产品边界（调研对象是什么）

当前核心链路：

```text
选题或粘贴逐字稿 → 对镜头练习 → 本地/浏览器转写 → 口头禅、重复、模糊表达等诊断 → 改稿 → 再练 → 对比变化
```

数字观众是**静音的可见反馈层**：用表情、姿态、文字和兴趣曲线表现「观众是否跟得上」。不做 TTS，不追问，不打断。网页默认二维观众；本机版后续可导入用户自己的 Live2D。真人数字人是独立、主动选择的未来路线，不能包装成当前公开网站已交付能力。

这一定义排除三类产品：

- 替你生成口播视频的 AIGC 内容生产工具
- 「你一句、AI 一句」的模拟面试或英语陪练
- 依据面部外貌、人格或情绪给人打分的产品

---

## 4. 市场上已经有的路

### 4.1 表达训练类（证明类别成立）

| 代表 | 主目标与做法 | 可学习 | 不要直接复制 |
|---|---|---|---|
| Orai | 个人演讲练习；填充词、语速、清晰度、能量、长期趋势；官网自称 50 万+ 下载 | 每次练完给一条可执行的下一步；趋势比一次总分重要 | 大而全课程库；把「自信」做成不可解释的分数 |
| Yoodli | 企业沟通；角色扮演、组织自定义标准、即时反馈 | 若未来做 B2B，从一个具体岗位或课程标准开始 | 当前就加入会对话、会追问的 AI 角色 |
| UMU uShow | 企业销售培训；按业务场景和标准话术评分 | 商业化时卖「明确场景的练习闭环」 | 现在就进入销售组织、知识库、管理后台 |
| 微演说 / PitchLab | 面试、演讲、路演或口播；多维报告和陪练 | 中文用户期待场景化入口和直观报告 | 夸大「像真人教练」「像素级诊断」 |

这些信号说明「表达练习 + 自动反馈」是可被独立产品承载的需求类别。它们不能直接推导中国用户数量、留存或付费意愿。

### 4.2 创作者判决工具（Read Yourself 拼不过的路）

HookScorer、Retensis、vidIQ、OpusClip，以及国内运营箱、爆款拉片，共同动作是：把文案或成片丢进去，吐一个分数、一条预测留存曲线、三句改写。用户用一次就走。

拆竞品工具转写别人的口播，用模型总结钩子和结构。服务的是持续更新的内容团队，不是还不敢面对镜头的人。

这些路的共同承诺是「我比你更懂算法」。公开事实是：抖音、快手、小红书、YouTube 的推荐公式外部拿不到。谁把曲线写成真实播放量，谁就是在骗用户。

**走偏信号：** 主承诺变成「预测完播 / 拿捏推荐」。  
**走正信号：** 主承诺是「对着这类观众把这题说清楚，下一轮能指出自己改了哪一句」。

### 4.3 建议的定位语（供测试，不是最终广告语）

> Read Yourself 是给中文口播新手的镜头表达训练工具：先完整讲完，再看见哪些地方让听众失去兴趣；改一处，再练一遍。

可检验点是「完整讲完」「可解释反馈」「再练一遍」。用户不在意其中任何一个，就应调整产品，而不是靠视觉包装硬撑。

---

## 5. 独特性（非技术，待验证假设）

1. **对象是人，不是推荐系统。** 用户面对快划者、怀疑者、零基础者，每次反应必须能指回原句。平台只作为这类观众的习惯教材，不当神谕。
2. **时间是正在说，不是发之前或发之后。** 拥有开口当时的陪伴，才有复购：不是再买一次分数，而是再练一轮。
3. **低压力而非高压问答。** 用户可完整表达；数字观众只可视化兴趣变化，不插话。更适合建立初学者的练习习惯。
4. **诊断、改稿、再练在同一个闭环中。** 用户不必在提词器、转写、AI 写稿和录制工具间来回切换。
5. **默认本地优先。** 摄像头画面与本地模型不默认上传；对需要反复练习、又不愿留下视频资料的人，可能是信任点。
6. **诚实当产品。** 能兑付的希望是「发出去的第一条不再是蒙的」，不是「练完就能爆」。上瘾点是「这一句太宽，他走了；换成具体信息，他停了」，不是 58 分变 63 分。
7. **路径停在第一批可发布口播。** 不做达人运营、MCN、全创作者分析平台。

可替换观众表现（默认二维 / 本机 Live2D）是体验差异，在缺少使用数据前不要当成核心商业价值。

---

## 6. 需求判断：有什么证据，缺什么证据

### 已有外部信号能说明什么

- Orai 证明「表达练习 + 自动反馈」可以做成独立产品；不能直接推导中国用户数量或付费。
- Yoodli 证明企业愿意为可标准化的沟通训练探索工具；Read Yourself 尚无企业销售案例。
- UMU uShow 证明国内 B2B 表达训练不是空白市场；UMU 是成熟强对手。
- 微演说、PitchLab 证明中文表达训练的用户语言和使用场景已被产品化；获客规模和实际效果尚未独立核验。
- CNNIC 第 56 次报告（截至 2025 年 6 月中国网民 11.23 亿，生成式 AI 已深入内容创作）只说明基础环境成熟，不能代替「镜头表达训练」的市场规模。

### 当前最重要的缺口

「有人需要表达训练」不等于「他们会持续使用 Read Yourself」。在有正式访谈和试用记录前，以下问题都没有答案：

1. 用户最痛的是面对镜头卡壳、改稿、口头禅，还是害怕「被看着讲」？
2. 数字观众是降低练习孤独感、增加复练动力，还是造成干扰？
3. 用户觉得哪一条反馈可信，哪一条像机械打分？
4. 一次练习后，会不会在一周内主动回来练第二次？
5. 最先愿意付钱的是一次深度报告、月度练习、课程/社群包，还是根本不愿付费？

---

## 7. 开源复盘对产品边界的约束（2026-09-10）

没有找到可直接替代当前 V2 判断器、同时满足「实时逐字稿输入 + 指定假想观众 + 输出可解释兴趣曲线」的成熟开源库。现有项目分成三类：真实观众表情识别、公开表达客观指标、公开表达文本风格评分。V2 应复用后两类的算法结构，不把真实观众视觉模型误称为内容兴趣预测。

| 项目 | 许可 | 可借鉴 | 不直接整套接入的原因 |
|---|---|---|---|
| Converser | MIT | 按时间窗计算语速、停顿、填充词、音高与置信度趋势 | Python/音频后处理栈较重；指标不是指定假想观众的内容兴趣 |
| iamspeaker | MIT | 本地优先；measure → prescribe → re-practice；按 take 比较客观指标 | 含 TTS、Ollama 和完整演讲工作台，整套引入会扩大范围 |
| PSST | MIT | 把公开表达拆成互动性、情绪性、生动性、口语性 | 训练/评估模型较重，面向英文长文本风格迁移 |
| DAiSEE | MIT（实现仓库） | 「投入 / 无聊 / 困惑 / 挫败」状态定义 | 输入是真实观看者视频和面部；会反转数据方向并增加隐私与算力负担 |
| pixi-live2d-display | MIT（库；Cubism Core 与模型另受 Live2D 约束） | 从目录发现 `.model3.json` 并建立本地 URL 映射 | 项目已用官方 Cubism Framework bridge；换渲染栈会重复引入 Pixi |

本轮采用：

1. 兴趣轨迹用 Converser 的「真实时间窗 / 片段」结构，不再把整篇累积文本重复打分。
2. 内容维度参考 PSST 的分解，但继续用本项目可解释的受众规则：快划观众看开场价值、对象相关性、新信息密度；零基础观众看术语可理解性、例子、结构；怀疑型观众看可核对依据、具体性、代价与边界。
3. 每类受众必须同时存在正向与负向证据；分数只在新证据出现时变化。没有新证据时保持水平，标为「暂无新证据」，不加随机抖动。
4. B 模式只把判断事件映射为观众形象的表情状态，不触发 TTS，不参与轮流对话，也不暂停 STT。
5. 诊断与台词优化直接复用仓库现有 V1 Diagnostic Core。
6. 本地 Live2D 继续沿用官方 Cubism Framework bridge。

这里产出的是「相对模拟兴趣」，不是实际观看率、平台留存率或心理测量。

---

## 8. 上海：合作、孵化与融资的现实路径

### P0 · 现在就可做：学校孵化 + 封闭试点

最优先对象：上海第二工业大学「智创天地」及校内课程、社团、就业/创新创业部门。第一次请求应具体为：

- 提供 10–20 名愿意匿名测试的学生或创作者
- 提供一间可用于 30 分钟单人镜头练习的安静空间
- 允许做 2–4 周封闭试点，产出匿名汇总数据和改进报告
- 协助确认公司登记住所、导师与校内展示机会

这比「希望学校支持我们的创业项目」更容易得到可执行答复，也不涉及学校替产品背书。

### 有材料后尝试：上海市大学生科技创业基金（天使基金）

官网显示截至 2026 年 8 月 31 日累计受理 17,821 个项目、资助 4,966 个项目；雏鹰计划最高 50 万元、雄鹰计划最高 80 万元。基本条件包括：中国国籍、创业企业自然人大股东兼法定代表人、全职创业、企业注册在上海且不超过三年；本科/大专申请人限应届毕业生。

楚佳辰处于毕业前一年，可能处在面向应届毕业生的窗口附近，但「全职投身创业」、公司登记及自筹资金等条件必须向基金会逐项确认。现阶段可以要申请模板、参加咨询和准备 BP。不要把「能申请」说成「已符合 / 一定能拿到」。

### 中期可观察：徐汇 AI 青年创业基金（青苗基金）与模速空间

青苗基金聚焦「投早、投小、投硬、投青年」，已有线上申请入口。模速空间面向大模型创新生态。方向与 AI 应用创业有关，竞争密度很高。进入条件应是：1 个清晰行业场景（例如「校园内容创作者镜头表达训练」）、连续使用数据、明确的本地隐私方案和可演示的效果。不要为迎合基金把项目硬改成「通用大模型平台」或承诺视觉打分。

### 生态入口，不等于客户合同

上海市人工智能行业协会适合在有初步数据后寻找活动、导师、政策和生态转介。加入协会不等于获得客户或融资。

小红书有面向第三方工具的一键分享开放能力。合理顺序是：先让 10–30 名目标用户实际练习，验证他们愿不愿意分享「改稿前后对比」或匿名练习成果；有明确分享行为和隐私方案后，再评估开放平台接入。现在不要为了「合作」上传录音录像或改变本地优先原则。

### 合作优先级

| 优先级 | 对象 | 不要说 | 第一次要的具体合作 | 成功标准 |
|---|---|---|---|---|
| P0 | 校内创业基地、课程、社团 | 「帮我们推广」 | 10–20 人封闭试用、场地、导师反馈 | 获得可用访谈记录与第二次练习数据 |
| P0 | 2 家小型 MCN、个人 IP 训练/内容工作室 | 「请战略合作/投资」 | 为 3–5 名新手创作者提供一周免费试用，换取观察与访谈 | 至少 2 人主动完成第二轮练习 |
| P1 | 企业销售培训/沟通训练机构 | 「我们比你们的培训更好」 | 共同定义一个 3 分钟产品讲解练习模板 | 确认他们愿意为哪种报告或组织管理功能付费 |
| P1 | 云/模型/语音服务商 | 「给我们投资或免费 API」 | 了解创业计划、技术支持与合规要求 | 获得明确申请条件或试用资源；不改变本地默认路径 |
| P2 | 模速空间、AI 协会、青苗基金 | 「我们是下一个平台」 | 递交一页材料，要求一次 20 分钟项目诊断/资源转介 | 进入活动、导师或申请流程；不以名片数量计成果 |

第一封邀请话术：

> 我们在做面向中文口播新手的镜头表达训练工具。用户完整讲完后，系统会标出重复、口头禅和模糊表达，并给出可改的一处建议；数字观众全程静音，不打断练习。我们正在寻找 3–5 位有镜头口播需求的新手，进行一周免费封闭试用，收集真实问题，不做公开传播。您是否愿意安排一次 20 分钟演示与需求访谈？

---

## 9. 四周用户验证：下一步必须拿到的证据

### 招募与分组

- 8 名：刚开始做口播/短视频/知识分享的学生或个人创作者
- 4 名：近期有课堂汇报、答辩或求职表达任务的学生
- 每人 30–45 分钟首次测试；愿意者在 7 天内再练一次

不要把朋友的礼貌夸奖计为验证。招募时说明：这是测试，不是课程；可以说不好用；录音录像默认不公开；研究记录匿名化。

### 单次测试流程

1. 让用户讲 90 秒「介绍一个自己熟悉的话题」，先不解释数字观众的意义。
2. 观察：是否能自行启动、是否愿意面对镜头、在哪里困惑或退出。
3. 看报告：让用户指出「最可信」「最没用」「最冒犯/干扰」的各一条反馈。
4. 只按一条建议改稿或重讲 60 秒。
5. 追问：如果下周还要讲同一件事，会不会再次打开？为什么？
6. 7 天后：问是否主动回访；没有回访也要记录原因。

### 首轮通过标准（可被推翻）

- 12 人中至少 9 人能独立完成一次练习
- 至少 7 人能准确复述一个自己准备修改的表达问题
- 至少 6 人认为数字观众没有打断且不会增加尴尬
- 至少 5 人在 7 天内自主完成第二次练习，或明确预约第二次
- 至少 3 人愿意为「持续记录与专项训练」留下可接受价格区间；口头愿意不算收入

任一关键指标明显失败，应先改问题定义/流程/反馈可信度，暂缓做 Live2D 商城、真人数字人、账号系统或复杂社群功能。

---

## 10. 融资：什么时候值得开口

### 现在可以做

- 递交学校孵化申请
- 向天使基金咨询资格、申请模板和材料要求
- 准备 6 页以内的项目材料：问题、目标用户、产品演示、竞品、初步数据、未来 6 个月用途
- 用自筹的小额预算完成第一轮测试，而不是先为融资堆算力或数字人服务

### 拿到这些证据后再集中找资金

1. 20+ 名目标用户的结构化访谈与试用记录
2. 至少一组可复现的前后对比（同一人两次练习中，自己认可的重复/模糊表达减少）
3. 7 日复练率和失败原因
4. 一个愿意共同试点的学校部门、社团、MCN 或训练机构
5. 明确的成本边界：本地优先，不把默认训练做成持续 GPU / 真人数字人消耗

投资人投的是「团队已经找对一类人，并证明他们会反复回来」，不是「页面已经能跑」。

---

## 11. 老师问起时的诚实表述

> 我们已经完成第一轮桌面调研：确认国内外已有 AI 表达训练产品，说明需求类别成立；同时梳理出 Read Yourself 不做 AI 打断式陪练，而是服务中文镜头口播新手的低压力复练闭环。我们目前不把它称为完成市场验证，因为还缺首批用户的连续使用数据。下一步会在学校孵化场景内完成 12 人封闭试点，拿到复练率、反馈可信度和具体场景需求后，再申请天使基金、上海 AI 创业营和外部合作。

---

## 12. 本轮调研后的决策

**应继续建设：** 可解释的诊断、逐字稿优化、练后复盘、前后对比、静音观众的可信反馈。把「原因」做成上瘾点。平台只作为观众习惯的教材，课与课不要合成一个全网流量分。

**应暂停扩张：** TTS 插话、默认真人数字人、账号/社区/创意工坊、云端上传路径、为融资而堆砌「大模型平台」叙事、把 V2 做成平台推荐预测器。

**下一次决策点：** 12 人封闭试点完成后，依据复练率和访谈原话决定继续做个人创作者、转向校园表达训练，或调整数字观众的产品位置。

---

## 13. 建议 CEO 和 Founder 拍板的问题

1. V2 对外主承诺，用「排练房 / 对着具体观众练口播」，还是继续强化「兴趣曲线接近平台机制」？调研结论支持前者。
2. 兴趣分是否保持「可复核的文案规则」，还是要上更像 SaaS 的预测曲线（即便仍写免责声明）？
3. 调研分支 `research/v2-market-position` 要不要推到远端，供 CEO / 学校直接读原文？当前仅本地。
4. 四周 12 人封闭试点是否作为下一阶段最高优先级，压过 Live2D 商城、真人数字人和账号系统？

---

## 14. 资料来源与使用边界

以下均为桌面研究引用。产品宣传数字不当作中国市场规模证据；政策资格以主管部门当前答复为准。

- [Orai 官方网站](https://orai.com/)
- [Yoodli 官方反馈页面](https://example.yoodli.ai/platform/ai-feedback) 与 [Yoodli 官方概览](https://support.yoodli.ai/en/articles/9550461-yoodli-overview)
- [UMU uShow 官方页面](https://app.umucdn.cn/product/u-show)
- [微演说 App Store 页面](https://apps.apple.com/cn/app/%E5%BE%AE%E6%BC%94%E8%AF%B4-%E4%BB%8E%E8%84%91%E5%9B%BE%E5%88%B0%E5%8F%A3%E7%A7%80-%E4%BD%A0%E5%8F%A3%E8%A2%8B%E9%87%8C%E7%9A%84%E6%BC%94%E8%AF%B4%E6%95%99%E7%BB%83/id6467851710) 与 [PitchLab 官网](https://pitchlab.pro/)
- [CNNIC 第 56 次中国互联网络发展状况统计报告](https://www.cnnic.cn/n4/2025/0721/c88-11328.html)
- [上海创业扶持政策](https://www.shanghai.gov.cn/202308bmgfxwj/20230504/ee335ef455a04111ab3684cc1e991220.html)
- [上海市大学生科技创业基金（天使基金）](https://fund.stefg.org/AngelFund/Default.aspx) 与 [申请条件说明](https://www.stefg.org/Angel/Intro.aspx)
- [徐汇 AI 青年创业基金（青苗基金）](https://www.qingmiaoxhkct.com/) 与 [徐汇区 2026 创业营公开信息](https://www.shanghai.gov.cn/nw15343/20260817/d36915b2420e42baa7d6bb18aab5b85c.html)
- [模速空间](https://www.opensmc.com/) 与 [上海市人工智能行业协会](https://sh-aia.com/dynamics/detail524.htm)
- [小红书分享开放平台](https://agora.xiaohongshu.com/)

原文出处（Git 分支，未合入 `main`）：

- `research/v2-market-position:docs/research/2026-09-21-read-yourself-market-and-shanghai-ecosystem-research.md`
- `research/v2-market-position:docs/research/2026-09-21-v2-position-and-uniqueness.md`
- `research/v2-market-position:docs/research/2026-09-10-v2-remediation-open-source-review.md`
