# 文档目录

产品代码仍在仓库根目录。说明、工单和交接按用途分开放，避免和工作区临时文件混在一起。

| 目录 | 放什么 | 是否进 Git |
|---|---|---|
| `docs/adr/` | 架构决策 | 是 |
| `docs/avatar/` | 观众形象：bloub、Live2D、本机导入、LiveTalking 分轨 | 是 |
| `docs/delivery/` | 已执行工单的交付报告 | 是 |
| `docs/design/` | 设计稿与首页方案 | 是 |
| `docs/handoff/` | 会话交接，给下一班继续用 | 是 |
| `docs/research/` | 工程证据与调研。市场定位全文在分支 `research/v2-market-position`；主线只放测试需要的开源复盘 | 部分 |
| `docs/work-orders/` | 待执行 / 已签发工单 | 是 |
| `docs/school-materials/` | 学校入驻材料与个人申请表，只留本机 | 否，见根目录 `.gitignore` |
| `docs/v2/` | V2 判断契约 | 是 |
| `local-runtime/` | 本机 Cubism Core / Framework / 样例。Git 只跟踪 README 与忽略规则 | 否（专有资产） |
| `.codex_tmp/` | 会话临时脚本、截图、Electron 缓存 | 否 |

市场调研交接（主线可直接读，不需要切分支）：

`docs/handoff/2026-09-21-v2-market-research-handoff.md`
