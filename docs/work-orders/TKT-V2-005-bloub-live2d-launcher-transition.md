# TKT-V2-005 · bloub 默认观众、本机 Live2D 启动与首页过渡

日期：2026-09-14  
状态：自动验证通过，等待 Founder 人工验收

## 本轮范围

- 修通 `npm run dev:live2d`：打开 V2 本机 Electron 窗口，导入获准的本机 Live2D 样例，并在窗口内显示明确的成功或失败状态。
- 采用唯一上游 `https://github.com/jeremy-prt/bloub` 的 SVG 形变核心作为默认二维观众的最小浏览器适配层；固定来源 commit，并保留 MIT 许可与第三方声明。
- 默认角色只接收既有 `CreatorAudienceStage.applyEvent(tile, event)` 四态事件，不改变 V2 判断器、评分或兴趣曲线语义；保留 SVG 兼容降级层。
- 修复首页 V1/V2/V3 点击过渡的信息重复与结构问题：原卡片内容淡出，独立过渡层只显示一次模式提示；支持快速点击、pagehide/pageshow/bfcache 清理和 reduced motion。
- 增加定向契约/生命周期测试，并执行全量测试、静态检查、网页打包与边界核对。

## 非范围

- 不迁移到 Vue/React，不把 bloub 演示壳或依赖带入产品运行时。
- 不把 `local-runtime/`、Cubism Core、官方样例模型、本机模型文件或本地路径加入网页发布包或 Git 发布范围。
- 不把上游 x.ai/Grok 名称、Logo、设计或商标写入产品 UI；不声称与 x.ai 有关联或获得授权。
- 不修改 `v2-rule-judge.js` 的评分语义、事件协议或兴趣曲线算法。
- 不实现 LiveTalking、TTS、远程模型上传、云端 Live2D 或公开部署；不提交、推送、部署或发布。

## 风险与边界

- bloub 上游是对参考视觉行为的 MIT 代码复现；MIT 许可覆盖代码，不覆盖其模仿的第三方设计或商标。产品采用 Read Yourself 自有名称与语义，需保留上游许可及声明。
- 本机 Live2D 是否成功仍取决于本机 Cubism Core、官方 Framework bridge、WebGL 和样例文件；任一环节失败必须回到 bloub/SVG 兼容层，并把失败原因显示在窗口内。
- 自动 DOM/契约测试不能证明 Founder 的真实视觉验收，也不能证明任意用户模型兼容；网页包只证明发布边界，不证明线上已部署。

## 验收证据

- 上游来源：`jeremy-prt/bloub`，固定 commit `b4bb3c1b5f93c7b87a2e8d620f667c4093d97749`，MIT，版权 Jérémy Perret 2026。
- 默认观众：四态映射、待机眨眼/注视/轻微呼吸来自上游核心；状态变化只能由现有判断事件驱动。
- 启动窗口：`npm run dev:live2d` 可见 Electron 窗口；窗口状态必须能区分本机样例成功、兼容层降级和启动失败。
- 过渡：无重复 V1/V2/V3 标题；原卡片不做包含文字的缩放；取消动画后不得继续导航；返回页和 bfcache 清理遮罩。
- 验证命令：定向测试、`npm test`、`npm run check`、`npm run package:web`、`git diff --check`；网页包不含 `local-runtime`、Cubism Core 或本机样例。
- Founder 人工边界：实际点击三种模式、观察默认角色四态、确认静音与回退、在本机窗口确认 Live2D 像素绘制与状态提示。

## 本轮执行记录

- 定向测试：Live2D validator/import/runtime/package-boundary、bloub adapter、V2 audience expression 全部通过。
- 全量 `npm test`：通过；`npm run check`：通过；`npm run package:web`：通过；`git diff --check`：通过。
- `dist/` 边界复核：不存在 `local-runtime/`、Cubism Core、官方样例或模型贴图目录。
- `npm run dev:live2d` 已尝试启动；当前执行环境 Electron GPU 进程以 `-1073741515` 退出并触发 `GPU process isn't usable`，未形成可见窗口，因此 Hiyori 像素绘制仍待具备可用 GPU 的本机 Founder 验收。
