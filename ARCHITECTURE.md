# Expression Trainer · Creator Pressure 架构

## 架构目标

在不破坏现有“离线语音转写 + 中文表达分析 + AI 报告”能力的前提下，加入摄像头、数字观众行为和自媒体实战场景。

产品能力始终围绕一个问题：自媒体新手能否面对镜头，把内容讲得自然、紧凑、具体并值得继续观看？

## 建议模块

```text
Electron Renderer
├── Creator Studio UI
│   ├── Camera Preview
│   ├── Camera Target Guide
│   ├── Audience Tiles
│   ├── Live Transcript
│   └── Session State / Loading UI
├── Training Session Controller
│   ├── Scenario Engine
│   ├── Audience Template Resolver
│   ├── Audience Simulation Engine
│   ├── Pressure Policy
│   └── Event Timeline
├── Observation Engine
│   ├── Existing Lexicon Analysis
│   ├── Repetition / Density
│   ├── Opening Latency
│   └── Pressure Recovery
└── Debrief Composer
    ├── Evidence Moments
    ├── One Priority Problem
    └── Same-task Retry

Avatar Gateway
├── Browser Demo Provider（无后端验收）
└── LiveTalking Provider
    ├── WebRTC /offer
    ├── Text Driver /human
    └── Interrupt /interrupt_talk

Electron Main Process
├── Existing Sherpa-ONNX STT
├── Existing Model Provider Adapter
├── Session Persistence
└── Privacy / Permission Boundary
```

## 现有能力的处理原则

| 现有能力 | 处理方式 |
|---|---|
| 离线语音识别 | 保留，继续作为默认转写通道 |
| 中文情感与表达词库 | 保留，作为表达观察信号之一 |
| 每 50 字实时 AI 反馈 | 改为静默记录；压力训练期间只由数字观众产生必要追问 |
| 完整分析报告 | 保留，但压缩成“证据片段 + 一个问题 + 下一轮动作” |
| Electron 桌面端 | 保留，摄像头通过渲染进程 `getUserMedia` 接入 |
| 多模型后端 | 保留，用于观众追问和结束复盘 |

## 摄像头边界

V1 只提供真实摄像头预览和镜头位置提示，不在没有视觉模型的情况下声称已经识别视线。

后续若加入镜头注视估计，应满足：

- 本地推理优先。
- 默认不保存视频。
- 明确区分“看屏幕”“看摄像头”和“无法判断”。
- 不进行颜值、情绪、人格或可信度评分。
- 报告只评价与内容创作直接相关的可观察行为。

## 受众模板与行为模型

模板先定义内容领域、平台、目标和目标受众；每个受众角色再包含身份、观看动机、关注点、触发条件、可执行反应和禁止行为。模板不包含固定台词。

示例：

```text
角色：快划用户
观看动机：快速判断视频是否值得继续看
关注点：前十秒是否出现明确价值
触发条件：铺垫超过十秒或连续出现模糊词
反应：要求先说结论，或表现出准备划走
禁止行为：询问求职经历、进行通用陪聊、羞辱创作者
```

## 三版实施顺序与验收门槛

### V1 镜头基线

范围：摄像头开关、镜头位置提示、实时转写、基础表达指标和报告加载状态。

验收门槛：新手能完成一次 60 秒口播，并理解自己是否在对镜头说话、多久进入主题、最主要的一个表达问题是什么。

### V2 数字观众压力场

范围：单个数字观众、三级压力、针对口播内容的追问和自然基线对比。

验收门槛：数字观众至少能根据“铺垫过长、内容模糊、缺少例子”做出不同反应，并且不会跑到面试或泛聊天领域。

### V3 自媒体实战房间

范围：路人、老粉、怀疑型观众、品牌方；广告植入、热点观点、直播回应和知识口播；临时压缩、弹幕质疑和同题重练。

验收门槛：用户可以在同一任务上完成“初次表达 -> 压力反馈 -> 立即重练”，并看到内容效果改善，而不是只看到更多统计数字。

## 原型与正式实现的区别

当前原型可以验证布局、摄像头授权、浏览器语音转写、压力节奏和三版信息架构。数字观众反应暂时使用确定性脚本，避免把尚未接入的 AI 能力伪装成已实现。

正式接入现有项目时，优先把确定性触发规则保留为安全护栏，再用模型生成角色化措辞。模型只决定“如何说”，场景引擎决定“何时说、为什么说、允许说什么”。

数字形象只负责呈现受众反应。LiveTalking 通过可替换的 Avatar Provider 接入，不能直接访问训练报告、决定受众身份或生成领域外问题。
