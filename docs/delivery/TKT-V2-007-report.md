# TKT-V2-007 执行报告

日期：2026-09-21 交付，2026-09-22 Founder 验收通过。CEO 复核状态：**Live 本机轨道已由 Founder 宣布全部验收完毕；不得把本机验收写成 Cubism Core 已随网站上线或已获公开分发许可。**

本单把本地 Live2D 从“能画出静态贴图”改成“持续逐帧更新，并对 `listen / confused / interest / drop` 作出可打断反馈”。没有 commit、push 或 Cloudflare 部署。没有合并 `research/v2-market-position`。没有把 Cubism Core、官方 Framework 构建产物或样例模型打进 Git / 网页包。

## 工作区

- 目录：`C:\Vibe coding program\expression-trainer-vertical-prototypes`
- 分支：`main`（与 `origin/main` 同为既有脏工作区，未切换、未重置）
- 启动验收窗口（必须在项目根目录）：`npm run dev:live2d`

## 修改文件与职责

| 文件 | 职责 |
|---|---|
| `live2d-local-runtime.js` | 读取 Motions / Physics / Pose / Groups；按官方 motion3 曲线求值；导演四态；可取消 RAF 循环；生命周期与 `prefers-reduced-motion`；失败时停循环 |
| `local-runtime/live2d-framework-bridge.js`（gitignore，仅本机） | 官方 Cubism Model / Pose / Renderer 按真实 delta time 更新并绘制；不再用离散 `setTimeout` 重绘静帧 |
| `v2-audience-stage.js` | 评价事件仍走 `applyEvent()`；约 1.6s 可打断停留；Live2D 失败时恢复 bloub，而不是空白 canvas |
| `live2d-local-import.js` | 降级文案改为“恢复默认 bloub 观众”，并给出具体原因 |
| `v2-focus.css` | `presentation=adapter` 时隐藏 bloub，避免双重角色 |
| `tests/live2d-local-runtime.test.js` | 保留 canvas / 像素 / 判断隔离；失败路径改为 bloub |
| `tests/live2d-local-motion.test.js` | 时间推进、三态可区分、可打断、生命周期、reduced-motion、缺资源降级 |
| `tests/live2d-local-import.test.js` | 缺 Core 时恢复 bloub |
| `package.json` | 把 motion 测试接到 `npm test` 中、排在研究文档闸门之前 |
| `docs/avatar/live2d.md`、`docs/avatar/local-import.md`、`local-runtime/README.md` | 动态运行与 bloub 降级说明 |

## 逐帧更新顺序

适配器拥有可取消的 `requestAnimationFrame` 循环。每一帧：

1. 用真实 delta time（上限 100ms）推进导演时钟
2. 若当前状态有 motion 且未开减少动态：按官方 Cubism 曲线算法（linear / bezier / stepped / inverse-stepped，bezier 用 Cardano）写入参数
3. 叠加模型自带 expression（若有）
4. 若 Idle motion 没有占用眨眼参数：用 Groups.EyeBlink 做克制眨眼
5. `confused / interest / drop` 若没有对应 expression，叠加可解释的标准参数反应
6. 官方 `CubismPose.updateParameters(model, dt)`
7. `model.update()` 与官方 WebGL renderer 绘制

不在每帧创建纹理或 WebGL buffer。页面隐藏或舞台销毁时 `cancelAnimationFrame`；恢复可见时再启动同一套循环。B 模式不驱动 Groups.LipSync，也不接 TTS。

## 状态映射（Hiyori 开发样例）

Hiyori 没有四态 Expressions，动态信息在 Motions / Groups：

| 训练状态 | 来源 | 肉眼预期 |
|---|---|---|
| `listen` | `Idle` motion 循环 + EyeBlink | 待机呼吸/点头/眨眼，不像贴图 |
| `confused` | `TapBody`（`Hiyori_m04`）+ 歪头/皱眉标准参数 | 没跟上 |
| `interest` | 标准参数：眼笑、嘴角、微抬头 | 兴趣回升 |
| `drop` | 标准参数：低头、眼睑下垂、嘴角下压 | 注意力下降 |

评价切换只由 `CreatorAudienceStage.applyEvent()` 触发。舞台层已有约 1600ms 停留与 `clearTimeout` 打断；新事件立即 `setExpression()`，不等旧 motion 播完。反应结束后回到 `listen` Idle。

减少动态开启后：停止 Idle 循环位移，仍写入可识别的反应参数，并保留页面标签。

## 失败降级

WebGL 不可用、缺 Core、缺 Framework bridge、模型读取失败、逐帧异常或 context loss：停止循环、移除 canvas、显示具体原因、恢复默认 bloub。不留下空白画布或双重角色。

## 测试

现有“canvas 存在 / 有像素 / 判断不被形象改写”测试仍通过。新增 `tests/live2d-local-motion.test.js` 覆盖工单第四节 1–6 项。

### 本单定向结果

| 命令 | 退出码 |
|---|---|
| `npm run check` | 0 |
| `node tests/live2d-local-runtime.test.js` | 0 |
| `node tests/live2d-local-motion.test.js` | 0 |
| `node tests/live2d-local-import.test.js` | 0 |
| `node tests/live2d-package-boundary.test.js` | 0 |
| `node tests/bloub-audience.test.js` | 0 |
| `node tests/v2-audience-expression.test.js` | 0 |
| `node tests/v2-focus.test.js` | 0 |
| `node tests/desktop-core.test.js` | 0 |
| `node tests/v2-judgment.test.js` | 0 |
| `node tests/package-web.test.js` | 0 |
| `git diff --check`（本单相关文件） | 0（仅有既有 Windows `LF will be replaced by CRLF` 提示，无空白错误） |

### 全量测试阻断（既有基线，非本单引入）

`npm test` 仍会在 `tests/v2-remediation.test.js` 中断：

```
assert(fs.existsSync(.../docs/research/2026-09-10-v2-remediation-open-source-review.md))
```

该文档只在 `research/v2-market-position`。本单未合并该分支。中断点之前的 Live2D 新测试已经单独跑过并通过。

## Founder 验收窗口

请在项目根目录执行：

```
cd "C:\Vibe coding program\expression-trainer-vertical-prototypes"
npm run dev:live2d
```

不要在 `C:\Users\31214` 或其他目录运行，否则会找不到 `package.json`。

Founder 于 2026-09-22 宣布 Live 板块全部验收完毕。后续补了本机 Resources 模型下拉、删除、本地导入进同一列表，以及状态标签固定在观众窗口右上角。这些属于验收期内的产品修正，不重新打开本单。

## 已知限制

- 当前本机 Framework 子集含 Model / Pose / Renderer，**不含**官方 `CubismPhysics` 类。`.physics3.json` 会被读取并登记，但头发/裙摆物理暂不求值。Hiyori 的可见动态来自 Idle / TapBody 曲线、眨眼、Pose 和反应参数。若验收认为头发必须随身体惯性摆动，需要另单把官方 Physics 编进本机 bridge，而不是用 CSS 或随机表情冒充。
- 手写 WebGL Presenter 仍不是默认路径。
- Cubism Core、bridge 与官方样例仍只存在于 gitignored `local-runtime/`，生产网站包不含这些文件。
- 公开发布前的 Live2D“可扩展应用”许可仍未闭环。
- 本环境未提交 10 秒待机录屏或三态录屏；那是 Founder 验收证据，不是执行岗自动通过条件。

## 未做

- commit / push / 部署
- 合并研究分支
- 改 V2 判断语义、兴趣分或 TTS
- 新的云服务
- 重置或切换脏工作区
