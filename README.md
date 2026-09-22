# Read Yourself

对着镜头讲一段话，讲完就能看见自己哪儿卡壳、哪儿重复。

面向准备录口播、观点分享、种草、科普或个人 IP 内容的中文自媒体新手。先在低压力环境里开口，再从字幕、静音数字观众和可核对的表达证据里看见具体问题，同一题再练一遍。

[打开网站](https://read-yourself.com)　·　摄像头和麦克风默认都在你这台设备上，不自动上传。

![Read Yourself 起始页](docs/screenshots/read-yourself-launcher.jpg)

仓库技术名是 Expression Trainer · Creator Pressure。项目继承 [fxy2311-youyou/expression-trainer](https://github.com/fxy2311-youyou/expression-trainer)。

## 这是给谁的

已经有一个内容主题、准备在自媒体平台发布、但还不敢或不会稳定对着镜头讲的人。

它不是课程，也不帮你运营账号，更不是通用演讲评分器。它只填「写好内容之后、真正发布之前」这一段复练空白。

**当前不做：** 课堂展示、答辩、面试、销售培训、组织考核、账号社区或创意工坊。也不预测真实完播率、推荐量或商业转化。

## 你能练什么

一次完整使用是：选主题和受众 → 面对镜头连续讲 → 看静音观众反应 → 看引用原句的诊断 → 同一题再讲。

| 层 | 练什么 | 现在能用 |
|---|---|---|
| **V1 镜头基线** | 开摄像头讲一段，看字幕和口头禅、重复、含糊词 | 网站和桌面版 |
| **V2 数字观众** | 加一个一直在场、不说话的观众；兴趣随可核对的表达证据变化 | 网站默认二维观众；桌面版可改用本机 Live2D |
| **V3 实战房间** | 更接近发布前的完整练习环境 | 原型可用，观众舞台仍以 V2 为准 |

数字观众只改变外观和反应呈现，不改分数、不播语音、不追问、不抢麦克风。没有新证据时，兴趣曲线不会无故跳动。

## 怎么试

1. 打开 [read-yourself.com](https://read-yourself.com)
2. 从「镜头基线」开始，允许摄像头和麦克风
3. 选一个自己的题（不要用空泛测试稿），讲完看字幕和被标出的词
4. 需要被盯着练时，进入数字观众层，应用一个受众模板后再开始

浏览器打开就能试。完整离线识别和本机分析用 Windows 桌面版。

```powershell
npm install
powershell -ExecutionPolicy Bypass -File .\scripts\setup-asr-model.ps1
npm start
```

环境：Windows 10/11、Node.js 22.12 或更高。模型脚本会下载约 1 GB 的 sherpa-onnx 中英双语流式 Paraformer，只保存在本机 `models/`，不进仓库。

本机 Live2D 观众：

```powershell
npm run dev:live2d
```

需要你自行放置 Cubism Core（闭源，不随仓库或网站分发）。左侧「当前形象」可选择默认二维观众 bloub、本机 `Resources` 样例，或导入自己的 `.model3.json` 文件夹。模型不上传。网站版不能渲染 Live2D，只保留说明和入口。

## 兴趣曲线是什么

当前曲线是 **相对模拟兴趣**，初始为 50，由规则 `rules-v1.2.0` 根据原句证据加减，例如具体数字、例子、边界，或空泛、重复、信息密度下降。它：

- 服务于复练，不是人格、魅力或真实观众心理测量
- 不接入任何平台后台，不能当成完播率或推荐分
- 每次变化应能回到时间、原句和规则版本

正式找人试用前，我们还会再做一轮兴趣曲线、模糊词判定和优化词提供的上线前优化。

## 数据与隐私

- 默认不录制、不上传摄像头画面。
- 桌面端语音转写在本机执行；只有你明确配置大模型后，文字才会发给对应服务商。
- 网页 Whisper 转写默认关闭。若项目所有者按 [`docs/stt/web-stt-cloudflare.md`](docs/stt/web-stt-cloudflare.md) 启用，音频分段会发给 Cloudflare Workers AI，只用于返回字幕。
- 当前不用视觉模型判断视线，也不做颜值、人格、情绪或可信度评分。
- 调控板草稿只存在当前浏览器；正式环境不显示调控板。

## 开发者

```powershell
npm run check
npm test
npm run smoke
```

- `check`：语法检查
- `test`：表达分析、受众、词库、Live2D 边界和页面契约
- `smoke`：真实 Electron 窗口

开发阶段每个训练页右下角有调控板，用于 UI、文案和组件参数；保存到项目会写入根目录 `creator-project-config.js`。细节见 [`docs/qa-editability-audit.md`](docs/qa-editability-audit.md)。

架构见 [`ARCHITECTURE.md`](ARCHITECTURE.md)。产品边界见 [`CONTEXT.md`](CONTEXT.md)。V2 判断契约见 [`docs/v2/judgment-contract.md`](docs/v2/judgment-contract.md)。

## 来源与许可证

本仓库使用 MIT License，并保留上游作者 Sisi 的版权声明。Creator Pressure 的新增改动由 chujiachen167-ui 维护。

- [LICENSE](LICENSE)
- [NOTICE.md](NOTICE.md)
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)：Electron、sherpa-onnx、React Bits、bloub、LiveTalking、词库与演示素材
- [UI_REFERENCE.md](UI_REFERENCE.md)

离线模型、词库和 Live2D Cubism 组件可能有独立许可。公开发布用户导入的 Live2D 前，需要单独核验 SDK、样例模型和用户模型的分发权。本仓库不会把 Cubism Core 打进 Git 或网站包。
