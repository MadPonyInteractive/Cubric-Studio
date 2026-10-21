# MPI-1216 plan

## Current State
All three parts done and benched (2026-10-21, "Flux.3 integration 15"), committed:
1. Edit keeps picture 1's size (`_keep_edit_size`), shipped earlier.
2. Masked box: Fabio NO.
3. Zoom drift + Cosmo 8:5 2K: ONE root cause. `MpiFlux3References` scaled picture 1 to 1 MP,
   so it no longer matched the output latent; chained edits crept, big photos re-composed, a
   2 MP Custom size frame re-drew the scene. `_ref_matches_frame` hands picture 1 over at the
   frame's exact size (node `keep resolution`, refs 2-10 scaled to 1 MP in the graph); a Custom
   size of ANOTHER ratio keeps 1 MP so it reframes. validation.md has the numbers.
   The "masked edit" in the old notes was wrong: Cosmo's run was a BOX edit.

Fabio's live look PASSED (2026-10-21): no zoom on chained edits; 8.6 MP edit time accepted
("expected to take a long time anyway").

NEXT PART (folded in, same system): chained FLUX.3 edits through Cosmo / MCP shift the COLOUR
GRADE a little every now and then (much milder than before the fix, when he had to ask Cosmo to
undo the saturation). His guess: Cosmo's edit prompts never ask to keep the colour grade.
EVIDENCE (Fabio, 2026-10-21, project "Flux 3 tests", UFO cliff scene 1280x800): chain
t2i_003 -> edit_044 -> edit_045 -> edit_046. 003 -> 044 colour barely moved; 045 shifted a lot;
045 -> 046 "we used turbo, and there was a big difference there as well". Start from those four
cards' sidecars: compare each prompt, Turbo flag and seed against the measured shift.
Measure first: per-edit colour drift (mean Lab / saturation vs picture 1) over a chain on the
bench, prompts with and without a keep-colour clause; read what Cosmo actually wrote (project
"Flux 3 tests" sidecars, app.log `[agent]`). Then fix where the prompt is written: the FLUX.3
agent guide `docs/agent/models/flux-3.md` (edit section) and/or the app's keep line
(`KEEP_CLAUSE` / `withLayoutBoxes`, `js/data/layoutBoxes.js`); never a graph colour hack.

COLOUR MEASURED (2026-10-21, "Flux.3 integration 16", validation.md § Colour drift): a keep-colour
clause does NOT help (real chain identical, base null chain worse); the drift is FLUX.3's own
per-pass bias (Turbo warms ~1.1 dE/pass, base ~0.5 + chroma creep). Global ColorMatch wrecks new
content (dog beige). A regrade fitted on unchanged pixels works (prototype `research/colour/
regrade.py`) but means a new MpiNodes node.
BUILT (Fabio OK, scope: one picture only, < 20 s): MpiNodes `MpiGradeBack` (291bf3d, pushed,
pinned in node_lock.json) + `_grade_back` in generate_flux3.py on the unmasked edit decode, gated
on slot 2 blank and not a reframe, max_shift 4/255. Bench verified (validation.md). NEXT: after
Fabio's restart (new M.2 drive), run npm lint + npm test, commit, push, watch CI; then Fabio's
live look: a chained Cosmo edit chain should hold its colour (app restart reinstalls MpiNodes at
the new pin). Agent guide flux-3.md NOT touched (no prompt change needed; a peer works on Cosmo).

DONE (2026-10-21, "Flux.3 integration 17"): CI green on 88230bb4; Fabio live-confirmed three
chained Cosmo edits hold their colour. Card closed.

## Remaining Work
1. Colour grade drift on chained Cosmo/MCP edits: measure, then fix in the prompt path.

## Verification
**Verify mode:** auto

## Completed
- Edit size kept: bench 768x1376 -> same, 752x1360 -> same, 3350x6000 -> 2192x3936 (cap);
  live Cosmo detail_013 1088x1920 -> edit_039 1088x1920. npm test 3483 pass / 0 fail.
- Masked box: NO (Fabio).
- Zoom/ratio fix: chain x1.002 no shift (was x1.006, -1%); Cosmo case keeps tiger + dog; every
  op benched; tests 7/7, npm test 3492 pass / 0 fail.

## Plan Drift
- 2026-10-21: two new bugs folded in (zoom drift, Cosmo size), same system; one fix covers both.

## Gotchas
- BENCH vs FABIO'S APP SHARE ONE 16 GB GPU: ask him to keep the app idle, kill only
  G:\ComfyUi's python if a run hangs. Restart: Start-Process
  G:\ComfyUi\python_embeded\python.exe 'ComfyUI/main.py --preview-method taesd --output-directory
  D:\WORK\Images\Outputs' -WorkingDirectory G:\ComfyUi (up in ~30 s). POST /free after a run.
- MpiLoadImage reads only inside ComfyUI's input/output/temp; elsewhere = silent block.
- `gpu_lease.py run -- bash x.sh` resolves `bash` to WSL: pass Git Bash's full path.
- `research/frame/bench.py GRAPH OUT Title=value...` runs any injection set on the bench.
