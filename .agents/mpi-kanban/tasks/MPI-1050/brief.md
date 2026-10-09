# MPI-1050 - Pods miss the engine assets: one-shot install dies with the first Pod

Found 2026-10-09 by the MPI-1038 session (Tile Detailer eye-test on RunPod). Out of that
card's scope; Fabio asked for this card.

## Symptom

Fabio's Tile Detailer run on a Pod: live latent previews "look like absolute crap" (noisy
colour speckle), while his local bench ComfyUI previews the same graph cleanly. Final images
are fine (`Qwen 2.1/Media/flowTileDetailer_004.png` is clean) - only previews are bad.

## Evidence (read-only GETs on the Pod's raw ComfyUI, dev_mode port 8188)

Pod `6mtshnzc61jz87` (RTX PRO 4500 Blackwell, image `v0.25.0-dev-cu130`, volume `lpja78wof3`):

- `/models/vae_approx` = taef1, taesd3, taesd, taesdxl (+ encoders) - the image-baked set.
  **No `taef2_decoder`**, so `latent_preview.get_previewer` falls back to Latent2RGB for
  every FLUX.2 (Klein) preview. Bench has it via `G:/CubricModels/vae_approx/`.
- `/models/checkpoints` = `[]` (no `sam3.1_multiplex_fp16`), `/models/text_encoders` has no
  `qwen3vl_4b_abliterated_fp8_scaled`, `/models/ultralytics_bbox` has no `hand_yolov8n.pt`.
- The Pod's yaml DOES map the volume folders (`mpi-ci/cubric-vision-pod/start.sh:82`
  `vae_approx: mpi_models/vae_approx/`, :89, :98-100), so the files are absent from the
  volume, not hidden.

So all five volume-installed engine assets (`engineAsset && !bakedOnPod && !targetPath`,
~6.5 GB: qwen3vl-abliterated-clip 4.88 GB, sam3-multiplex 1.63 GB, hand-yolov8n,
person-yolov8n-seg, taef2-decoder)
are missing. SAM3 masking and the Qwen3-VL describer would fail on this Pod too.

## Likely cause (circumstantial, NOT yet proven)

`js/shell.js` `_installRemoteEngineAssets()` (MPI-380) runs only inside the
`_didFirstConnectDriftCheck` latch: ONCE per app session, on the first `remote:connection`
connected edge, as a `silent: true` download job. Fabio's `app.log` (session started
08:58:39Z): CPU Pod created 09:09:16Z, a connect reseed at 09:11:05Z, CPU Pod DELETED
09:11:41Z (36 s later), GPU Pod created 09:11:42Z and connected ~09:14Z. The install would
have fired against the CPU Pod and died with it (serial chain, qwen3vl first, taef2 last);
the GPU Pod never retried. No `[download]` line in the log at all for that job - a silent
job that dies says nothing.

## Prove first (root-cause rule)

1. Fabio restarts the app and connects to a GPU Pod as the session's first connect -> the
   Pod's `/models/vae_approx` should then list `taef2_decoder.safetensors` (and the other
   three appear). If it does: the install works when it runs, and the latch is the defect.
   If not: the install path itself fails - follow `_startRemoteDownload` (routes/downloadManager.js).

## Fix direction

- Run the engine-asset install on EVERY genuine connect edge (keep the drift heal latched if
  wanted). `_startRemoteDownload` pre-checks the volume and dedupes, so a warm volume is a
  no-op (its own MPI-380 comment says so).
- A silent job that FAILS must still log a `[download]` warning, so the next one is visible.
- Test: extend `tests/remote-engine-assets.test.cjs` (it already mirrors the shell.js filter).

## Noticed

- 2026-10-09 live check: on connect the server universal-node install (10:48:48Z) and the client drift heal (10:48:53Z) BOTH installed ComfyUI-MpiNodes - the client sync read it drifted while the server was still installing it. The client re-clone sets remoteComfyNeedsRestart, so the first generation waits on a second ComfyUI restart ("Loading new nodes - restarting the remote engine"). Pre-existing: same pair at 08:57:54Z/08:57:57Z on the morning connect.
