# Offline ASR model

The desktop runtime expects this directory:

```text
models/
└── sherpa-onnx-streaming-paraformer-bilingual-zh-en/
    ├── encoder.int8.onnx
    ├── decoder.int8.onnx
    └── tokens.txt
```

The model is intentionally not committed or redistributed by this repository. Download
the model from the sherpa-onnx release referenced by the original Expression Trainer:

https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-paraformer-bilingual-zh-en.tar.bz2

Before commercial redistribution, verify the license and training-data provenance for the
specific model artifact. The Apache-2.0 license of the sherpa-onnx engine does not by itself
settle the license of every pretrained model weight.
