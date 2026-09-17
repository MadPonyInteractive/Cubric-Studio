# MPI-791 checklist

- [x] Diagnose from the user's log: engine assets landed in the default root, chosen root written later.
- [x] Fix 1: `/comfy/list-files` walks every root ComfyUI searches (primary + default).
- [x] Fix 2: `_resolveLocalModelPath` (remote upload) walks the same roots.
- [x] Fix 3: engine install resolves UW-dep destinations against the chosen root.
- [x] Fix 4: Pod-baked weights are listed when remote and count as present (no upload).
- [x] Route-level tests for 1, 2, 4; resolver + wiring tests for 3. Red on HEAD, green with the fix. Full suite green.
- [x] Docs: `docs/models-path.md`, `docs/runpod-remote-engine.md`, release note in `docs/releases/UNRELEASED.md`.
- [x] Commit only this card's hunks (MPI-656 has uncommitted hunks in engine.js / shared.js).
