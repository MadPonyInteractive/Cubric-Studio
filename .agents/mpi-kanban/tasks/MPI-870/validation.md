# MPI-870 Validation

**Verify mode:** `user-ux` — the wake is an ending, and only Fabio can judge whether it
feels right. The server half is unit-testable and is verified here; the feel is not.

## Automated — 2026-09-21, PASSED

`npm test` → 1707 tests, 1704 pass, 1 skipped (the live DeepInfra run, no key), 1 `todo`
(MPI-867's deliberate one), 1 fail that is **not this card's**: `deepinfra-catalogue.test.cjs`
wants `comfy_workflows/display/seedream-45-cloud.webp`, which a live peer (claim `02c4c0ba`,
heartbeat 10:32Z) is mid-way through adding — their `models.js` and that test are both dirty in
the tree and a dozen sibling previews have landed. None of this card's files are involved.

`npm run lint` → clean (`--max-warnings=0`).

New coverage:

- `tests/agent-wake.test.cjs`, 8 tests — the drain is announced once and only when the LAST
  generation lands; it fires AFTER the auto-look note (a slow look proves the ordering, which
  is the difference between a wake that reports the description and one that speaks without
  it); an idle conversation with notes speaks once with no user bubble; a wake turn's tool list
  has no `open_project`/`create_project` while a typed turn's still does; a conversation that
  never ran, or has nothing pending, does not wake; **the project the renderer names is the one
  that wakes, never the one that drained**, and the drained one keeps its report until it is
  reopened; a turn already queued for that conversation wakes nothing; and the streak stops the
  fourth wake in a row, which one message from the user clears.
- `tests/agent-loop.test.cjs` `(l) one ask, many cards`, 7 tests — five cards fan out with no
  confirm into five dispatches through the normal path, each in the op's own required image
  slot with everything else shared; no auto-look on batch items; above five the card appears
  and **nothing dispatches before the answer**, No dispatches nothing, Yes runs all six; a
  reset while the card is up is a NO (the install path's truthy `'declined'` string would have
  read as Yes); one bad ref among four is reported per card and the batch still starts three;
  and a t2i op and a Flow are each refused by name.
- `tests/agent-loop.test.cjs` `(k)` gained the label test — an attachment (no sidecar) reads
  `Looking at image`, a card the auto-look already described reads `Fetching saved image
  description`, only one vision call is spent between them, and history carries the corrected
  label so a remount does not redraw the disproved claim.

## Live, in Fabio's own app — 2026-09-21, ALL THREE CHECKS PASSED

Every live check and every folded-in fix is verified in his own app, by him. The card is held in
`validating` rather than closed for ONE reason only: commit `9be177b8` is unpushed and CI has
not judged it. A card does not close on its own unjudged commit (`close-out.md`). Push, let CI
go green on it, then close — nothing else is owed.

### Check 3, the batch — PASSED, 11:26–11:28Z

Six i2i restyles from ONE ask in "Cowgirl on a Bull", one confirm, one chat line, one numbered
report. The fan-out is visible in `app.log` as six `generation.submit` calls **1.01 s apart** —
the loop paying `EARLY_REFUSAL_MS` per item, which is exactly the shape intended:

```
11:26:36.900  ill-anime:i2i — ratio=3:4 (asked), qualityTier=null (defaulted), denoise=0.3 (defaulted)
11:26:37.918  ill-anime:i2i — ratio=4:5 (asked), qualityTier=null (defaulted), denoise=0.3 (defaulted)
… four more, one per second …
```

**No auto-look on batch items, confirmed:** zero `[agent] look` lines inside the submit window
(11:26:36–41). The nine looks around it are three SOURCE images before the batch and six the
agent chose to make afterwards to write its report. Worth recording as a design fact rather than
a defect: the batch removes the AUTOMATIC vision calls; a wake turn may still spend them
deliberately, and here it did, and the report was better for it.

Those six lines are also fix 3 answering the question that started this whole track: denoise
`0.3` was **inherited**, not chosen. Before MPI-870 the sidecar said `0.3` and nothing on disk
could tell the two apart.

### Fix 1, the cache-read label — PASSED, 11:28Z+

He asked the agent to describe "Cowgirl arena 3D" (`i2i_010`), a card it had described minutes
earlier. The chat printed **`FETCHING SAVED IMAGE DESCRIPTION`** and served the kept text. No
new `agent.describe` job in the log. Screenshot in his 2026-09-21 message.

### Checks 1 and 2 — PASSED, 11:02–11:03Z

App booted 11:01:11Z, so the build carried every fix. He asked for one t2i in "Anime Kids and
Dog", **left for another project while it rendered**, and came back.

**Check 2 passed, which is the hardest of the three.** The generation drained while a DIFFERENT
project was open; nothing rendered into it; and the agent's report — "Your image is ready!
Here's what landed:" — arrived in the origin project's chat when he reopened it, with him never
typing. That is `agent:drained` -> renderer posts for the OPEN project -> no-op, then
`project:changed` on return -> the same post -> the conversation speaks. The "while you were
away" path, end to end, in his own app. Check 1 is covered by the same run: the wake turn spoke
without a typed message.

Both log-side fixes are proven live in `%APPDATA%\Cubric Studio\logs\app.log`:

```
11:02:58.197 [connector] agent named params — nano-banana-2-cloud:t2i — ratio=16:9 (asked), qualityTier=null (defaulted)
11:03:18.419 [agent] look FRESH result t2i_001.png: The image features three cartoon characters…
```

Fix 3 earned its keep immediately: it is what says the agent CHOSE 16:9 and INHERITED the tier.

Still owed: check 3 (the 6-card batch), and fix 1's label — that needs a SECOND look at a card
already described, which this run never made.

### Ruled out, diagnosed, and CLOSED: two cards from one generation

**Resolved 2026-09-21 by the `Deep Infra models 5` session (MPI-849), and independently
re-verified here.** Cause: one upstream DeepInfra call returned TWO entries in its `images`
array, and `generationService.js` builds one card per output url — so two cards, one dispatch.
Intermittent, not per-model; five other cloud cards on this box produced one card each. The fix
is a clamp in `/deepinfra/generate` to the count actually asked for; no card-side change.

**Fabio was NOT double-charged.** Checked against the files rather than taken on trust:

| Evidence | Value |
|---|---|
| Both groups' `createdAt` in `project.json` | `2026-09-21T11:03:11.161Z` — equal to the millisecond, so one completion |
| Both sidecars' `generationSettings.cost` | `usd 0.067257`, same reading timestamp `at: 11:03:10.579Z` — ONE cost object copied onto two cards |
| Sidecar `createdAt` | `.612` and `.901` — the save loop writing url[0] then url[1], which is the 290 ms gap |

`0.067257` is DeepInfra's published single-image rate for nano-banana-2. The second delivery was
free.

**Carried downstream to MPI-855:** both duplicate cards carry the FULL call cost, so any spend
readout that sums cost PER CARD over-counts. The ledger has to sum per call.

**The ranking half is MPI-849's,** not this card's and not MPI-817's: a paid cloud model must
never be an unprompted default. The agent-side requirement passed to them is that `rank: null`
reads as "unranked", not "avoid", so a cloud model needs either a rank below its local
equivalent or a note naming the price.

### The original finding, kept for the method

That run produced `t2i_001.png` and `t2i_002.png`. **Not the wake, and not this card.** One
`generation.submit` in the log (job `9ee72a7f`), one `card registered`, one `agent.describe`, no
second anything. The two files are exactly 1268870 bytes, written 290 ms apart, and differ in
SHA — which reads as two renders and is not. Parsing the PNG chunks: **concatenated `IDAT` is
byte-identical**, so the pixels are one image. The only differing chunk is `caBX`, Google's C2PA
provenance manifest, carrying a different `urn:c2pa:` uuid and signature per delivery. One
generation, fetched and saved twice, somewhere between the cloud result arriving and the card
being written. Fabio's own hint — some DeepInfra generations are extremely fast — fits a result
path that can be entered twice. Reported to the `Deep Infra models 5` session with the full
evidence, including the open question of whether the second fetch was BILLED.

## Live checks still owed

Services load at BOOT: `services/agentLoop.mjs` and `services/agentSessions.mjs` both need an
app restart before any of this can be checked. A reload is not enough, and the first test of
2026-09-21 ran a build from before every fix and proved nothing.

1. Ask for a generation, then do not type. Pass = the agent speaks when it lands, once.
2. Switch to another project mid-flight. Pass = nothing renders into the wrong project, and
   the report arrives when the origin project is reopened.
3. Ask for the same op over 6 cards. Pass = one confirm, one chat line, one result.

Worth a glance while checking 1: the chat should say `Fetching saved image description` on a
second look at a card it already described, and `logs/app.log` should carry one
`[agent] look CACHED|FRESH …` line per look and one `[connector] agent named params — …` line
per dispatch.


## CI — 2026-09-21, GREEN, and the card closes

Run [35594795855](https://github.com/MadPonyInteractive/Cubric-Studio/actions/runs/35594795855),
`conclusion: success` on `baee6cc0`.

`9be177b8` (the code) has no run of its own: it and `baee6cc0` went up in ONE push, and a push
gets ONE run, at the tip. So `baee6cc0`'s run IS the verdict on `9be177b8`'s code — the tree it
tested contains both commits. Read from `gh run view <id> --json conclusion`, never a watcher's
exit code (a piped `gh run watch` exits 0 on a red run).

That was the single thing this card was held in `validating` for. Everything else — the
automated suite, all three live checks, all three honesty fixes — was already recorded above and
confirmed by Fabio in his own app. Card moved to `done` / `complete`.
