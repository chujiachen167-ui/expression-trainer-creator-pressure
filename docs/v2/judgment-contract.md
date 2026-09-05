# V2 判断接口

日期：2026-09-05。判断器版本：`rules-v1.0.0`。种类：`rules`（规则判断器，不是语义模型）。

## 可替换接口

实现必须提供：

- `version`：字符串，写入每轮冻结配置。
- `kind`：当前为 `rules`。未来模型实现使用不同 `kind`，不得把规则版标成已经完成语义理解。
- `judge({ round, segment, previousEvents, locale, recognitionLanguage })`：只对 `status === 'final'` 的片段返回事件数组。

返回：

```
{
  events: [{ type, audienceId, confidence, scoreDelta, explanation, suggestion, evidence, startMs, endMs, timePrecision }],
  note?
}
```

`confidence` 只能是 `high` | `low` | `insufficient`。`evidence.excerpt` 必须能在对应片段正文中复核。无可靠局部信号时返回空事件，由界面显示“信息不足 / 暂无明确变化”，不得无依据给出高分。

## 会话事实

- 片段：`sessionId`、`segmentId`、`revision`、`text`、`interim|final`、`source`、`startMs`/`endMs`、`timePrecision`。
- 判断事件引用 `segmentId`，并带时间或时间范围、受众、类型、证据、解释、建议、可靠程度。
- 同一 `resultId` 的确认结果幂等。临时修订只增加 `revision`，不反复扣分。不同片段的相同文字保留为真实重讲。
- 时间来源优先级：词级时间 → 音频片段边界 → 估算范围 → 无时间。结果到达时间只作到达标记，不能当作发言时间。
- `paste` 没有真实时间：`timePrecision = none`，禁止“前三秒”结论和虚假录像跳转。
- 练习开始与首个有效发声分开记录。开场判断绑定本轮第一条有效发声；精度不足时退回“开场片段”。

## 分数

相对模拟兴趣，不是百分号留存概率，也不是真实观看率。

| 项 | 值 |
|---|---|
| 初始 | 50 |
| 下限 | 12 |
| 上限 | 92 |
| 低把握变化 | -2 |
| 高把握变化 | -8 |
| 支持变化 | +4 |
| 同类信号冷却 | 12000 ms |

固定输入、冻结配置与版本必须得到可复现结果。转写失败、空白轮次不生成评分。等待字幕收尾画成缺口 / 待处理，不画成兴趣下降。

## 受众差异

最少三种，差别必须出现在依据和建议中：

- `fastScroller`：开场利害、密度、对象是否说清。
- `beginner`：黑话、例子、结构。
- `skeptic`：可核对依据、具体度、边界。

“因为”或数字不能自动证明内容质量。孤立“其实”“我觉得”“it”“if”不判不专业。叙事开头允许，不被强制按“没结论”判差。

## 比较与导出

同题重练冻结题目、受众、压力、识别语言、判断版本。条件不同则说明不可直接比较。比较引用原句，不默认第二轮更好，不用内部得分证明能力提高。导出 JSON 含逐字稿、依据与时间精度，不含音视频、密钥或设备信息。
