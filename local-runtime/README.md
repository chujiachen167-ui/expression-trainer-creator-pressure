# 本机 Cubism 官方运行资产

开发者在本人阅读并同意 Live2D 的软件许可后，才可以把官方 Web SDK 中的 `live2dcubismcore.min.js` 放到这个目录，并用官方 Cubism Web Framework 构建本机 `live2d-framework-bridge.js`。Framework 的 WebGL Shader 放在 `CubismWebFramework/Shaders/WebGL/`。三者齐备时，本地 Electron 或 loopback HTTP 预览才会尝试绘制导入模型。

- Core、Framework 构建产物、Shader 与官方样例都只用于本机验证，不要提交进 Git。
- `npm run package:web` 不会复制这个目录，生产网站不会带上 Cubism Core。
- Read Yourself 允许最终用户导入不定数量的模型，极可能属于 Live2D 定义的“可扩展应用”。这类应用在公开发布前需要 Live2D 审核并签订特别出版许可，个人或小规模主体也不自动豁免。不要仅依据营收门槛判断是否可以发布；以 [官方可扩展应用许可页](https://www.live2d.com/en/sdk/license/expandable/) 和 Live2D 的书面答复为准。
- 缺 Core、缺官方 Framework bridge、没有 WebGL、没有绘制出非透明像素、模型加载失败或逐帧运行异常时，V2 会停止动画循环并恢复默认 bloub 观众，不会留下空白观众窗或双重角色。
