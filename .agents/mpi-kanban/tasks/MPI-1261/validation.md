# MPI-1261 validation

2026-10-23, own `app:isolated` instance (port 52529, scratch profile + scratch project, 3 imported images), driven in the browser pane:

- Pointer resting on a gallery card: flyout NOT open at 1 s, open at 2.5 s, to the card's left, showing "Model Imported / Created 23 Oct 2026, 19:47".
- Pointer moved to empty grid space: closed within 0.5 s.
- Back to Projects (grid destroyed): `.mpi-entry-info` count 0, so no leaked flyout.
- History keeps its 400 ms (default `openMs` unchanged; only the gallery passes 2000).
- `npm run lint` clean; `npm test` 3556 pass, 0 fail.

## Pass 2 (5ca47dcc3) — 1.5 s, settings rows, LoRAs, short prompt

Fabio: 2 s too long, try 1.5 s and keep tuning; show turbo, denoise, style, ratio, the used LoRAs with strength; prompt ~200 chars is enough.

- `tests/entry-info.test.cjs` 7/7: ratio/turbo/style/denoise rows, LoRA filter (bypassed, 0-strength and empty slots dropped, folder + `.safetensors` stripped), 200-char prompt cut.
- Live, own instance on a scratch COPY of the Moss image project: closed at 1 s, open by 2 s, showing `Ratio 4:5 / Turbo On / Style Psychedelic Pop · 1`, prompt cut with `…`.
- `npm run lint` clean; `npm test` 3558 pass, 0 fail.
- Open: the delay is Fabio's eye call (`openMs` in MpiGalleryGrid.js).

Cleanup: instance stopped via the listener's parent; the scratch project root it added to `Documents/Cubric Studio/project-paths.json` removed (file restored byte-for-byte).

## Pass 3 — GPU + RAM in the sidecar

2026-10-23. Each new local/remote gen records `generationSettings.engine`, `gpu` (local GPU name, or the Pod gpuType) and `ramTotal` (local only, bytes); cloud and tool runs record none. Flyout shows `GPU` (`· RunPod` on a Pod) and `RAM` (`64 GB`) after Took; old cards show no row.

- `tests/entry-info.test.cjs` 8/8 (new: GPU/RAM rows, RunPod suffix, no RAM on a Pod).
- Live, own `app:isolated` (port 51294, scratch profile + APP_DOCUMENTS): `remoteEngineClient.machine('local')` = `NVIDIA GeForce RTX 4060 Ti`, 68484911104 bytes; flyout rows `GPU NVIDIA GeForce RTX 4060 Ti / RAM 64 GB`. No project opened, so project-paths.json untouched; instance stopped via the listener's parent.
- `npm run lint` clean; `npm test` 3560 pass, 0 fail.
- Not run: a real generation end to end (it would dispatch onto Fabio's GPU via shared :48188). The write path reads the store job's engine, which `settle()` keeps.

## Pass 4 — Pod RAM too

Fabio: the app shows a Pod's RAM in the status bar and landing page. Remote gens now record it from the same `/remote/pod/specs` (`ramGb`, v2 `gpu.memory`), fetched once per Pod connection and cleared on `remote:connection`.

- `tests/entry-info.test.cjs` 8/8 (Pod `62 GB` row; no row when unknown).
- Live, own `app:isolated` with no Pod: `/remote/pod/specs` = `{"gpuName":null,"vramGb":null,"ramGb":null}`, so a no-Pod read records no RAM. Not run with a real Pod (renting one costs money).
- `npm test` 3561 pass, 0 fail.

## Pass 5 — VRAM row

Fabio asked for the GPU's VRAM, then said a separate row is fine. Sidecar gains `vramTotal` (local `/system/gpu-info`, Pod `/remote/pod/specs` `vramGb`); flyout rows GPU / VRAM / RAM.

- `tests/entry-info.test.cjs` 8/8.
- Live, own `app:isolated`: `machine('local')` vramTotal 17175674880; rows `GPU NVIDIA GeForce RTX 4060 Ti / VRAM 16 GB / RAM 64 GB`; no Pod = all null.
