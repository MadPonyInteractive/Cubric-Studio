# MPI-1163 validation

## Test that failed before the change

`tests/transport-error-message.test.cjs`, four new cases driving the real `forceStall()`
into the real `'error'` handler. Before the change the first one failed:
`AssertionError: the mirror is tried before the verdict` (url stayed on models.cubric.studio).
After: 19 passed. Cases:

- a stall with the same-url budget spent fails over to the mirror, keeps `downloadedBytes`,
  resets the budget; a second spent stall with no mirror left goes `failed`, not blocked
- a stall with budget left retries the SAME url first
- a stall with zero bytes goes straight to the mirror
- origin 503 fails over; 404 and ENOSPC do not

`tests/download-retry.test.cjs` unchanged and green (7), incl. "zero bytes on disk still
fails immediately" (no mirror for a non-`/vision/models/` url).

## HF mirror coverage of the engine-asset deps (2026-10-17)

`getUniversalWorkflowDepIds()` -> 13 weights + 22 github custom-node zips (no mirror by
design). Checked with `HfApi(token=False).get_paths_info` on the exact object the app would
fail over to, comparing `lfs.sha256` to the dep's `sha256`:

| dep | mirror object | result |
|---|---|---|
| qwen3vl-abliterated-clip | Mad-Pony-Interactive/cubric-studio:vision/models/text_encoders/qwen3vl_4b_abliterated_fp8_scaled.safetensors | OK (5,242,481,504 B) |
| 4x-AnimeSharp | Mad-Pony-Interactive/cubric-studio:vision/models/upscale_models/4x-AnimeSharp.pth | OK |
| rife47 | Mad-Pony-Interactive/cubric-studio:vision/models/frame_interpolation/rife/rife47.pth | OK |
| 4x-NMKD-Siax | uwg/upscaler:ESRGAN/4x_NMKD-Siax_200k.pth | OK |
| birefnet | Comfy-Org/BiRefNet:background_removal/birefnet.safetensors | OK |
| face/hand/person yolov8n | Bingsu/adetailer | OK x3 |
| sam-vit-b | ybelkada/segment-anything:checkpoints/sam_vit_b_01ec64.pth | OK |
| sam3-multiplex | Comfy-Org/sam3.1:checkpoints/sam3.1_multiplex_fp16.safetensors | OK |
| taesdxl/taef1/taef2 decoders | - | noMirror (unchanged) |

No dep needed `noMirror` or a re-host. The repo answered anonymously, so users can read it.

## Not proven

GitHub issue MadPonyInteractive/Cubric-Studio#8 (froze at 994 MB / 2.9 GB): this gap is a
plausible contributor, not a proven cause. A FROZEN bar for minutes would also mean the
watchdog did not fire or the retries were silent; the tester's app.log decides it.

## CI

Tests run on 0560b87cf: success - https://github.com/MadPonyInteractive/Cubric-Studio/actions/runs/39008914309
