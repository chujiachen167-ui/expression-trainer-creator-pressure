# Use the upstream diagnostic core beneath creator-specific training surfaces

Expression Trainer · Creator Pressure inherits the Electron, offline STT, lexicon, model-provider, prompt, and report runtime from `fxy2311-youyou/expression-trainer` instead of maintaining a second browser-only diagnostic implementation. V1, V2, and V3 remain creator-specific training surfaces: Electron uses the inherited core, while a browser may use an explicit degraded demo adapter. This keeps the vertical product boundary without forking the meaning of transcription, expression analysis, or AI feedback.
