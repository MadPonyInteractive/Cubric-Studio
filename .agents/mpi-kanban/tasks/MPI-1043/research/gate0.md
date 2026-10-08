# Gate 0 - breaking surfaces v0.34.0 -> v0.39.0 (2026-10-08)

A research sub-agent did the first pass; each claim it flagged as a breaker was then checked
by hand. **Result: no confirmed breaker caused by the bump.** Two things to watch, below.

## Release notes 0.35 - 0.39, against what we use

| change | release | our exposure | verdict |
|---|---|---|---|
| `BlockSparseSamplingAttn` -> `ModelSparseSamplingAttn` (PR #15777) | 0.35 | none; our `ModelAttentionBackend` is KJNodes' | safe |
| core gains `LTXVAddLatentGuide` (PR #16176) | 0.35 | different class_type from the Lightricks `LTXVAddGuide` we use | safe |
| `torchaudio` dropped from requirements | 0.35 | engine-owned in `routes/engine.js`; the portable still bundles it | safe |
| `TextGenerate` gains `system_prompt` input + `thinking` OUTPUT | 0.38 | our `"thinking": false` is the existing INPUT | safe |
| `ImageUpscaleWithModel` RGBA crash fixed | 0.38 | `image_upscale.json`; free fix | gain |
| `--disable-api-nodes` replaced by `--offline` / `--disable-partner-nodes` | 0.39 | we never pass it (`routes/comfy.js` launch args) | safe |

Routes and WS messages we use (`/prompt`, `/history`, `/queue`, `/interrupt`, `/free`,
`/object_info`, `/upload/image`, `/view`; `execution_start/success/error`, `executing`,
`progress`, `status`, `VHS_latentpreview`): no change noted in any release. Not read line by
line in the server source.

## comfy-aimdo 0.4.15 -> 0.5.5

- `--disable-dynamic-vram` still exists.
- `AIMDO_FAULT_RE` (`routes/comfy.js:171`) arms: `Fault failed: \d` still raised
  (`model_vbar.py`); `VRAM Allocation failed` still logged from the C side
  (`src/vrambuf.c`, `src/model-vbar.c`). Confirm the `aimdo:` log prefix live after the bump.
- `HostBuffer allocation failed` is not matched by the regex - **but it is raised identically
  in 0.4.15**, so it is a pre-existing gap, not a bump break. Whether a host-RAM failure
  should even flip the dynamic-VRAM fallback is a separate question (see MPI-1029).
- New harmless stdout line: `Model storage policy: fast_disk=True/False`.

## Pinned nodes

17 of 19: nothing found upstream for the 0.35-0.39 range. Two notes:

- **ComfyUI-LTXVideo `3b9c5cde`**: a kornia 0.8.3 pyramid-padding change is reported upstream
  against `pyramid_blending.py`. Not confirmed on our pin. The smoke's LTX ops cover it.
- **comfyui_controlnet_aux `e8b689a`**: the sub-agent flagged its mediapipe 1.0 fix
  (`923752d0bb`, 2026-09-26) as a breaker. **False for us** - that fix touches only
  `mediapipe_face`, and our workflows use Canny, DepthAnythingV2, Openpose and Scribble
  preprocessors only. No pin move needed for this.
