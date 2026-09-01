# STT 基线与升级门槛

## 为什么先测再换

当前桌面版使用 `sherpa-onnx-streaming-paraformer-bilingual-zh-en`。它负责低延迟的中英双语实时字幕；浏览器预览仍会退化为 Web Speech，不能与桌面模型混为一谈。

升级判断不采用“听起来更厉害”或单条录音体验。目标用户是面对镜头说中文、夹杂英文平台词和品牌名的自媒体新手，因此基线必须来自这类真实口播。

## 第一批语料

收集 30–100 条经过本人同意的短录音，每条 15–90 秒。原始音频只保存在 `benchmarks/stt/corpus/`，默认不提交 Git。每条录音都需要人工校对标准答案，至少覆盖：

- 安静环境普通话。
- 中英混合的平台词、品牌名和缩写。
- 语速偏快、停顿少、口头禅较多。
- 笔记本内置麦克风与常见外接麦克风。
- 轻微环境噪声和不同说话距离。

清单格式参考 `benchmarks/stt/manifest.example.json`。WAV 可以是 16/32 bit、单/双声道和常见采样率；测试工具会转成 16 kHz 单声道。不要把 WebM 录像直接改后缀冒充 WAV。

## 运行

```powershell
npm run benchmark:stt -- benchmarks/stt/manifest.json
```

报告写入 `benchmarks/stt/results/`，包含：

- CER：清理标点后的字符错误率。
- Mixed Token Error Rate：汉字逐字、英文按词统计的混合错误率。
- First Partial Audio：消费多少毫秒音频后首次出现可见字幕。
- RTF：推理耗时 ÷ 音频时长，小于 1 才具备实时运行余量。
- 每条样本的标准答案、识别结果、设备标签和场景标签。

## 候选路线

1. **保留当前流式 Paraformer**：作为实时字幕基线。
2. **流式 Zipformer/Zipformer2 CTC**：仅在同一语料上实时错误率和首字速度都更好时替换。
3. **SenseVoice 或 Paraformer-Large**：作为一句结束后的本地二次校正候选；不阻塞实时字幕。
4. **Whisper 或 FunASR Nano**：只在目标电脑资源、语言覆盖或最终精度证明值得时引入。

官方模型边界：

- sherpa-onnx streaming/offline model families: https://k2-fsa.github.io/sherpa/onnx/c-api/html/index.html
- SenseVoice in sherpa-onnx: https://k2-fsa.github.io/sherpa/onnx/sense-voice/index.html
- FunASR model selection: https://github.com/modelscope/FunASR/blob/main/docs/model_selection.md

## 双阶段识别的进入条件

只有当离线候选在目标语料上的 CER 明显下降，并且一句话结束后的修正等待可接受，才增加“实时字幕 + 最终校正”。最终文本允许修正刚结束的句子，不反复改写用户正在看的当前词。
