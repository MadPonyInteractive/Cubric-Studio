# MPI-1050 validation

## Root cause - proven from the log, no Pod spent (2026-10-09)

Fabio's `%APPDATA%/Cubric Studio/logs/` (rotated `app-20261009-085839.log` + `app.log`):
first connect 08:57:54Z on volume `0gzc4yk344` ran the drift heal and set the session latch;
the new volume `lpja78wof3` (first seen 09:09Z) got its 6 missing universal nodes from the
server's per-connect path at 09:14Z, but neither client heal re-ran. The CPU Pod never reached
connected, so the brief's "install died with the CPU Pod" was not the mechanism.

## Automated checks (all exit 0)

- `node tests/remote-engine-assets.test.cjs` - 8/8 OK. New guard 8 run against HEAD's
  `js/shell.js` reports depth 1 for both heals (fails), against the fix depth 0 (passes).
- `node --test` on node-drift, install-queue-wedge, disk-full-message,
  remote-attach-stale-inflight, remote-disk-gate-unknown-state, remote-install-concurrency,
  remote-restart-reissue, remote-status-fail-closed, remote-target-path-deps - all exit 0.
  remote-attach-stale-inflight prints the new line `remote install <id>: fetching nothing; 1
  on the volume or in flight` - a re-POST after a flap attaches, it does not double-fetch.
- `npx eslint js/shell.js routes/downloadManager.js tests/remote-engine-assets.test.cjs` exit 0.

## Left: live check on Fabio's next Pod

After an app restart (the renderer still holds the old latch), the next connect on
`lpja78wof3` should log `remote install engine:assets: fetching qwen3vl-abliterated-clip,
hand-yolov8n, person-yolov8n-seg, sam3-multiplex, taef2-decoder; ...` and, once it lands,
`/models/vae_approx` lists `taef2_decoder.safetensors` and Klein previews are clean.

## Live check - Pod hupqy4ocz0lus6 on lpja78wof3 (2026-10-09, after app restart)

- 10:49:03Z `remote install engine:assets: fetching qwen3vl-abliterated-clip, hand-yolov8n, person-yolov8n-seg, sam3-multiplex, taef2-decoder; 0 on the volume or in flight` - all 5 were missing, as diagnosed.
- ~1 min later the Pod ComfyUI lists `taef2_decoder` (vae_approx), `sam3.1_multiplex_fp16` (checkpoints), `qwen3vl_4b_abliterated_fp8_scaled` (text_encoders), `hand_yolov8n.pt` + `person_yolov8n-seg.pt` (ultralytics_bbox).
- Fabio eye-test: Klein (upscale, grid) live previews "came out nicely" - TAESD, not Latent2RGB speckle.
- 11:01:53Z Pod stopped + resumed on the same volume, app NOT restarted -> 11:02:33Z `remote install engine:assets: fetching nothing; 5 on the volume or in flight`. The second connect edge re-ran the install; the old session latch would have logged nothing. Fix proven live.
