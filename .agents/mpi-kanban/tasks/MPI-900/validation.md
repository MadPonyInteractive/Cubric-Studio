# MPI-900 validation

## 2026-09-24 - Klein 9B only, one pass, paste-back (session c3d96049)

- `node scripts/validate-injection-rules.mjs comfy_workflows/flow_outpaint.json` -> conforms.
- raw -> API via `scripts/workflow-to-api.mjs` (engine :48188 object_info): every surviving node identical to the previous runtime graph except 112 (bake), 667 (delimiter), 685 (regex), 493 (reads 686).
- Targeted: connector-agent-tools, flow-model-choice, inject-params-titles, flow-enhance-ownership, outpaint-passes, agent-outpaint-frame, agent-cards -> 97/97 pass.
- `npm test` -> 1834 pass, 0 fail. eslint on the three touched js files -> clean.
- NOT yet verified: a real generation. Needs Fabio's eyes (user-ux): original pixels unchanged, no seam, alpha of the staged PNG is 0 in the new area.

## 2026-09-24 - seam fix: HarmonizeBoundary before the paste-back (session e7f50881)

- Live run flowOutpaint_006 (Fabio): original held (max abs diff 0 vs the staged PNG), but a tone step at the border y=752 of -1..+8 RGB varying across the width. Root cause: ComposeColorMatch's grade is ONE per-channel affine over the whole original; Klein's drift is local (it flattened the wall vignette), and the composite mask is hard.
- Fix: node 687 `MickmumpitzPanoHarmonizeBoundary` (image = Klein decode, plate = Input_Image, inpaint_mask = its alpha, 1.0 / 8 / 4000 / no wrap) feeds 686, whose correction is now `Off`.
- Offline proof on the real output (engine python, the real node classes): per-96px-column step 7.9 max -> 0.5 max, original byte-identical, solve 0.17-1.24 s. Remaining faint line = t2i_007's own row 0->1 dip (159.5 -> 158.1), inside the untouched original.
- raw -> API: only 687 added and 686 changed; `validate-injection-rules` conforms; inject-params-titles 22/22 (pins 687 wiring + correction Off).
- `npm test` 1827 pass / 14 fail - all GIF tests dying on `ENOENT ... Temp\cubric-tests\524` (shared temp dir removed mid-run by a concurrent run), none touch outpaint.
- NOT yet verified: Fabio's live re-run.

## 2026-09-24 - LIVE: seam gone (Fabio)

- Fabio re-ran Outpaint on t2i_007 (grow up) twice after the HarmonizeBoundary fix: "Nice, no more seams."
- On disk: flowOutpaint_008 / _009, 1216x1520 = frame at source resolution; original region max abs diff 0 vs the staged PNG; border step per 96px column -0.5..-1.7 RGB, flat across the width (was -1..+8 varying in _006).
- Open, not a blocker for the seam: Fabio's call on output at source resolution vs the old ~1 MP.
