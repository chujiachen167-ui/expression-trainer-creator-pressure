# 网页端字幕：Cloudflare Pages + Whisper

## 为什么需要这一层

浏览器内置的 Web Speech API 不是跨浏览器字幕能力：它可能不存在，也可能在麦克风已经获准时拒绝识别服务。摄像头和本地录音能工作，并不代表浏览器会返回字幕。

本仓库的 `functions/api/transcribe.js` 为 Pages 增加同域转写端点。启用后，网页会把约 3 秒的**纯音频临时分段**发送到该端点，由 Cloudflare Workers AI 的 Whisper 返回文字；页面不上传摄像头画面，也不把音频写入仓库、浏览器存储或数据库。浏览器不支持该端点时仍回退到 Web Speech 或“粘贴逐字稿”。

## 上线前一次性配置

这一步由 Cloudflare 项目所有者在控制台完成，不能放在浏览器代码里：

1. 确认 Pages 项目是从 Git 仓库构建的。Pages Functions 不能用控制台的 Direct Upload 部署。
2. 在 **Workers & Pages → 对应 Pages 项目 → Settings → Bindings** 添加一个 Workers AI 绑定，变量名必须是 `AI`。
3. 在 **Settings → Variables and Secrets** 为 Production（及需要的 Preview）添加普通变量：`WEB_STT_ENABLED=true`。
4. 保持构建命令 `node scripts/package-web.js`、输出目录 `dist`，然后重新部署。
5. 打开 `https://你的域名/api/transcribe`：服务正常时会返回 `{ "available": true }`；未完成配置会返回 503 与 `not-configured`。

不设置 `WEB_STT_ENABLED=true` 时，端点保持关闭，网页不会上传任何音频。

## 成本、隐私与公开站点边界

- Workers AI 目前有每日免费额度，超过后取决于 Cloudflare 账户方案和限额；启用前请在 Cloudflare 控制台确认当前价格与预算上限。
- Whisper 端点处理的音频会离开用户设备。因此，应在正式启用前更新网站隐私说明，并明确说明“字幕音频会发送至 Cloudflare Workers AI，仅用于本次转写”。
- 当前端点限制单个分段至 1.5 MB，但尚未接入账户体系、Turnstile 或配额库。向公众大规模开放前，应先加访问控制和每日限额，避免被滥用。
- 该实现优先解决 macOS/Safari/Chrome 对 Web Speech 支持不一致的问题；它不是桌面版 Sherpa 的离线替代，网络不可用时仍不能生成网页字幕。

## 人工验收

1. 用 macOS Safari 或 Chrome 打开已启用服务的域名，允许麦克风。
2. 开始训练后，状态应显示“网页 Whisper · 每约 3 秒生成一次字幕”。
3. 连续说一句中文或英文，约一到两个分段后应出现在逐字稿里；摄像头画面和本地录像不应上传。
4. 把 `WEB_STT_ENABLED` 临时改为 `false` 并重新部署：网页应明确显示服务未启用，并回退到浏览器 Web Speech 或粘贴逐字稿，不应把问题错误地说成“麦克风权限被拒绝”。
