# Expression Trainer · Creator Pressure 架构

## 架构结论

项目采用“一个诊断核心，三层创作者训练界面”的结构。上游 Expression Trainer 不再只是参考，而是桌面端技术底座；Creator Pressure 负责自媒体垂类的训练任务、摄像头、数字观众和复盘交互。

```text
Electron Main Process
├── Sherpa-ONNX bilingual offline STT
├── Expression lexicon and custom filler analysis
├── OpenAI / DeepSeek / Ollama / custom provider adapter
├── Settings and prompt persistence
└── IPC security and file export
             │ context-isolated preload API
             ▼
Creator Training Surfaces
├── Overview / version routing
├── V1 Camera Baseline
├── V2 Digital Audience Pressure
└── V3 Creator Practice Room
             │
             ├── Shared transcript and metric adapter
             ├── Audience template and pressure engine
             ├── Browser demo / LiveTalking avatar provider
             └── Session report and same-task retry
```

该边界记录在 [`docs/adr/0001-upstream-diagnostic-core.md`](docs/adr/0001-upstream-diagnostic-core.md)。

## 运行时分层

### Electron 桌面端（产品主路径）

- `main.js`：窗口、菜单、设置、离线 ASR、词库分析、模型调用和文件保存。
- `preload.js`：通过 `contextBridge` 暴露最小 IPC 接口；渲染进程不启用 Node.js。
- `lib/asr.js`：继承上游 Sherpa-ONNX 流式双语识别。
- `stt-audio.js`：把设备采样率统一转换为 16 kHz，并通过顺序队列保证 IPC 处理期间不丢音频帧。
- `lib/lexicon.js`：继承上游中文词库并增加训练规则中的自定义口癖词。
- `lib/ai-feedback.js`、`lib/prompts.js`：继承上游多供应商反馈与报告能力。
- `desktop/`：保留上游原始诊断、模型设置、提示词编辑和词库工具界面。

### 浏览器预览（降级路径）

没有 `window.api` 时，界面自动改用 Web Speech API 与浏览器本地分析。该路径用于 UI 和流程验收，不声明具备桌面端同等的离线能力、识别一致性或模型配置能力。

## 训练层职责

| 训练层 | 负责 | 不负责 |
|---|---|---|
| V1 | 摄像头、镜头提示、透明字幕、表达诊断、训练规则 | 未接视觉模型时不判断真实视线 |
| V2 | 受众模板、数字观众、压力节奏、内容相关追问 | 不扩张到面试、会议或泛聊天 |
| V3 | 广告、热点、直播、知识口播等自媒体任务 | 不把数字形象当作决策引擎 |

## 受众与数字人边界

受众模板先确定内容领域、平台、目标和观看动机，再由确定性策略根据开场、信息密度、模糊词、术语、例子、证据、风险边界和广告感触发反应。

模型未来只负责“如何措辞”；场景引擎决定“何时反应、为什么反应、允许反应什么”。LiveTalking 或其他数字人项目只负责把反应呈现出来，不能自行决定受众身份、读取完整报告或提出领域外问题。

## 原能力继承状态

| 上游能力 | 当前状态 |
|---|---|
| Electron 桌面运行时 | 已继承并接入三层总览 |
| Sherpa-ONNX 中英离线转写 | 已继承；模型需本地单独安装 |
| 中文表达与情感词库 | 已继承；增加自定义口癖词 |
| 实时 AI 反馈 | 已继承；未配置模型时使用本地诊断 |
| 完整 AI 报告 | 已继承并追加到 V1 本轮报告 |
| 多模型设置和连接测试 | 已继承；从 V1 左栏或应用菜单打开 |
| 提示词编辑器 | 已继承；与 V1 训练规则双向同步 |
| 原始诊断界面 | 作为“原始诊断模式”完整保留 |

## 安全、隐私与发布约束

- `contextIsolation` 和 renderer sandbox 开启，`nodeIntegration` 关闭。
- 摄像头只在渲染进程获得用户授权后预览，默认不落盘。
- ASR 音频在本机处理；第三方大模型只接收文字。
- API Key 当前继承上游 JSON 存储方式，正式打包前需迁移至系统安全存储。
- 预训练模型不进入 Git 仓库；模型许可证独立于 sherpa-onnx 引擎。
- 大连理工词汇本体数据的再分发条件需在商业发布前完成来源复核。
- React Bits 当前采用 MIT 加 Commons Clause 条件，不得把组件本身作为独立商品、组件包或移植版销售/再分发。

## 后续优先级

1. 用系统凭据库替换明文 API Key 存储。
2. 将当前确定性受众触发器与模型措辞层连接，并保留规则护栏。
3. 接入真实数字人素材和 Provider，移除生产环境的 Picsum 演示图片。
4. 增加录制与本地导出，但必须保持显式授权和默认不保存。
5. 在真实 STT 流上实现观众兴趣曲线，并展示可追溯的触发证据。
