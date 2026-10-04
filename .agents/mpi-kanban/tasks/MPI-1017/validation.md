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
"it landed perfectly". CI green on ab394a373. Closed in a9197656d.

## REOPENED 2026-10-04 — Fabio's ref2v test

Panel open on Wan 3.0 ref2v 480p 2 s 1:1. The clip ran right (ref2v_004: 640x640, 2 s, $0.10) but
Cosmo said "set at 4:3", and its prompt timed `Shot 1 [0-3s]` / `Shot 2 [3-6s]` into the 2 s clip
(the t2v repeat did the same: 0-6 s in a 4 s clip). Causes: `_sentNote` echoed the agent's ratio
back ("Settings you sent: ratio 4:3 ... Tell the user only settings listed here") though the
panel had dropped it; and `_pinnedForTurn` sent the panel's batch but not its duration or ratio.

Agent evidence:
- `tests/agent-loop.test.cjs`: pinned generate with ratio 4:3 -> message names "(2 s, 1:1)", never 4:3.
- `tests/agent-pinned-settings.test.cjs`: the panel line names "The clip is 2 s long" and "The ratio
  is 1:1"; names neither when the panel resolves none; `_pinnedForTurn` sends both.
- `resolveNamedParams` on the real Big Photos Test project.json, wan3-cloud ref2v: Input_Duration 2,
  Ratio_Label 1:1 (what the panel shows).
- `npm test`: 2714 tests, 2712 pass, 0 fail. eslint clean on the four changed files.

Remaining: Fabio's look after an app restart.
