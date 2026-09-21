# V2 重做前开源调研

日期：2026-09-10

## 结论

没有找到可直接替代当前 V2 判断器、同时满足“实时逐字稿输入 + 指定假想观众 + 输出可解释兴趣曲线”的成熟开源库。现有项目分成三类：真实观众表情识别、公开表达客观指标、公开表达文本风格评分。V2 应复用后两类的算法结构，不把真实观众视觉模型误称为内容兴趣预测。

## 候选项目

| 项目 | 许可 | 可借鉴部分 | 不直接接入的原因 |
|---|---|---|---|
| [Converser](https://github.com/MatthewHiggins2017/Converser) | MIT | 按时间窗计算语速、停顿、填充词、音高与置信度趋势 | Python/音频后处理栈较重；指标不是指定假想观众的内容兴趣 |
| [iamspeaker](https://github.com/spark798/iamspeaker) | MIT | 本地优先；measure → prescribe → re-practice；按 take 比较客观指标 | 包含当前 B 不需要的 TTS、Ollama 和完整演讲工作台，整套引入会扩大范围 |
| [PSST](https://github.com/shs910/psst) | MIT | 把公开表达拆成互动性、情绪性、生动性、口语性，并按片段形成分布 | 训练/评估模型较重，主要面向英文长文本风格迁移，不是实时浏览器判断器 |
| [DAiSEE](https://github.com/federicovergallo/Engagement-recognition-using-DAISEE-dataset) | MIT（实现仓库） | “投入 / 无聊 / 困惑 / 挫败”状态定义 | 输入是真实观看者的视频和面部状态；会反转 Read Yourself 的数据方向并增加隐私、算力与模型负担 |
| [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display) | MIT（库；Cubism Core 与模型另受 Live2D 许可约束） | 从目录文件集合发现 `.model3.json` 并为引用资源建立本地 URL 映射的导入交互 | 当前项目已经使用官方 Cubism Framework bridge；为了一个入口换渲染栈会重复引入 Pixi 与第二套生命周期 |

## 本轮采用

1. 兴趣轨迹采用 Converser 的“真实时间窗 / 片段”结构，不再把整篇累积文本重复打分。
2. 内容维度参考 PSST 的分解思想，但继续使用本项目可解释的受众规则：
   - 快划观众：开场价值、对象相关性、新信息密度；
   - 零基础观众：术语可理解性、例子、结构；
   - 怀疑型观众：可核对依据、具体性、代价与边界。
3. 每类受众必须同时存在正向与负向证据；分数只在新证据出现时变化。没有新证据时允许保持水平，并明确标为“暂无新证据”，不加入随机抖动。
4. B 模式只把判断事件映射为 Live2D / 其他观众形象的表情状态，不触发 TTS，不参与轮流对话，也不暂停 STT。
5. V2 的诊断与台词优化直接复用仓库现有 V1 Diagnostic Core，不引入另一套开源报告系统。
6. 本地 Live2D 继续沿用官方 Cubism Framework bridge；导入交互借鉴目录文件集合模式，但保留现有路径校验、大小限制和本机会话授权。

## 验证边界

这里产出的是“相对模拟兴趣”，不是实际观看率、平台留存率或心理测量。自动化检查只验证确定性规则、时间映射、静音边界和功能可达性；形象是否好看、表情是否像真实观众，仍由 Founder 人工验收。
