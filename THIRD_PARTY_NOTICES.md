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
- Full license: `vendor/react-bits/LICENSE.md` (retrieved 2026-08-31).
- Use: adapted inside the V2 avatar-selection preview as part of this application.
- Restriction: the component must not be sold, sublicensed, or redistributed by itself,
  in a component bundle, or as a standalone port. It is not exposed as a reusable package.

The upstream condition states that the software may be used, including commercially, as
part of an application, website, or product, while prohibiting sale, sublicense, or
redistribution of the components themselves. See the upstream license for the controlling
text: https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md

### React Bits · Scroll Expand

- Source: https://github.com/DavidHDev/react-bits
- Component: https://www.reactbits.dev/animations/scroll-expand
- License: MIT + Commons Clause License Condition v1.0
- Copyright: Copyright (c) 2026 David Haz
- Use: adapted inside the launcher-to-training transition. This repository uses a local,
  non-React implementation of the upstream component's expansion mechanism; it does not
  redistribute the component as a standalone package.

### Codrops · Async Page Transitions

- Source: https://tympanus.net/codrops/2026/02/26/building-async-page-transitions-in-vanilla-javascript/
- License: MIT (Codrops downloadable demos, unless stated otherwise)
- Use: the background-handoff and `clip-path` reveal mechanism informed the local,
  dependency-free transition between the launcher and V1/V2/V3. It is adapted to this
  application's separate static pages and is not bundled as a standalone demo.

### Magic UI · Marquee (shipped adaptation)

- Source: https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/marquee.tsx
- Official registry snapshot consulted: https://magicui.design/r/marquee.json (2026-08-31)
- Component: https://magicui.design/docs/components/marquee
- License: MIT; Copyright (c) Magic UI. Full permission and warranty text: `vendor/magic-ui/LICENSE`.
- Local files: `vendor/magic-ui/marquee.js`, `vendor/magic-ui/marquee.css`.
- Adaptation: React/Tailwind repeated flex groups and per-group translate-by-size-plus-gap
  are ported to vanilla DOM/CSS for the launcher. Reverse, pauseOnHover, repeat,
  duration and gap are retained; the launcher fixes vertical=true. Added accessible
  duplicate hiding, persistent pause, reduced-motion fallback, and QA integration.
- No React dependency, network-loaded code, review-card styling, or stock avatar media
  from the upstream demo is included.

### React Bits · Warp Text and True Focus (shipped adaptations)

- Source: https://github.com/DavidHDev/react-bits
- Components: https://www.reactbits.dev/text-animations/warp-text and
  https://www.reactbits.dev/text-animations/true-focus
- License: MIT + Commons Clause License Condition v1.0
- Copyright: Copyright (c) 2026 David Haz
- Use: the launcher subtitle uses a dependency-free WebGL2 translation of the Warp Text
  pointer lens; the Read Yourself title uses a native DOM translation of True Focus.
- Adaptation boundary: the repository does not ship React, Motion, OGL, or a reusable
  React Bits package. The source text remains semantic and editable, with a normal-text
  fallback when WebGL2 is unavailable. The upstream license controls the adapted code.

### Codrops · Gooey Text Hover Effect (shipped adaptation)

- Source: https://github.com/codrops/GooeyTextHoverEffect
- Demo: https://tympanus.net/Development/GooeyTextHoverEffect/
- License: MIT
- Copyright: Copyright (c) 2009 - 2020 Codrops
- Full license: `vendor/codrops/GooeyTextHoverEffect.LICENSE`.
- Use: the launcher's transcript pairs use the SVG filter idea for a hover/focus
  transition from an informal phrase to its more concise creator-facing expression.
- Adaptation: `src/index.html` and `src/js/demo1/menuItem.js` from the upstream
  repository (retrieved 2026-08-31). Local DOM/RAF code preserves the shared-group
  blur/crossfade and filter removal at both endpoints. The radius and alpha threshold
  are adjusted for body-size Chinese text; no GSAP or upstream demo assets are bundled.

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

Development-only tests additionally use `jsdom` (MIT, https://github.com/jsdom/jsdom).
It is a devDependency used for non-rendering DOM/configuration assertions; it is not
loaded by the application or a replacement for real visual/browser verification.

### Radix Colors

- Source: https://github.com/radix-ui/colors
- License: MIT
- Use: five local theme presets map selected Radix dark-scale values to this
  project's existing global and V3 Studio color tokens. No Radix package or
  source code is bundled at runtime.

The following projects informed general layout or interaction patterns. Their source code
and brand assets are not copied into this repository:

- LiveKit Meet — Apache-2.0 — https://github.com/livekit-examples/meet
- OpenCut — MIT — https://github.com/OpenCut-app/OpenCut
- shadcn/ui — MIT — https://github.com/shadcn-ui/ui
- Umami — MIT — https://github.com/umami-software/umami
