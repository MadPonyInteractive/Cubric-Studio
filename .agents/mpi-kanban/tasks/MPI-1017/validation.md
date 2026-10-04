# MPI-1017 validation

Verify mode: user-ux (the pinned panel is Fabio's surface; his re-ask of the repeat on Wan 3.0 closes it).

Live failure (Fabio, 2026-10-04): panel open on Wan 3.0 t2v 720p 4 s (Cue $0.40). Cosmo sent ref2v with
the finished clip as its own reference; quote = 720p x (4 s + 15 s reference ceiling) x $0.10 = $1.90.
The original clip's sidecar shows H3 Reference ref2v with NO media, so the faithful repeat was t2v.

## Agent evidence (2026-10-04)

- `npm test`: 2712 tests, 2710 pass, 0 fail, 2 skipped.
- `eslint` on every changed file: clean, 0 warnings.
- `tests/deepinfra-wan-media.test.cjs` reproduces the live quote exactly: 720p, 4 s, one reference clip
  of unknown length = "up to $1.90"; the same clip with its sidecar's 5.875 s = "about $0.99".
- `tests/agent-pinned-settings.test.cjs`: OP_PINNED names the panel op; an omitted op runs the panel's;
  the panel's saved batch 3 runs pinned, 1 unpinned; the Settings panel line names op and batch.
- `tests/agent-loop.test.cjs`: a No carries "The spend card quoted about $0.07"; a pinned `count` is
  refused SETTINGS_PINNED with no spend card and no generate.

## Fabio's live re-ask (2026-10-04) — PASSED

Panel open on Wan 3.0 t2v 720p 4 s, batch 1. "Repeat this video." -> Cosmo read wan3-cloud's settings and
guide:wan-3.0, the spend card quoted about $0.40, and the clip landed as WAN 3.0 TEXT TO VIDEO 4S,
1280x720, one clip; the session's Generations total reads $0.40 (was $1.90 before the fix). Fabio:
"it landed perfectly". CI green on ab394a373.
