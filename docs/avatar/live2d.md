# 二维观众表情（Live2D 轨道）

日期：2026-09-08。与 LiveTalking 并行：判断事件驱动表情；真人视频仍走 GPU Provider。

公开仓库和网站包**没有打进 Cubism Core**（闭源），也不包含本机 Framework 构建产物或官方样例模型。V2 观众窗默认用 vendored bloub 演四态；本机导入的 Cubism 模型只有在 WebGL、Core 和官方 Cubism Web Framework bridge 都可用、实际绘制出非透明像素、并且逐帧更新 motion / 表情 / 眨眼 / Pose 时，才进入同一 `setExpression` 接口。空闲走模型 Idle motion；`confused / interest / drop` 由现有判断事件触发可打断反应，约 1.6 秒后回到 `listen`。任一环节失败即停止循环并恢复 bloub，不出现空白观众窗或双重角色。接口仍是：`CreatorAudienceStage.applyEvent(tile, event)`。B 模式保持静音，不把 LipSync 做成角色说话。

| 状态 | 触发（节选） |
|---|---|
| 在听 `listen` | 默认；信息不足 |
| 没跟上 `confused` | 低把握扣分（空泛、缺例子） |
| 兴趣回升 `interest` | 开场说清价值等正分 |
| 注意力下降 `drop` | 高把握扣分或跑题 |

LiveTalking 一旦 `data-avatar-state="live"`，二维脸隐藏，改播 GPU 视频。

本机像素绘制：开发者本人同意 Live2D 软件许可后，可把官方 Web SDK 的 Core、用官方 Framework 生成的本机 bridge 与 Shader 放到 `local-runtime/`（均不进 Git、不进网站打包）。当前默认路径不再调用手写 WebGL Presenter；手写实现只保留为实验代码。由于 Read Yourself 允许用户导入不定数量的模型，公开发布前应按“可扩展应用”向 Live2D 申请审核和特别出版许可；个人或小规模主体也不自动豁免，不能只看营收门槛。
