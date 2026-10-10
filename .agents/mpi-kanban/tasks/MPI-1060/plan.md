# MPI-1060 - LTX 2.3 Reference to Video (Ingredients IC-LoRA) as an op on the LTX 2.3 model

## Current State

Project mode: scalable-foundation.

**Proven (2026-10-10, `research/results.md`):** Lightricks' LTX-2.3 Ingredients IC-LoRA
(`ltx-2.3-22b-ic-lora-ingredients-0.9.safetensors`, 1,308,778,338 B, gated HF repo, auto-approval, LTX-2.x
community licence) runs on OUR shipped int8 stack with no dev checkpoint and no distilled LoRA. One composite
sheet image, repeated to the clip length, enters as a full-clip IC guide. Fabio: "looks amazing, do it now".
Bench: `G:\ComfyUi` :8188 (shared with other sessions; always under `gpu_lease.py`), weights in `C:\AI`.

**Fabio's constraints:** an option ON the LTX 2.3 model, a second path in the EXISTING workflow (no new model
workflow), ready for LTX 2.5 by re-pointing loaders. Handoffs between sessions until shipped.

**Investigation (3 read-only agents, 2026-10-10), the facts the plan rests on:**
- Workflow: `comfy_workflows/raw/ltx_i2v_t2v_template.json` (LiteGraph, 216 nodes, no subgraphs) is the ONE
  source; `generate_ltx.py` stamps `ltx_i2v_t2v.json` (High, bf16) and `ltx_i2v_t2v_int8.json` (Balanced).
  Sync: `COMFY_URL=http://127.0.0.1:48188 node scripts/sync-raw-workflows.mjs` (own isolated app engine,
  never :3000; it auto-commits the raw file and refuses on uncommitted generated files).
- Branches are FILL-driven (media `loaded` outputs), not op booleans. Stage 1 at half size, latent upsampler,
  stage 2. Insertion design (graph agent, node ids = raw = API):
  - `Input_Image` MpiLoadImage (`block_if_empty` False); its `loaded` gates everything.
  - IC LoRA after `191` Transition Lora, lazily behind an MpiIfElse, re-pointing `Set_model #522`, so both
    stages and the ID-LoRA path get it. Baking `latent_downscale_factor=1` (file metadata says 1) allows
    `MpiLoraModel` whose None/0 skips the load.
  - Sheet -> resize (pad, black) -> `RepeatImageBatch(amount <- #76 frames)`.
  - Stage-1 guide on `212`/`143` at the source via Packer/IfElse/Unpacker, so crops `46`/`334` remove the IC
    frames before `568`/`123`.
  - Stage-2 guide (lipdub pattern) re-added on `586`/`123` + a new `LTXVCropGuides` into `349.false`; A/B it
    against "IC model at stage 2, no guide" (inpaint pattern, cheaper).
  - Traps: amount must equal #76; `#70` LTXVNormalizingSampler scales guide frames x1.1; a continue run must
    re-inject the sheet; mode-4 bypass is not a runtime toggle; preview tail shows one ref frame (cosmetic).
- Op: reuse **`ref2v_ms`** ("Reference to Video", short `ref2v`, Finish-only, `modelSizedInputs`). Free:
  strip position, release:check registration, the enhancer's `^ref2v -> r2v` mode, agent task `ref2v`. Must
  NARROW its 15 H3 slots per model with `requiresCapability` (precedent: cloud `edit` op), add
  `help.byModel.ltx`, `modelPriority` REF2V + NOTES, `ROLE_USE` text. Append `ref2v_ms` LAST in `supportedOps`.
- Deps: a model's deps are all-or-nothing (per-op `operations{}` groups were retired 2026-08-07 with their
  install UI). A flat dep makes existing LTX installs read "not installed" until the file lands. Only Flows and
  Plugins carry opt-in `requiredDeps`. Precedent on THIS model: talkvid 1.08 GB and transition 372 MB are flat.
  A missing LoRA baked into the shared graph fails EVERY LTX op at validation, so the filename must be
  injected on the ref op only, or the file must be a model dep.
- Weight hosting: `loras/ltx-2.3/` on R2 (`models.cubric.studio`); gated upstream means no `mirrorUrl` unless we
  re-host on HF `Mad-Pony-Interactive/cubric-studio` (foley precedent, MPI-679). R2 + HF upload need Fabio's yes.
- Agents: `describe_model`/`read_knowledge` read one catalogue; guide `docs/agent/models/ltx-2.3.md`; recipe
  `js/data/recipes/ltx-2.3.recipe.js` has only `t2v` (r2v would silently fall back). Child-safety gate already
  covers every LTX op, two-part prompt included.
- Claims: MPI-1056 holds `docs/releases/UNRELEASED.md`, `js/services/llmService.js` (not needed if the op key
  starts `ref2v`). Nothing else this plan touches is live-claimed.

**Where it stands (handoff 2026-10-10, session "LTX 2.3 reference 1"):**
- Phase 1 single-stage combos DONE (results.md). Phase 1 two-stage proof BUILT, NOT RUN:
  `research/bench-tools/two_stage_run.py` (7 cases, `--check` builds all offline). Run it under the lease once
  `C:/AI/loras/ltx-2.3/LTX23_softenhance_abliterated_detailer_merged.safetensors` (3,869,749,848 B, sha 3c5f9a7f...)
  is fully present; the shipped graph validates against every other file already (transition LoRA + x2 upscaler +
  taeltx2_3 hash-checked; Ingredients + talkvid LoRAs must ALSO sit under `C:/AI/loras/ltx-2.3/` with the shipped
  `ltx-2.3\...` names - copy them from `C:/AI/loras/LTX2.3/` first).
- Phase 3 R2 upload of the Ingredients LoRA started 15:26 (rclone, 3 MB/s). Upstream sha256 PROVEN equal to our copy
  (`515e4e139001ac6282357a5b35372e42e98b3affd5fcc886a52242abeed19559`, HF lfs). Verify landed with
  `curl -sIL https://models.cubric.studio/vision/models/loras/ltx-2.3/ltx-2.3-22b-ic-lora-ingredients-0.9.safetensors`
  (content-length 1308778338). HF re-host + `loraDeps.js` entry + model deps NOT done (land the deps WITH the graph,
  Phase 4, so Fabio's live app never shows LTX "not installed" for a dep no graph uses yet).
- Scope: ONLY Reference to Video on the LTX 2.3 model. Video Edit + LTX (card MPI-1061) is owned by session
  "Video edit 17" under its Video Edit umbrella - do not touch it.

## Decisions (all four DECIDED by Fabio, 2026-10-10)

- **D1 weight delivery: (a) flat dep on both LTX cards** - everyone downloads +1.31 GB, existing installs fetch
  it once (same as talkvid/transition). Not chosen: (b) revive per-op install groups + their UI (the scalable
  answer once a 2nd IC-LoRA op arrives: 2.5 ships 17 IC-LoRAs) - follow-up card; (c) a Flow (Fabio wants it on
  the model).
- **D2 LTX ref inputs: reference pictures (required, composed into one sheet, see D3) + optional start frame +
  optional audio** (lip-sync to it, or clone its voice, via the existing audioMode). Proven by Phase 1 combos. No
  video reference (a video guide is copied, not referenced).
- **D3 sheet input: DECIDED 2026-10-10 (Fabio): the app accepts several pictures and composes the sheet itself**,
  like Nano Banana's collage (MPI-919, `routes/deepinfraCollage.js` `buildCollage`, capability
  `referenceCollage`). Pick (agent): a sibling sharp composer with Ingredients rules (black background, each picture
  CONTAINED never cropped, bigger cells for the first/character pictures, a "where is which picture" preamble for
  the prompt), composed before upload so the local engine and the Pod get one file. A single ready sheet is just
  the one-picture case. Bench evidence: a back-view panel leaked as a 2nd figure (own_fisher), so layout rules
  get a bench pass before they ship.
- **D4: yes** to R2 upload + HF re-host of the LoRA (outward-facing; R2 storage ~1.3 GB, about $0.02/month).

## Completed

- [x] Phase 0: bench proof on Lightricks' example sheet, two sizes (`research/results.md`).
- [x] Investigation: op wiring, graph insertion, deps/agents/docs (summarised above).

## Remaining Work

## Phase 1: Bench answers (investigation, no repo code)

- [ ] Own sheets + combos via `research/bench-tools/ingredients_run.py`: `own_woman`, `own_fisher`,
  `combo_start` (sheet + start frame), `combo_audio` (sheet + supplied audio), `combo_idlora` (sheet + voice
  clone), `ref_video` (a clip as the guide). **Verify:** each clip saved in `C:\AI\MPI-1060-out\`, inspected
  frame-by-frame by the agent, results table in `research/results.md`, sent to Fabio as VP9 WebM.
- [ ] Two-stage proof: a bench copy of the shipped `ltx_i2v_t2v_int8.json` with the Phase-4 insertion applied
  (API-level, scripted), A/B stage-2 guide vs no stage-2 guide, plus t2v/i2v with no sheet. **Verify:** ref
  clip holds the sheet; no-sheet runs reproduce the shipped graph's output for the same seed (frame hash).

## Phase 2: Decisions D1-D4 from Fabio

- [x] Recorded in `## Decisions` (2026-10-10). No open decision left.

## Phase 2b: Sheet composer (D3)

- [ ] Layout bench first: 2-4 of our pictures (character front + close-up, a location, a prop) composed on black,
  contained, character cells biggest; compare against the leak case (back view in). **Verify:** clips inspected;
  chosen layout written into `research/results.md`.
- [ ] Composer module next to `routes/deepinfraCollage.js` (shared sharp helpers, Ingredients rules, preamble
  naming each cell), wired where local-engine media is staged so the graph receives ONE `Input_Image` file.
  **Verify:** unit test on cell geometry + preamble (`node --test`), one-picture case passes the file through.

## Phase 3: Weight delivery (after D1/D4)

- [ ] R2 upload to `vision/models/loras/ltx-2.3/`, HF re-host, `loraDeps.js` entry (sizes/sha via the scripts),
  model `dependencies` per D1. **Verify:** `curl -sIL` content-length == 1308778338, sha256 matches,
  `npm run release:deps`.

## Phase 4: Graph (raw template -> both variants)

- [ ] Edit `comfy_workflows/raw/ltx_i2v_t2v_template.json` per the insertion design + the Phase-1 A/B winner;
  sync through an isolated app engine. **Verify:** `tests/inject-params-titles.test.cjs`,
  `tests/workflow-media-slots.test.cjs`, `tests/optional-media-placeholder.test.cjs` green; bench run of the
  generated int8 file: t2v/i2v unchanged (frame hash vs pre-change), ref branch works.

## Parallel Batch: App wiring + agent knowledge (after Phase 4)

- [ ] App wiring. Ownership: `js/data/modelConstants/models.js`, `js/data/commandRegistry.js`,
  `js/data/modelConstants/modelPriority.js`, `routes/connector.js` (ROLE_USE only), `js/data/progressStages.js`,
  tests `ref-tag-picker`, `connector-agent-tools`, `model-priority`, `engine-input-cap`, `inject-params-titles`.
  Briefings: `comfy_injection`, `components`, Critical Rules Snapshot. **Verify:** `node --test` on those tests +
  `npm run release:check` green.
- [ ] Agent knowledge + enhancer. Ownership: `js/data/recipes/ltx-2.3.recipe.js` (new `r2v` mode, two-part
  "Reference sheet / Generated video" prompt), `docs/agent/models/ltx-2.3.md` (+ optional
  `docs/agent/models/ltx-2.3/reference-sheet.md`). Briefings: `engine-recipes`. **Verify:** `node --test
  tests/agent-corpus.test.cjs tests/model-priority.test.cjs tests/agent-prompt-budget.test.cjs`; recipe sweep
  per `/create-enhancer-recipe` (cost stated to Fabio first).

Batch is safe: disjoint files; the only shared contract is the op key `ref2v_ms` + slot keys, fixed in Phase 4.
Run with `mpi-execute-parallel` only if both are ready at once; otherwise sequential in one session.

## Phase 5: Live verification (user-ux)

- [ ] Own `npm run app:isolated` (own profile + port, `CUBRIC_MODELS_ROOT` pointing at the weights), run Reference
  to Video from the prompt box and over `/connector/generate`; `node scripts/smoke-workflows.mjs --models
  ltx-23-balanced` (plan first). **Verify:** a card lands with history + sidecar; Fabio's eye-test in the app.

## Phase 6: Docs + release notes

- [ ] `docs/models/ltx/reference-ingredients.md` (new, <=200 lines), `model-set.md` + `tested-loras-versions.md`
  entries, `docs/releases/UNRELEASED.md` line (coordinate with MPI-1056's claim). **Verify:** docs routed from
  `docs/README.md`; no doc over 200 lines.

## Plan Drift

- 2026-10-10: card scope grew from "bench-test" to "ship as an op" on Fabio's go; plan written then.
- 2026-10-10: Phase 1 combos done (results.md): start frame, supplied audio, voice clone all compose; a VIDEO as
  the guide is copied, not referenced (so Ingredients cannot edit an existing video). D3 decided: app composes the
  sheet from several pictures. Needs a composer task (server, sharp) + a layout bench pass before Phase 4.

## Verification

**Verify mode:** user-ux (Phase 1 clips and Phase 5 are Fabio's eye-test; everything else is agent-verified).

End to end: on both LTX cards the op strip shows Reference to Video; one sheet (plus optional start frame/audio
per D2) produces a clip that keeps the sheet's character; t2v and i2v outputs are unchanged for the same seed;
`npm run release:check` and the touched tests are green; agents see the op in `describe_model` with the sheet
role and write the two-part prompt.

## Preservation Notes

- LTX 2.5 prep: keep the IC branch model-agnostic (LoRA name + loaders are the only 2.3-specific values) so 2.5
  is a re-point; note it in the new docs file.
- Follow-up card candidates: per-op install groups (D1b), multi-picture sheet composer (D3), H3 vs Ingredients
  comparison (paid, ask first), preview-tail ref frame (cosmetic).
- Bench weights in `C:\AI` (~35 GB) are bench-only; say so at close-out.
