# Third-party notices

This inventory covers code and services currently shipped, adapted, dynamically loaded,
or deliberately referenced by Expression Trainer · Creator Pressure. It is an engineering
compliance record, not legal advice.

## Shipped or adapted code

### Expression Trainer

- Source: https://github.com/fxy2311-youyou/expression-trainer
- Version inherited: commit `f925434`
- License: MIT
- Copyright: Copyright (c) 2026 Sisi
- Use: Electron runtime, Sherpa-ONNX adapter, lexicon analysis, multi-provider AI feedback,
  report prompts, model settings, and training-rule editor.
- Notice: The required copyright and MIT permission text are retained in `LICENSE`.

### Electron

- Source: https://github.com/electron/electron
- Package: `electron`
- License: MIT
- Use: desktop application runtime and secure renderer/main-process bridge.

### sherpa-onnx

- Source: https://github.com/k2-fsa/sherpa-onnx
- Package: `sherpa-onnx-node`
- License for engine source and runtime: Apache License 2.0
- Use: local streaming speech recognition.
- Important model boundary: pretrained ONNX model files are not committed or redistributed
  by this repository. Model artifacts can carry terms distinct from the engine; verify the
  selected model and training-data provenance before redistributing or using it commercially.

### React Bits · Drift Wall

- Source: https://github.com/DavidHDev/react-bits
- Component: https://www.reactbits.dev/components/drift-wall
- License: MIT + Commons Clause License Condition v1.0
- Copyright: Copyright (c) 2026 David Haz
- Use: adapted inside the V2 avatar-selection preview as part of this application.
- Restriction: the component must not be sold, sublicensed, or redistributed by itself,
  in a component bundle, or as a standalone port. It is not exposed as a reusable package.

The upstream condition states that the software may be used, including commercially, as
part of an application, website, or product, while prohibiting sale, sublicense, or
redistribution of the components themselves. See the upstream license for the controlling
text: https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md

## Optional external runtime

### LiveTalking

- Source: https://github.com/lipku/LiveTalking
- License: Apache License 2.0
- Use: optional external WebRTC digital-human provider. LiveTalking code, models, avatars,
  and runtime assets are not bundled in this repository.
- Operators must review the licenses of the face, voice, TTS, lip-sync, and model assets
  they configure in their own LiveTalking deployment.

## Data and runtime media

### Dalian University of Technology sentiment ontology-derived data

- Provenance declared by the inherited project: 大连理工大学情感词汇本体库.
- Files: `data/emotion-lexicon.json`, `data/tiered-lexicon.json`.
- Use: selected and manually calibrated expression-training vocabulary inherited from the
  MIT-licensed upstream repository.
- Review status: the upstream repository does not include a separate dataset license.
  Treat redistribution and commercial use of the derived lexicon as requiring provenance
  review before production release.

### Picsum Photos preview images

- Source: https://picsum.photos/
- Use: images are loaded remotely at runtime in the Drift Wall development preview and are
  not stored in this repository.
- Production rule: replace them with owned or explicitly licensed avatar assets before a
  public commercial release; image rights remain subject to their original sources.

## Design references only — no source code incorporated

The following projects informed general layout or interaction patterns. Their source code
and brand assets are not copied into this repository:

- LiveKit Meet — Apache-2.0 — https://github.com/livekit-examples/meet
- OpenCut — MIT — https://github.com/OpenCut-app/OpenCut
- shadcn/ui — MIT — https://github.com/shadcn-ui/ui
- Umami — MIT — https://github.com/umami-software/umami
