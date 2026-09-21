# MPI-878 — validation

Shipped in `cfc0355e`. CI run **35599750388**, green.

## Phase 2 — the shard split

### Wall-clock, measured

| | baseline (run 35595318785) | after (run 35599750388) |
|---|---|---|
| lint + `npm test` | inside the one job | `unit` 12:28:37 → 12:30:39 (2.0 min) |
| desktop | 11:42:28 → 11:58:32 (16.1 min) | 4 shards, 12:30:41 → 12:36:57 |
| **run wall-clock** | **17.4 min** | **8.3 min** |

Per shard: (4) 3.1 min, (1) 3.9, (2) 5.7, (3) 6.3. Shard 3 is the critical path.

**The shards are unbalanced and that is the remaining headroom.** Playwright allocates by
test COUNT, not duration, so the 3.1-vs-6.3 spread is inherent. Six shards would land the
run near 6.5 min; setup (checkout + `npm ci`) measured ~45 s, so it is not the floor yet.
Not done — 8.3 from 17.4 is the win worth having, and more runners for ~1.8 min is not.

### The split is correct, checked BEFORE pushing

`npx playwright test --config=playwright.desktop.config.js --shard=N/4 --list`:

```
shard 1: 39   shard 2: 36   shard 3: 41   shard 4: 33   = 149
total:   149 tests in 63 files
```

Sums exactly. All 63 files covered, and no file appears in two shards (`uniq -d` over the
four file lists is empty) — so no spec's Electron boot is paid for twice.

`playwright.desktop.config.js` was claimed and deliberately left **unmodified**:
`workers: 1` / `fullyParallel: false` are correct, because the parallelism is across
runners. Each shard is its own process on its own machine, so each runs `globalSetup` and
takes its own free `CUBRIC_PORT` — confirmed in all four shards' logs.

## Phase 1 — paths-ignore

Proven by this card's own close: `854289ae`, the commit moving MPI-878 to `done`, is
board-only (`git diff-tree --name-only` — four files, all under `.agents/`) and it created
**no CI run at all**. Checked with `gh run list --limit 4` after the push: no run carries
that sha. The newest run at that moment was `e7e7a4f2`'s, a peer push that carried code
(`c6cb3e63`) and so correctly ran — which is the other half of the proof, that the skip is
not just "CI stopped firing".

Baseline for contrast: the two board commits immediately before this card, `8c74a29e` and
`423cb430`, each spent a full 17-minute Windows suite for nothing.

### What is NOT proven

`!docs/agent/**` — that those `.md` files still trigger the suite. It rests on GitHub's
documented last-match-wins ordering, not on a run. Proving it needs a real commit touching
`docs/agent/**`, which this card had no reason to make. The failure mode if the ordering is
wrong is silent: `tests/agent-corpus.test.cjs` (`:74`, `:139`) would stop running on the
only changes it covers. **Check it the first time anyone edits `docs/agent/**` — a run
should appear.**

## Scope kept

`.husky/pre-push` untouched. Both gates are exactly as they were; this card changed what CI
runs, never what it blocks. `red-master-watch.yml` untouched and gets more accurate for
free — the query it shares with the master gate now returns the last real CODE verdict
instead of whatever board commit happened to run last.

`docs/red-master.md` updated in the same commit: the artifact it told you to download
(`-n playwright-results`) no longer exists under that name, cause 5 named a step order that
is now two jobs, and the two-gate table did not mention that board pushes get no verdict.

## Numbers this card was opened on

48 h of master, 198 completed runs: 128 (65% of runs, 36.8 of 56 CI-hours) were
docs/`.agents`/`.md`-only. 21 reds, 8 of them on docs-only commits that had merely inherited
someone else's break. Six red episodes; five cleared in 19–42 min, one ran 475 min overnight
(the window MPI-866's watcher was built for). Method: `gh run list --limit 200` cross-checked
against `git diff-tree --name-only` per `headSha`.
