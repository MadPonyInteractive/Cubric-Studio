# MPI-553 Validation

## Closed 2026-09-13 — no member left to run

- **Phase 1 (MPI-580, the Upscale-dropdown contribution point) and Phase 1b (MPI-579, the LTX
  Video upscaler plugin) shipped** and are archived. `js/data/pluginsRegistry.js` carries the
  `upscale` contribution point and `ltx-video-upscaler`.
- **Phase 2 (MPI-507) and Phase 3 (MPI-515) are REJECTED** — Fabio, 2026-09-13: PiD stays a
  model in the picker, exactly as it ships today, and does not become Upscale-dropdown plugins.
  Why and what was learned: `tasks/MPI-734/validation.md` and `tasks/MPI-734/research/install-status.md`.
- MPI-506 had already closed with SeedVR2 (2026-08-16).
- MPI-557 (Video face detailer) was a consumer, never a member, and stays open on its own.

Closed `complete`: the members that were built shipped, and the rest are rejected.
