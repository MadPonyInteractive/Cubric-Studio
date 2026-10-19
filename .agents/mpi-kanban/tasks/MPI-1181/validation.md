# MPI-1181 validation

## 2026-10-19 - wiring (session "Flux.3 integration 5")

Runtime graph `comfy_workflows/flux3_t2i.json` (generate_flux3.py from the raw; 111 nodes, upload
slots blank, wf_type 1, Turbo true) run on the bench ComfyUI 0.42.1 with only the app's injections,
`scratchpad/runops.py`, under gpu_lease:

| case | result | wall |
|---|---|---|
| t2i Turbo 1024x1024 | success, teapot | 12 s |
| t2i base 1024x1024 | success, visibly different (UNET switch works) | 48 s |
| edit Turbo, 1 ref, custom size off | success, top recoloured, rest intact, source 571x1021 | 21 s |
| edit Turbo, custom size on, 1024x1024 | success at 1024x1024; pillarboxed with a bare prompt, fills the frame with a `TARGET CANVAS: 1:1` line | 21 s |
| i2i Turbo 768x1344 denoise 0.6 | success | 12 s |
| upscale Turbo x1.5 | success, 840x1512 | 12 s |
| card image, base 896x1088 | success -> display/flux3-klein.webp (placeholder) | 45 s |

Not run on the runtime file: inpaint, detail (need a mask; Fabio benched both in this exact graph,
and the generator only prunes/bakes defaults - prune keeps every branch upstream of Output_Image).

`npm test`: first run 3423/3429, 4 fails all from this change (pinned rank order; a comment
containing "motion" inside the H3 hint slice) - fixed. Re-run: see below.

Not done yet: in-app run per op (the app engine reads G:/CubricModels, 8.7 GB free, weights sit in
C:/AI), R2 upload (needs Fabio's yes), agent guide (comes with the flux-3 recipe), progressStages
count, Boxes, Pod smoke.

## 2026-10-19 - Custom size button (session "Flux.3 integration 6")

Fabio's in-app ask: the edit size picker behind a button, off by default. `customSize` control
(perOp, injects `Input_custom_size`), `Input_custom_size` out of `opInject.edit`, MpiPromptBox
parks ratio + qualityTier (hidden + not injected) while off; agent `resolveNamedParams`: a named
ratio/tier turns it on, else the project's button, else off with no Width/Height.

- `tests/flux3-custom-size.test.cjs` 6/6; `npm test` 3433 pass / 0 fail / 2 skipped.
- `tests/desktop/prompt-box-custom-size.spec.js` (real Electron, own port) pass: off = no Width,
  `Input_custom_size: false`, picker hidden; on = Width + true, shown; off again = parked.
  Neighbours prompt-box-use-tiles / badge / start-frame-toggle: 4/4 pass.
- Fabio in his own app, 2026-10-19: "It looks great" (Turbo + Custom size buttons in the edit
  popup, 1K/2K/4K + ratio shown when on). Copying it to every other edit model is MPI-1207, not here.
