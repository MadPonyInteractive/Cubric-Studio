# MPI-812 — The desktop harness never reaps its Electron profiles

Filed 2026-09-18 by Fabio, off a disk that hit **100% full**: 931 GB used, 395 MB
free, an `ENOSPC` out of an editor write, and a unit test failing for a reason that
had nothing to do with its code.

Sibling of [[MPI-810]]. Same family — a desktop spec writing outside its own scratch
— but a different writer and a different volume. MPI-810 owns project folders left
in the temp ROOT. This card owns the Electron user-data profiles left in the SESSION
SCRATCHPAD, which is where nearly all the bytes are.

## What was measured

`%LOCALAPPDATA%\Temp\claude` — the agent session-scratchpad root — held **153.7 GB
across 228 session folders**, 701,334 files:

| bucket | size | files |
|---|---|---|
| Electron profiles (`user-data\`) | **142.1 GB** | 608,891 |
| `pw-*`, `run-*`, `toast-*` run dirs | 7.5 GB | 36,777 |
| browser `Cache/Cache_Data` | 1.1 GB | 1,924 |
| **everything an agent actually wrote** | **2.9 GB** | 53,742 |

So **92%** of it is one thing: a per-test Electron `--user-data-dir` that the run
creates and nothing ever deletes. The real work product of 228 sessions is under
3 GB.

Only 12.4 GB of the 153.7 was older than three days — **~120 GB accumulated in two
days** of heavy UI-card work (MPI-774, MPI-771, MPI-736). Call it ~60 GB/day when
the board is busy.

## Why it hides

No single file is over 4 MB. Every "find the big files" sweep — including
`robocopy /MIN:104857600` over the whole volume — walks straight past it. It only
shows up as a directory total, which is why a disk can go from 80 GB free to 395 MB
without anything obvious appearing.

## The collateral damage is not just space

`tests/download-retry.test.cjs` fails with **`exactly one write probe per dep, got
0`** whenever C: has under 1 GiB free: `_writeProbe` (`routes/downloadManager.js`,
`PROBE_MIN_FREE_BYTES` at :2034) needs 8 MB fsynced, skips below the threshold, and
logs a WARN instead of the INFO the test counts. Nothing in that assertion says
"disk". It reads exactly like a regression in whatever you just changed — it cost a
bisect against unmodified `HEAD` routes to clear.

## What to build

Teardown that deletes the profile it made. The profile is disposable *by
construction* — nothing resumes from one, the next run makes a fresh one — so this
does not need to be clever or configurable:

- Reap in the spec/fixture teardown that created the dir, so it works per-test
  rather than relying on a global sweep.
- It must survive a **failed or crashed** test, which is exactly when the profile is
  left behind today. A teardown that only runs on the happy path fixes nothing.
- Keep whatever a failure genuinely needs — a trace, a screenshot, the video. Those
  live in the Playwright output dir ([[MPI-809]]'s `--output=<scratchpad>`, already
  in place), not in `user-data`.

Worth checking whether one shared profile per worker would do instead of one per
test. Fewer dirs, same isolation in most specs — but confirm no spec depends on a
virgin profile before collapsing them.

## Out of scope

- The 7.5 GB of `pw-*`/`run-*`/`toast-*` leftovers. Smaller, and more likely to hold
  a trace someone wanted. Sweep them only if it falls out for free.
- One-off cleanup of what already exists. Already done, 2026-09-18: 157 scratchpad
  folders whose owning session was **archived**, 153.16 GB, C: back to 169 GB free.

## Trap for whoever does that cleanup again

A scratchpad folder name is **not** the app's session id. `list_sessions` returns
`local_<uuid>` (app record); scratchpads and `~/.claude/projects/<proj>/<uuid>.jsonl`
use the Claude Code session uuid. Matching the two sets directly gives **zero**
overlap, which reads as "every scratchpad is an orphan" — act on that and you delete
live sessions' work. The bridge is
`%APPDATA%\Claude\claude-code-sessions\**\local_<appSessionId>.json`, which carries
the Claude Code uuid inside. Delete a folder only when **every** app session
referencing it is archived; a resumed session has more than one.

And never prune these by mtime. Fabio archives sessions and rarely deletes them, so
a folder untouched for a week is routinely still open mid-job — an `AddDays(-1)`
filter would have taken `Video edit 4`, `Extend video 16`, `3D Scene 8` and
`Proprietary models integration`, all live at the time.
