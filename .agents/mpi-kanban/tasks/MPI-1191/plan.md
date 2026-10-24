# MPI-1191 Keyframes to Video Flow on LTX 2.5 (launches in the LTX 2.5 release, MPI-1267)

## Current State

- 2026-10-24 ("LTX 2.5 model 10"): Fabio: this Flow launches WITH LTX 2.5 (the LTX 2.5 release, MPI-1267); Infinite Video
  (MPI-1134) follows. Research done: `research/outside.md` (official + community), inside findings below.
  Plan written, waits on Fabio's go and the four calls in § Open calls. Nothing built, no GPU run yet.

## What the research settled

- No official N>2 keyframe template exists. The official 2.5 first+last graph (core blueprint
  "First & Last Frame to Video (LTX-2.5)") is two chained core `LTXVAddGuide` at 0.7, before
  `LTXVConcatAVLatent`. N keys = N chained guides. Shipped engine (core v0.42.1, ComfyUI-LTXVideo
  pin `3b9c5cde`) needs NO bump.
- Our 2.5 checkpoint DOES carry the learned keyframe embedding (`use_keyframes_abs_pos_embedding: true`
  in the safetensors config, tensor `keyframes_abs_pos_embedding`), but the core mask
  (`comfy/ldm/lightricks/model.py:1187-1197`) excludes appended guide tokens, so whether a user picture
  at idx > 0 gets it is unclear. The bench decides; no marketing claim until then.
- Our `ltx25_i2v_t2v.json` already chains guides in BOTH stages (#321/#322 S1, #323/#324 S2, strength
  0.7, not injectable); start-only i2v uses `LTXVImgToVideoInplace` (strength 1), not a guide.
- No Flow takes a variable ordered picture list or a per-picture value today. Usable pieces: media group
  `{type:'image', mode:'upto', max:N, roles}` (`02-media-io.md`), per-slot fields with
  `hiddenWhen:{media, present:false}`, fixed-maximum optional-slot nodes (`MpiH3References`,
  `MpiFlux3References`). FlowDef has no `devOnly` and NO Flow gate exists today (`research/flow-machinery.md`; MPI-1231 adds one). Old note, wrong: the gate was the `APP_CONFIG.dev_mode ? [...] : []`
  spread in `FLOWS` (make-seamless precedent, removed in `138615734`).
- Traps: output drops frame 0 (#485), so a key at latent frame f shows at output f-1; `Input_Duration`
  is whole seconds only; `Input_is_Turbo` is baked `true` in the JSON while the card defaults OFF (the
  Flow must declare it); 2.5 LoRA titles are flat `Input_Lora_1..6`; a graph captured from engine
  history loses its staged picture and silently runs as t2v (`docs/models/ltx/ltx-2.5.md`).

## Build choice

Option B of three (A = static graph with K gated guide chains, huge lattice; C = app-side graph patch,
untestable and cannot ship in a Flow package): **one new MpiNodes node, `MpiLTXVAddGuides`**: up to 8
optional images, their pixel frame positions, an ends strength and a middles strength; skips empty
slots (the `is_blank_image` sentinel), resolves positions to the 8-grid, calls core `LTXVAddGuide` in a
loop. One node per stage. Precedent: the delegate pattern of `MpiH3ImageToVideo` / `MpiFlux3References`.

## Phases

- [ ] **0. Bench on the G: bench ComfyUI (GPU, local, Fabio's yes; no money).** Hand-chained core
  guides on a copy of the 2.5 raw, medium tier, 5 s. Arms: 3 photo keys; 5 photo keys; ~8 drawn
  line-art keys (style holds or turns photoreal?). Per arm: ends 0.7 / middles 0.5 vs all 0.7, and
  key 0 as a 0.7 guide vs the Inplace lock. ~10 runs at ~2 min. **Verify:** SSIM of each key against
  its output frame (f-1), no brightness flash at the keys, Fabio's eye on the clips; record in
  `validation.md`. A fail on drawn keys = the Flow ships for photos/3D renders only, or stops here.
- [ ] **1. Node** via `/mpi-nodes-sync` (sibling repo procedures): `MpiLTXVAddGuides`, unit test in the
  sibling, committed -> pushed -> pinned in `dev_configs/node_lock.json`.
- [ ] **2. Graph** on the bench: `raw/ltx25_keyframes_template.json` from the 2.5 raw, FLF lattice
  replaced by the node in S1 and S2, a frame-count input (snap `floor((a-1)/8)*8+1`) instead of
  `Input_Duration`, Turbo/VAE switch kept. Convert, injection gate, generator + registry row, progress row.
- [ ] **3. Flow** via `/mpi-add-flow`: `ltx-keyframes`, dev-gated spread, requires `ltx-25`; media
  group up to 8 pictures in order; one slider per picture ("how long until the next", hidden when the
  slot is empty), the total shown and snapped to the grid; one prompt + Avoid; Turbo; resolution;
  enhancer on the `ltx-2.5` i2v recipe if it fits. Agent knowledge page.
- [ ] **4. Verify** in `npm run app:isolated` (own profile + port, never :3000): 2, 3, 5 and 8 keys
  land; empty slots skipped; cancel works; Fabio's eye-test.
- [ ] **5. Launch kit:** `/mpi-flow-graphics` (tile + hero), UNRELEASED roster line + entry for the LTX 2.5 release.
  The dev gate comes off with LTX 2.5's (MPI-1266), never in 2.1.3.

## Open calls (Fabio)

1. LTX 2.5 only at launch; the 2.3 and H3 arms the card named come later. My pick: yes.
2. Up to 8 pictures. My pick: 8 (enough for key poses in 5-10 s; more = more tokens and failures).
3. Slider unit: seconds per picture in 1/3 s steps (= 8 frames, the grid). My pick: that.
4. Phase 0 bench go-ahead (~10 local runs, ~20 min GPU under the lease).

## Plan Drift

- 2026-10-24: card brief named LTX 2.3 + H3; Fabio's launch target makes it LTX 2.5 first.

## Verification

**Verify mode:** user-ux

Phase 0 and 4 need Fabio's eyes; phases 1-3 self-verify (`npm run lint`, `npm test`, the sibling's tests,
the injection gate).
