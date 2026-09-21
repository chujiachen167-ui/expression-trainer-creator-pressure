# LiveTalking 接入

日期：2026-09-08，2026-09-09 修正产品边界。C 轨是用户在训练开始前主动选择的面对面真人数字人；数字人从训练开始起全程在场，不会作为压力事件在表达途中突然闯入。它与多观众阵容平行，不是 Live2D 的高级版。

数字人只负责把 V2 已有判断事件演出来，不决定受众、不读完整报告、不用 `chat`/`LLM` 模式。`Provider` 是内部连接与播放能力，不是面向用户的等级或模式名称。

## 网站上不了 Cloudflare Pages

`read-yourself.com` 是静态站。LiveTalking 是本机/云端 **GPU Python WebRTC 服务**，不能打进 Pages。

| 环境 | 怎么连 |
|---|---|
| Electron / `http://127.0.0.1:8976` | 可以连 `http://127.0.0.1:8010` |
| `https://read-yourself.com` | **不能**连本机 http。浏览器会拦混合内容。必须另开一台带 **https** 的 GPU 服务，再改 `avatar-runtime.js` |

上线清单（另立项，不是这次 Pages 构建）：GPU 主机、HTTPS、WebRTC UDP、STUN/TURN、形象与模型许可、隐私说明（播报文本会离开用户浏览器到该服务）。摄像头画面默认仍不上传。

## 本机打通

仓库已接到 LiveTalking 的 `/offer`、`/human`（`type: echo`）、打断。源码在旁边的 `C:\Vibe coding program\LiveTalking`，不进本 git。

1. 按 [LiveTalking README](https://github.com/lipku/LiveTalking) 用 **wav2lip** 启动本地技术验证（本机 RTX 4060 8GB 够 wav2lip，不够稳跑 MuseTalk）。Windows 也可用官方整合包。开源 Wav2Lip 仅允许个人、研究和非商业用途，因此不得把该验证模型直接作为 Read Yourself 商业发布方案；生产模型另行做许可审查。
2. 服务起来后：`http://127.0.0.1:8010/`
3. `npm start` 打开 V2 → 调控板 → 数字人 Provider → `LiveTalking · WebRTC`，地址 `http://127.0.0.1:8010`，保存。
4. 选择数字观众。成功时观众窗出现视频；失败会写明原因并降级浏览器演示。
5. 「试听反应」会调用 `/human` echo，不写训练记录。

生产默认仍是 `avatar-runtime.js` 里的 `provider: "mock"`。有了公开 https GPU 地址，再把那里改成 `live` 并填 `serverUrl`。

## 租卡（C 轨，你现在做）

不要用 RunPod 当第一台：Pod 不支持 UDP，数字人视频容易黑屏。

1. 打开 [优云智算 LiveTalking 镜像](https://www.compshare.cn/images/4458094e-a43d-45fe-9b57-de79253befe4)。
2. 地区选 **华北二或上海**（华北一 C 不可用）。卡选 RTX 40 系或 3090，先 wav2lip。
3. 开机后开放 **TCP 8010** 和 **UDP 50000–51000**。
4. 浏览器打开 `http://公网IP:8010/index.html`，在**他们自己的页面**连上、打几个字，脸会动。过不了不要接我们的 V2。
5. 把 `http://公网IP:8010` 发回工程窗口。桌面版 / 本地预览可以先用 http。接到 `https://read-yourself.com` 必须再加 https 域名。

费用：按小时，用完关机。先试 1 小时即可，不必一次充一两百。
