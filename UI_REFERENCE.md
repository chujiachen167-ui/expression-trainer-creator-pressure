# V3 UI 开源参考与设计映射

本轮不是从空白审美稿出发，而是把四类成熟开源产品各自最擅长的界面模式映射到 Expression Trainer。只借鉴通用布局和交互原则，不复制品牌资产或整页代码。

## 参考项目

### LiveKit Meet

- 仓库：https://github.com/livekit-examples/meet
- 许可证：Apache-2.0
- 借鉴：主视频占据视觉中心；次要参与者收纳为侧边缩略窗；会话状态和音视频控制保持接近舞台。
- 不借鉴：会议成员、屏幕共享、通用会议导航。V3 的小窗口始终是自媒体受众压力角色。

### OpenCut

- 仓库：https://github.com/OpenCut-app/OpenCut
- 许可证：MIT
- 借鉴：深色中性创作者工作台、紧凑面板、明确工作区边界，以及工具设置从主画布让位的思路。
- 不借鉴：时间线、素材库和视频编辑功能。Expression Trainer 仍然是表达训练器。

### shadcn/ui

- 仓库：https://github.com/shadcn-ui/ui
- 许可证：MIT
- 借鉴：Sheet、Badge、Segmented Control、Skeleton、Card 的层级和状态表达。
- 实现方式：当前项目是原生 HTML/CSS/JS，因此只复刻交互模式，不引入 React/Tailwind 依赖。

### Umami

- 仓库：https://github.com/umami-software/umami
- 许可证：MIT
- 借鉴：复盘先展示少量关键指标，再给解释和单一行动建议；避免把分析结果做成长篇报告。
- 不借鉴：通用网站分析导航和复杂筛选器。

## 映射到 V3

| V3 区域 | 采用的开源模式 | 产品内含义 |
| --- | --- | --- |
| 中央镜头舞台 | LiveKit Meet | 创作者是主角，三个受众只是压力视角 |
| 左侧训练轨道 | OpenCut | 简报、场景和实时信号按工作顺序排列 |
| 训练设置侧滑层 | shadcn/ui Sheet | 低频配置退出主舞台，需要时再展开 |
| 压力等级 | shadcn/ui Segmented Control | 只控制反应频率和直接程度 |
| 结束复盘弹层 | Umami 指标概览 | 三个关键数值加一个下一轮动作 |

## 视觉约束

- 中性色占主要面积，品牌强调色只表示选中、压力和当前动作。
- 同一屏只允许一个高权重主按钮。
- 数字观众窗口必须显示身份、动机和当前反应，不能只放一张脸。
- 调控板属于内部验收能力，不参与用户的训练主流程。
- LiveTalking 服务地址和 Avatar ID 属于 Provider 实现细节，只出现在开发者调控板；用户界面只呈现“数字观众由系统提供”。
- 复盘只给一个优先动作，避免把用户淹没在指标里。
