# Expression Trainer · Creator Pressure

面向自媒体新手的镜头表达与可控压力训练桌面应用。项目继承 [fxy2311-youyou/expression-trainer](https://github.com/fxy2311-youyou/expression-trainer) 的 Electron、Sherpa-ONNX 离线转写、中文表达词库、多模型配置、实时反馈和完整报告能力，再增加摄像头、数字观众及自媒体实战训练层。

## 当前能力

| 层级 | 训练目标 | 已实现 |
|---|---|---|
| V1 镜头基线 | 面对镜头自然、紧凑地表达 | 摄像头、透明实时字幕、中英混合/English 两种模式、原词库指标、训练规则、AI 配置与报告 |
| V2 数字观众 | 在可控观看压力下保持表达质量 | 受众模板、确定性行为触发、压力等级、数字人 Provider 接口、同题重练 |
| V3 实战房间 | 完成自媒体常见高压任务 | 广告植入、热点观点、直播回应、知识口播及可删除的事件流 |

三层共享同一个诊断核心，并非三个独立产品。当前数字观众的触发策略仍是可审计的确定性规则；LiveTalking 是可替换的形象呈现 Provider。

## 桌面端运行

环境：Windows 10/11、Node.js 22.12 或更高版本。

```powershell
npm install
powershell -ExecutionPolicy Bypass -File .\scripts\setup-asr-model.ps1
npm start
```

模型安装脚本会从 sherpa-onnx 官方发布页下载约 1 GB 的中英双语流式 Paraformer 模型。模型保存在本机 `models/`，已被 `.gitignore` 排除，不随仓库分发。

桌面端提供：

- Sherpa-ONNX 本地麦克风转写，不依赖浏览器语音服务。
- 原项目的笼统词、填充词、犹豫词、重复表达与表达密度分析。
- 训练菜单中的“原始诊断模式”“训练规则”和“大模型配置”。
- OpenAI、DeepSeek、Ollama 及兼容 OpenAI 接口的自定义服务。
- 本地诊断兜底；配置模型后追加实时 AI 建议和完整复盘。

## 浏览器预览

直接打开 `index.html`，或用静态服务器访问本目录。浏览器模式用于快速验收 UI、摄像头、受众模板和场景流程；它会降级使用 Web Speech API 与本地 JavaScript 词库，不能替代桌面端的离线诊断核心。为避免浏览器反复请求麦克风权限，每轮只启动一次 Web Speech；服务提前结束时会明确提示，不会自动无限重启。

## 开发与验证

```powershell
npm run check
npm test
npm run smoke
```

- `check`：检查桌面主进程、预加载脚本、训练界面和诊断核心语法。
- `test`：验证表达分析、受众引擎、词库、自定义口癖词、提示词和 ASR 状态契约。
- `smoke`：启动真实 Electron 渲染器，验证 V1、预加载桥接和离线模型状态。

## 人工验收调控板

每个训练页面右下角都有仅供开发阶段使用的调控板，配置保存在当前浏览器的 `localStorage`：

- “UI 参数”：能力开关、颜色、字体、画布、布局和元素位置/尺寸。
- “文案”：管理当前页面全部可见静态文案和浏览器标题。
- “组件”：管理 Drift Wall 等外部视觉组件的参数。

正式用户环境将页面设为 `<body data-environment="production">` 后，调控板不会初始化；LiveTalking 地址、Avatar ID 等开发者字段也不会暴露。

## 数据与隐私边界

- 默认不录制、不上传摄像头画面。
- Electron 语音转写在本机执行；只有明确配置并启用大模型时，文字内容才会发送给相应服务商。
- 当前不使用视觉模型判断视线，也不进行颜值、人格、情绪或可信度评分。
- 设置仍沿用上游的本地 JSON 存储方式；正式发布前应迁移 API Key 至 Electron `safeStorage` 或系统凭据库。

## 来源、许可证与第三方材料

本仓库使用 MIT License，并保留上游作者 Sisi 的版权声明。Creator Pressure 的新增改动由 chujiachen167-ui 维护。

- [LICENSE](LICENSE)：本仓库 MIT 许可证与双方版权声明。
- [NOTICE.md](NOTICE.md)：上游来源、基准提交和主要改动。
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)：Electron、sherpa-onnx、React Bits、LiveTalking、词库与演示素材边界。
- [UI_REFERENCE.md](UI_REFERENCE.md)：界面参考与未复制内容。
- [ARCHITECTURE.md](ARCHITECTURE.md)：当前实现结构和能力边界。

注意：离线模型、词库数据和运行时远程图片可能具有独立许可证。本仓库不会借由 MIT 声明覆盖这些第三方材料的许可条件；生产分发前必须按第三方清单逐项复核。
