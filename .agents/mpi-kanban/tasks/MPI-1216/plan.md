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

Next: Fabio's live look in the app (checklist last item), then close. No code left.

## Remaining Work
1. Fabio live check: a chain of edits, a Custom same-ratio bigger-tier edit, one big photo
   (now ~2.5x slower: 8.6 MP edit ~8.5 min Turbo on 16 GB).

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
