# MPI-1216 plan

## Current State
Part 1 (edit keeps picture 1's size) DONE and verified, uncommitted until this handoff: generator
`_keep_edit_size` (MpiLoadImage outputs 2/3 -> MpiMath cap 2944^2 -> /16 -> EmptyFlux2LatentImage,
MpiIfElse keeps the refs latent on a mask), runtime regenerated, `tests/flux3-edit-size.test.cjs`.
Part 2 (masked box) DECIDED NO by Fabio. Two NEW problems found by Fabio, both still open:

1. ZOOM DRIFT: chained edits keep their size now but zoom IN a little on every edit (box edits too),
   like old Qwen-Image-Edit. Not measured yet. Suspected cause (core
   `comfy_extras/nodes_edit_model.py` ReferenceMultiLatent): refs are resized to 1 MP with
   `round()` per side (NOT /16), then the VAE centre-crops to /16, so every edit sees a slightly
   cropped picture 1; AND the ref latent (1 MP) no longer matches the output latent (picture 1's
   size). Old Qwen's zoom was this same ref/latent mismatch. Fabio's live chain is the evidence.
2. COSMO SIZE: Fabio asked Cosmo "redo that last one but set a size of 8:5 and 2K, Turbo on" on a
   MASKED edit (project "Flux 3 tests", edit_029 -> edit_040..043, 1280x800). Cosmo said it ran
   at 2K 1792x1120, the tiger and dog vanished (Fabio stopped it), then Cosmo ran an UPSCALE to
   1920x1200 instead. Likely: the graph ignores Custom size on a mask (798 = custom AND NOT
   has_mask), so the agent's ratio/tier did nothing and it reached for upscale. Check the
   sidecars + logs/app.log `[agent]` before theorising. Fabio wants this in the next session.

## Remaining Work
1. Zoom: measure first. Scripts in `.agents/mpi-kanban/tasks/MPI-1216/research/` (they write to
   a hard-coded old scratchpad path `S` - point it at your own scratchpad first):
   `zoomchain.py A|B N` (chains N "change nothing" edits of `G:/ComfyUi/ComfyUI/input/mpi1216_d013.png`
   = Fabio's detail_013 1088x1920; A = graph as shipped, B = MpiFlux3References resolution
   "keep resolution") and `zoommeasure.py orig edit1 edit2...` (scale+shift search; self-checked:
   a known x1.040 reads x1.042, step 0.004). Then fix in the generator (likely: feed picture 1
   to ref_image_0 already resized to the output latent's exact /16 size).
2. Cosmo 8:5 2K on a masked edit: read evidence, then fix.

## Verification
**Verify mode:** auto

## Completed
- Edit size kept: bench 768x1376 -> same, 752x1360 -> same, 3350x6000 -> 2192x3936 (cap);
  live Cosmo detail_013 1088x1920 -> edit_039 1088x1920. npm test 3483 pass / 0 fail.
- Masked box: NO (Fabio).

## Plan Drift
- 2026-10-21: two new bugs folded in (zoom drift, Cosmo size on a masked edit), same system.

## Gotchas
- BENCH vs FABIO'S APP SHARE ONE 16 GB GPU. Twice this session a bench run hung (VRAM full,
  /interrupt ignored) while his app worked and blocked his engine restart; only killing the bench
  python (G:\ComfyUi\python_embeded, port 8188) freed it. Ask him to keep the app idle before a
  bench run. The bench is currently STOPPED; restart: Start-Process
  G:\ComfyUi\python_embeded\python.exe 'ComfyUI/main.py --preview-method taesd --output-directory
  D:\WORK\Images\Outputs' -WorkingDirectory G:\ComfyUi (up in ~60 s).
- MpiLoadImage reads only inside ComfyUI's input/output/temp; elsewhere = silent block (success,
  no output). Stage inputs in G:/ComfyUi/ComfyUI/input/.
- A big-photo edit now renders up to 8.6 MP: ~4 min on 16 GB (was ~21 s at 1 MP).
