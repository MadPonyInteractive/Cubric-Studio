# MPI-936 - Qwen-Image 2.1 as a non-commercial model behind a licence gate

## Decision (Fabio, 2026-09-26)

Ship Qwen-Image 2.1 despite the research licence: warn the user it cannot be used
commercially, a visible non-commercial badge on the model, and a licence gate in the
`MODEL_LICENCES` / MpiLicenceGate path the same way Klein 9B does
(`js/data/modelConstants/licences.js`). This reverses the 2026-09-22 "no card until Alibaba
replies" posture; the commercial-licence email to Alibaba stays open and, if it lands, the gate
text changes (bump the descriptor `version`).

Prompted by a competitor community preset pack that ships the model labelled
"Qwen Research Licence, non-commercial use only".

## The model

Qwen-Image 2.1 (released 2026-09-20): 7B, text-to-image AND editing in one model, up to 10
reference images, native transparent (RGBA) output. ComfyUI core supports it from 0.37.0, so
this likely rides on an engine bump (`/mpi-bump-engine`) first. Wiring: `/mpi-add-model`.

## Licence facts the gate text must match (Qwen RESEARCH License Agreement, HF `LICENSE`)

- §2(a): use / reproduce / distribute / modify "FOR NON-COMMERCIAL PURPOSES ONLY".
- §1: Non-Commercial = "research or evaluation purposes only".
- **No Outputs clause.** Unlike Klein 9B (FLUX NC frees the IMAGES), images made with this
  model are NOT commercially usable either. The Klein description line "the IMAGES you make
  stay commercially usable" must NOT be copied.
- **Wording: "research or evaluation only, no commercial use"** - the licence's own terms.
  Do NOT say "personal use": it is not in the grant (Fabio dropped it 2026-09-26).
- §3(a): recipients get a copy of the agreement -> bundle it under `licences/<id>/`
  (root-relative `licenceUrl`, per the descriptor doc).
- §3(c): the attribution notice "Qwen is licensed under the Qwen RESEARCH LICENSE AGREEMENT,
  Copyright (c) 2026 Hangzhou Tongyi Laboratory Technology Co., Ltd." -> `poweredBy` /
  model drawer.
- Commercial contact: model-business@notice.qwencloud.com.

## Parked (2026-09-26)

`deferred`: needs the ComfyUI 0.37 engine, and bumping before v2.0 is undecided. Unpark when
the engine bump lands.

## Weights source (decided 2026-09-26)

- **Main transformer: NOT on R2.** Downloaded straight from Qwen's own HF repo
  (`Qwen/Qwen-Image-2.1` or a Comfy-Org repack of THAT weight - check its licence carries over).
  We never redistribute the research-licensed weight.
- **Everything else (text encoder, VAE, ...) on R2 as usual** - but verify each one's own
  licence first (the Qwen3-VL encoder must be Apache-2.0 or similar, not the research
  licence) before re-hosting.

## Open questions for the build

1. Which quant fits (competitor pack uses an INT8 7B + Qwen3-VL 8B encoder, ~17 GB) - and does
   a quant exist from a source whose licence lets users fetch it without us re-hosting?
2. Ops: t2i, edit with refs, transparent output - map onto existing op types.

## Not in scope

Hosted `Qwen-Image-Max` on DeepInfra (priced and rejected 2026-09-22).
