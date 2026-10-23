# MPI-1095 stage 1: retire LTX 2.3 High, land LTX 2.5 (int8, dev-gated)

## Current State

- 2026-10-23 ("LTX 2.5 model 9"): Stage 1 DONE. r2v Part 2 item 3: the beat never stops at the
  contact, the taker moves on with the result in the same sentence. `--ref-tiers` TWICE GREEN
  (r2vref-3 ALL PASS, r2vref-4 24/24 after harness theft regex + `getaway`). All four modes twice
  green; `docs/recipes/research/ltx-2.5/validation.md` written (final prompts, iterations, 3 known
  limits). Spend ~22.5 of 25 cents. Recipe stays `draft`. NEXT: Fabio's Stage 2 renders from
  validation.md; then Stage 2 of the card (2.5 in the LTX Flows). Thufpik-in-picture-line: two
  rewordings tried on Fabio's yes (r2vref-5/6, ~3 cents), neither held, both reverted; a known limit.
  Fabio 2026-10-23: KEEP `devOnly: true` - the next release (2.1.3) does NOT ship LTX 2.5; it ships in
  2.1.4. NEXT session: sweep Remaining Work for what is left (Stage 2 Flows, second route for the 2.5
  deps, unmeasured `high` 1536x896, `M:/_stage/mpi1095` cleanup) and close out if nothing is doable now.
- 2026-10-23 ("LTX 2.5 model 8"): Stage 1 sweeps on DeepInfra Gemma 4 26B (judge local gemma3:12b, under
  the GPU lease; runner `scratchpad/sweep.sh`, outputs `scratchpad/<mode>-<n>.txt` of session 143ec54f).
  Fixes, all in `ltx-2.5.recipe.js` (uncommitted): CAMERA_RULE bans invented dolly/push/pan/track +
  "towards the camera" = subject moves, camera static (+ dog example); JOBS sparse = camera static;
  CONDENSE "a ninth sentence means you kept too much"; i2v renamed subject takes the FRAME's word
  ("hamster"); r2v Part 2: infer unrecognised words, framing as prose not tags, crash zoom = fast,
  nothing attached = scene only; r2v `lengthNorm` corrected to measured ~100-210. Harness
  `scripts/recipe-test.mjs:225` theft regex + `retreats` (26B wrote "grabs ... retreats with its prize").
  t2v TWICE GREEN (t2v-4, t2v-5). r2v TWICE GREEN (r2v-2, r2v-3). i2v TWICE GREEN (i2v-3, i2v-5). r2v --ref-tiers NOT twice green: r2vref-1 24/24 (rescored, regex + `retreats`), r2vref-2
  seen-beach 1/3 = one regex miss ("disappears with the fruit", regex now + `disappears`) and one REAL miss
  ("scurries into the frame as it grabs a bright orange." - no getaway; Part 2 item 3 "where it ends up"
  not held). Next: make item 3's end beat land (the taker LEAVES with it) and re-run --ref-tiers twice.
  KNOWN LIMIT for validation.md: i2v frame-none (describer failed) invents "golden retriever" 3/3 despite
  "give it no appearance"; a stronger rule failed too (i2v-4) and was reverted. r2v picks a slow dolly-in
  13/15 when no move given (allowed, monotone). Spend: ~13 sweeps ~19.5 cents of the 25 cap.
  NEXT: read the 3 confirming sweeps, write `docs/recipes/research/ltx-2.5/validation.md` (final prompt per
  tier from the last green sweep), npm test + lint, commit, hand prompts to Fabio for Stage 2.
- 2026-10-23 ("LTX 2.5 model 7"): Fabio PASSED Turbo on/off in his app (validation.md: OFF/DiffVAE barely morphs
  floor tiles, ON/conv morphs a lot, +35 s at 704x1216); ladder confirmed. Fabio: LTX 2.5 gets its OWN
  `ltx-2.5.recipe.js`. DONE, uncommitted: research (`docs/recipes/research/ltx-2.5/`), draft recipe (t2v from
  gemma4_t2v, i2v from gemma4_i2v with `seesPictures`, r2v = 2.3's validated picture block sliced in + 2.5
  scene rules), registry + `ltx-25.enhanceRecipe`, `withFrameLooks` (registry) used by `enhance()` for i2v,
  harness `frameInputs()` i2v tiers, Cosmo guide `docs/agent/models/ltx-2.5.md` (2.3 guide no longer claims
  2.5). `npm test` 3558/0, lint clean. NEXT: Stage 1 sweeps (Fabio YES 2026-10-23: DeepInfra, up to 25 cents total),
  t2v + i2v + r2v (`--ref-tiers`) each twice green on DeepInfra Gemma 4 26B; then validation.md + close-out.
- 2026-10-23 ("LTX 2.5 model 6"): DiffVAE A/B won (steadier scales); Fabio's Turbo switch wired (OFF =
  DiffVAE default, ON = conv), DiffVAE on R2, in-app Turbo on/off check passed, own tooltip, docs page
  `docs/models/ltx/ltx-2.5.md`. All pushed (`4a84bb974`, `5c26fcc75`, `036f09079`). Card is devOnly (verified:
  `MODELS` filter on `APP_CONFIG.dev_mode`). Fabio is testing Turbo on/off in the app himself. NEXT: his
  verdict, then the LTX 2.5 enhancer-recipe question (Remaining Work, NEW), then close-out.
- 2026-10-22 ("LTX 2.5 model 5"): stage-1 code committed, in-app GPU check passed, all six 2.5 deps on R2,
  LTX ladder moved down one rung (`422b0aca3`). NEXT: the DiffVAE A/B (Remaining Work, Fabio's yes for that
  one run), then Fabio's raw review, the `docs/models/ltx/` 2.5 page, close-out. Fabio is also shooting 4K
  showcase clips on a 5090 Pod for the download-library overlay (10-30 s); his 2K dinosaur morphed its scales.
- Research + benches DONE (`research/findings.md`). Fabio 2026-10-22: 2.5 wins on acting (~35-40% faster);
  official Gemma 4 int8 encoder (heretic dropped); both audio modes (Reference clone, Original lip-sync) work on
  2.5 with NO extra LoRA; 2.3 High (bf16) DEPRECATED after the tier bench.
- 2.5 stack proven on the bench (`research/bench/ltx25_bench.py`, variant `25`): the shipped int8 graph with
  6 loaders re-pointed, DualCLIPLoader -> CLIPLoader (Gemma 4 carries its projection), the 3 baked 2.3 LoRAs
  (Merged, Transition, talk ID) removed. Runs on the shipped engine (ComfyUI v0.42.1, ComfyUI-LTXVideo pin
  `3b9c5cde`): no engine or node bump.
- High is card `ltx-23` (bf16, `ltx_i2v_t2v.json`); Balanced is `ltx-23-balanced` (int8). Every LTX Flow already
  requires `ltx-23-balanced` only (`flowsRegistry.js`), so retiring High touches no Flow.
- `models.js` carries a peer's uncommitted MOSS hunks (MPI-1243): commit our hunks only
  (`~/.claude/memory/tools/git-shared-tree.md`).

## Implementation

- [ ] **A. Retire 2.3 High** (ships to users in 2.1.3), per `docs/playbooks/add-model/README.md` § Removing:
  `generate_ltx.py` drops the bf16 row, regen, `git rm comfy_workflows/ltx_i2v_t2v.json`; delete the `ltx-23`
  ModelDef; KEEP `ltx23-transformer-bf16` in `modelDeps.js`, marked DEPRECATED (the orphan sweep reclaims users'
  42 GB on their next uninstall); drop `ltx_i2v_t2v.json` from `progressStages.js`, the three `ltx-23` rows from
  `modelPriority.js`, `git rm` `ltx23_high_preview.mp4`; re-point the tests that use `ltx-23` as an exemplar
  (model-priority, model-update-check, resolve-model-deps, connector-agent-tools, cue-all-eligibility,
  routine-model, media-picker spec, optional-media-placeholder, llm-service, output-prompt-capture) to
  `ltx-23-balanced` / the int8 file; regenerate `services/agentBench/connector-models.json`; UNRELEASED changelog
  line. R2/HF copies of the bf16 stay up (default). **Verify:** `npm run lint` + `npm test` green; grep for
  `'ltx-23'` / `ltx_i2v_t2v.json` / `ltx23_high` finds only the deprecated dep and history.
- [ ] **B. Add `ltx-25`** through `/mpi-add-model` (its playbook governs every step):
  - Raw: copy `raw/ltx_i2v_t2v_template.json` in the G: ComfyUI canvas (I drive it in the browser pane on
    :8188, Fabio reviews), make exactly the bench's changes, save as `raw/ltx25_i2v_t2v_template.json`; a
    generator emits `ltx25_i2v_t2v.json`. Drop `Input_Use_Transition` with its LoRA and check what the audioMode
    control's injection does on a graph without it (`tests/inject-params-titles.test.cjs`).
  - Deps (new, `sha256` from the local copies): `ltx25-transformer-int8` 21.5 GB, `ltx25-gemma4-clip-int8`
    15.4 GB, `ltx25-video-vae-conv` 1.45 GB, `ltx25-audio-vae` 0.36 GB, `ltx25-spatial-upscaler` 1.0 GB,
    `ltx25-lora-ingredients` 1.3 GB. Reused: `ltx23-preview-taehv` ONLY if the preview test shows it decodes
    2.5 latents, else the latent-rgb fallback; `ComfyUI-LTXVideo`, `ComfyUI-MpiNodes`, `comfyui-kjnodes`.
  - ModelDef `ltx-25`: `devOnly: true`, `modelFamily: 'LTX-2.5'`, `name: 'LTX 2.5'`, `type: 'ltx'`, same
    capabilities and ops as Balanced (`t2v_ms`, `i2v_ms`, `ref2v_ms`, audio + routing, `referenceSheet`); int8
    only (no 2.5 High, no nvfp4: same reasoning that just retired 2.3 High). Live-counted `progressStages`;
    priority rows; the `ltx` enhancer recipe's guide (`docs/agent/models/ltx.md`) names 2.5; preview clip from
    the bench.
  - R2 upload of ~41 GB: **Fabio's yes first**. ~$0.62/month storage at R2's $0.015/GB-month, egress free;
    one upload. Until then the app tests from the local copies.
  **Verify:** `npm run lint` + `npm test`; `npm run app:isolated` (own profile + port, never :3000) with dev
  mode: 2.5 shows only in the dev build, and t2v, i2v start, i2v start+end, ref2v, Reference audio and Original
  audio each produce a clip with sound; preview -> Finish works; the High card is gone, Balanced still runs.

## Completed

- [x] A (2026-10-22, uncommitted): `ltx-23` card, `ltx_i2v_t2v.json`, `ltx23_high_preview.*` gone; bf16 dep
  kept DEPRECATED; priority rows + note removed; 10 tests re-pointed (Boogu is the twin-name example now);
  `connector-models.json` entry dropped (byte-exact round trip); agent guide + UNRELEASED `## Important` line.
  `progressStages` KEEPS the `ltx_i2v_t2v.json` key: `ltx_i2v_t2v_int8.json` normalizes to it.
- [x] B wiring (uncommitted): raw `raw/ltx25_i2v_t2v_template.json` made in the G: ComfyUI canvas (browser
  pane, graph API on a copy of the 2.3 raw; 228 nodes, 10 groups) -> converted, injection gate passes ->
  `generate_ltx25.py` (+ registry row) -> `ltx25_i2v_t2v.json`; diff vs the 2.3 int8 file = exactly the bench's
  changes. 6 deps (sha256 local = HF lfs oid, all 6), `ltx-25` ModelDef devOnly, progress row (same bars as
  2.3, NOT live-counted yet), rank 2 above 2.3 in t2v/i2v/ref2v + notes, guide names `ltx-25`, preview clip
  from `i2v_start_25`. lint + `npm test` green.

- [x] In-app GPU check (2026-10-22, "LTX 2.5 model 5"): all six ops on LTX 2.5 produce clips with sound,
  preview -> Finish works, bars match the progress row (uncached), `taeltx2_3` draws 2.5 previews, High
  gone, Balanced runs. Table: `validation.md`.

## Remaining Work

- Fabio reviews the raw in the G: ComfyUI (`ltx25_i2v_t2v_template`); if he changes it, re-copy to `raw/` and
  re-run convert -> gate -> `generate_ltx25.py`.
- 2.5 weights COPIED to `M:/CubricModels` 2026-10-22 (sizes match; no R2 yet).
- In-app GPU check DONE (see Completed). Any further GPU run: ask Fabio first.
- DiffVAE ("DFR", Fabio 2026-10-22: "let's wire that"; his 2K dinosaur `i2v_007` in project "LTX 2.5"
  morphs its scales). Prepped, NOT run: shipped engine 0.42.1 loads it (`comfy/sd.py:630`, plain
  `VAELoader`); file copied to `M:/CubricModels/vae/ltx-2.5-video-vae-bf16.safetensors` (1,472,223,346 B,
  from `G:/models/vae`). A/B = `research/dfr/dino2k_dfr_prompt.json` (the exact engine graph of `i2v_007`,
  history `0d5e9aff`, seed 753222358, node `1` swapped to the DiffVAE, output `mpi1095_dfr/`) vs the
  original (`dino2k_conv_graph.json`, 458 s engine). Fabio: run it AFTER the handoff, under the lease, his
  yes given for that one run. Expect a slower / tiled decode (ComfyUI budgets 1700/cell). If it wins: new
  dep for the DiffVAE, node `1` in the raw -> regenerate `ltx25_i2v_t2v.json`, R2 1.47 GB (~$0.02/mo,
  ask). Its encoder also encodes the i2v start frame, so the latent can differ slightly from conv's.
  **RUN 2026-10-23 ("LTX 2.5 model 6"), result in `validation.md` § DiffVAE A/B. Waits on Fabio's eye-test**
  (`research/dfr/scales_ab_old-left_dfr-right.webm`). Fabio's idea: switch the VAE with a Turbo toggle on the
  LTX card (none exists today). DiffVAE is the SLOWER decode, so it belongs on Turbo OFF, not ON; confirm with him.
  **WIRED 2026-10-23 (uncommitted), Fabio's yes:** Fabio added `Input_is_Turbo` -> MpiIfElse -> two VAELoaders
  (true = conv, false = DiffVAE) in the G: raw; copied to `raw/`, converted (`workflow-to-api.mjs`, single file:
  `sync-raw-workflows.mjs` would sweep peers' dirty raws), gate passes, `generate_ltx25.build` -> runtime diff =
  exactly those 4 nodes + every `["1",0]` VAE link moved to `["919",0]`. New dep `ltx25-video-vae-dfr`
  (`assetDeps.js`, sha256 from the M: copy), on the `ltx-25` dep list; `capabilities.h3TurboToggle: true` mounts
  the shared `h3Turbo` button on all three LTX ops (default OFF = DiffVAE). lint, `npm test` (3550), release:check green.
  Still open: (1) R2 upload of the DiffVAE DONE 2026-10-23 11:51 (size + rclone check, `validation.md`);
  (2) the `h3Turbo` button's tooltip says "6 steps instead of 25" (H3 text) - needs a per-model line in
  `PromptBoxControls.js`, held by a live peer (MPI-1257) on 2026-10-23; (3) in-app Turbo on/off check DONE
  2026-10-23: each side loads only its own VAE (`validation.md`). Commit these at handoff/close. Fast-entry morphing in the first ~1 s is NOT fixed by the VAE: that is MPI-707 (De-RoPE).
- LTX ladder moved down one rung (Fabio 2026-10-22, both LTX cards): `422b0aca3`, committed, NOT pushed.
  New `high` 1536x896 is UNMEASURED on the GPU (time, VRAM, look); a run needs Fabio's yes.
- R2 upload DONE 2026-10-22 23:04: all six deps on R2, sizes match, md5 verified (`validation.md`). `M:/_stage/mpi1095`
  still to delete (Fabio). Open: no second route for the 2.5 deps (HF re-host ~41 GB, Fabio, before devOnly comes off).
- R2 upload (~41 GB, ~$0.62/mo): Fabio's yes. Commit A + B at handoff/close. `docs/models/ltx/` 2.5 page
  DONE 2026-10-23: `docs/models/ltx/ltx-2.5.md` (+ models README row, model-set.md marks 2.3 High retired).
- Turbo tooltip DONE 2026-10-23 (`036f09079`): the `h3Turbo` button reads ModelDef `turboInfo`, H3 text
  stays the default; `ltx-25` has its own line. The commit also carries one tooltip line of the "Tile
  upscaler improvements 7" session (Fabio's OK). Left: Fabio's look at the 2.5 card, then close-out.
- **NEW 2026-10-23 (Fabio): a real LTX 2.5 enhancer recipe.** Today `ltx-25` borrows `ltx-2.3.recipe.js`
  ("Enhanced ... for LTX 2.5" in the dialog), and `docs/agent/models/ltx-2.3.md` claims "LTX 2.5 prompts
  exactly like 2.3" with NO 2.5 prompting research behind it. Lightricks DOES ship a 2.5 rewriter:
  `Lightricks/LTX-2` `.../gemma/encoders/prompts/gemma4_*_system_prompt.txt` (the 2.3 recipe header already
  notes it borrowed the gemma4 word budget by mistake, MPI-27). 2.5 also has native multi-shot prompts and
  a duration head. Do it through `/create-enhancer-recipe` (research -> draft -> test loop); then fix the
  agent guide's claim. Product call for Fabio first: its own `ltx-2.5.recipe.js`, or 2.3's recipe split.
- Stage 2 (2.5 in the LTX Flows, Keyframes to Video MPI-1191, 2.5-only Flows) waits for the release.

## Plan Drift

- 2026-10-22: the `ltx25` progress row was copied from 2.3 "unverified"; the live check confirmed it as is
  (no edit). The preview decoder stays (it decodes 2.5).

## Verification

**Verify mode:** auto

`npm run lint` + `npm test` green after A and after B; the isolated-app run above, every op with a visible
result. Fabio touchpoints that are not verification: reviewing the 2.5 raw graph, and the R2 upload yes.

## Preservation Notes

- `docs/models/ltx/`: a 2.5 page (model set, no Transition/ID LoRA needed, Gemma 4 CLIPLoader, timings) +
  mark the bf16 High tier retired in `model-set.md` / `tiers.md`.
- Ask before touching `.claude/rules/` (model maps).
