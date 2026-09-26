# MPI-931 Validation

Session 667f09c0, 2026-09-26, together with MPI-930 (umbrella MPI-932 Phase 3a).

Research answer: YES. The pinned ComfyUI v0.34 `server.py` `post_interrupt` reads `prompt_id` and
interrupts only if that prompt is the one running (checked in engine/ComfyUI_windows_portable and
the G:\ComfyUi bench, v0.34.2). The Pod wrapper (`mpi-ci/cubric-vision-pod/wrapper/wrapper.py`
/wrapper/interrupt) and `routes/remoteProxyForward.js` /proxy/interrupt forward the body unchanged.

Fix: `comfyController.interrupt(promptId)` sends `prompt_id`; every caller names its own prompt.
Generation: `_stopOwnPrompt()` (interrupt + queue delete) from `interruptCb`, and from the
prompt_ack when the job was already aborted (Stop during the /prompt POST). Auto-mask detect and
GIF cutout track: record the ack's prompt id; a Stop before the ack interrupts when it lands. No
prompt id = no interrupt. No bare `.interrupt()` call is left in js/ (grep).

- `tests/desktop/cancel-targets-own-prompt.spec.js` test 2 PASSED (interrupt body carries
  prompt_id, Stop after AND before the ack); FAILED against HEAD's code - red first, then green.
- Related suites: see MPI-930's validation.md (41/41 desktop, 24/24 unit, eslint clean).
- Not covered by a spec: the generation path's ack-after-abort branch (needs a full pipeline).
Fabio's live check: PENDING.
