# MPI-830 — validation

**Verify mode:** auto

## Automated — run 2026-09-19, all green

| Check | Result |
|---|---|
| `node --test tests/connector-gif.test.cjs` | 19 pass, 0 fail |
| `node --test tests/connector-gif-jobs.test.cjs` | 24 pass, 0 fail |
| `node --test "tests/**/*.test.cjs"` (the whole suite) | 1512 tests, **1511 pass, 0 fail** |
| `npx eslint js/shell/gifJobs.js js/shell/agentDispatch.js --max-warnings=0` | exit 0 |
| `npm run release:check` | fails, and **not on this card** — see below |

`release:check` was already red before this card: it wants archival release notes for
1.6.0 and 1.6.1, and reports `smoke-evidence.json` stale against an engine pin that
moved on 2026-09-17. Neither names a file this card touched, and it raised nothing
about `connector-manifest.json`, the only release artefact here.

## What the tests actually pin

- **Route level** (`tests/connector-gif.test.cjs`) drives a real socket with a fake
  renderer subscribed over SSE, the `tests/connector-named-params.test.cjs` idiom,
  and asserts the JOB the renderer receives. A payload that arrives mangled would
  otherwise come back `ok: true` and only show up in the app.
- **Handler level** (`tests/connector-gif-jobs.test.cjs`) runs the real module over a
  stubbed `fetch` and the real `state`, asserting the REQUESTS it makes and the
  project it leaves behind: a new card for `make` / `to-video`, a new history entry
  for `edit` / `cutout`, `loop: 0` surviving as a value rather than being dropped as
  falsy, and `fps: 8` landing as delay 13 — `gifTiming.js`'s own rounding, not a
  second copy of it.

## A bug the tests caught before it shipped

Writing the legacy-GIF test showed `_findGif` deciding "is this a GIF" on
`gif.frames`. A GIF imported before MPI-768 has `gif: null`, so every legacy GIF
would have been refused as `NOT_A_GIF` — and `_ensureFrames`, the whole point of
`POST /gif/ensure-frames`, was unreachable dead code behind it. The file decides
now, and the store is filled on demand; `tests/connector-gif-jobs.test.cjs` pins
both the extraction and the case where extraction yields nothing.

## The engine leg — VERIFIED by Fabio, 2026-09-20

The one thing no stub could prove. Fabio ran a cut-out himself, in his own app, on his
own GPU, and reported it plainly: *"I ran a cutout, and it's verified. It used the GPU,
and it was fine."*

That is the whole of what this card was held open for, and it closes it.

**It was the `background` method** (Fabio, asked which): BiRefNet, the `gifCutoutBirefnet`
op, no prompt. So the verified path is body -> route -> renderer job -> `/gif-cutout/source`
-> `runGifCutoutTrack` -> `/gif-cutout/apply` -> a transparent entry on the card, end to end
on a real GPU.

**`method: "name"` needs no separate run** (Fabio, 2026-09-20: *"why do we have to prove it
again? We've already done that multiple times."* — he is right, and an earlier draft of this
section asked for a curl that would have re-proven what three records already hold). Every
leg of it is covered:

| Leg | Already proven by |
|---|---|
| The SAM3 graph + `runGifCutoutTrack` | **Live, 2026-09-16** — a real 30-frame extract of a real mascot clip, bare prompt `"robot"`, 30 clean masks back (`docs/masking-sam3-gif.md`) |
| The `name:N` stamp | `tests/mask-text-prompt.test.cjs` — including the `:1` trap and re-stamping an already-stamped prompt |
| Route → renderer job → `/gif-cutout/source` → `/gif-cutout/apply` → the entry | **Fabio's `background` run above.** Identical code path; `method` changes one `op` string and adds two params |
| Those two params | `tests/connector-gif.test.cjs` asserts the prompt reaches the job; `gifJobs.js` passes `objectIndices: ''`, which is the graph's own "keep every tracked object" |

What is left is composition, not an unproven component: nobody has run that exact
combination end to end. That is a fair thing to notice the first time someone uses it, and
not a reason to hold a card open.

He did not say which clip or which settings, so nothing about those is claimed here.

## A gap found after the routes shipped — no card, Fabio's call

**An outside agent cannot get a file into a project as a CARD.**
`POST /project-media/:id/upload` takes an absolute `sourcePath` (MPI-670), writes the
file, the sidecar and the derivatives, and returns an `itemId` — but the gallery card is
created in the renderer (`js/services/mediaUploadService.js` → `mediaImportService`),
exactly the hole this card closed for GIFs. So the footage has to already be in the
project: dropped in by the person, or generated there.

It did NOT block the job this was built for. `Cubric Studio Mascots`
(`C:\Users\Fabio\Documents\Cubric Vision\Projects\Cubric Studio Mascots`) already
held **138 video cards** and 12 image cards when measured on 2026-09-19, and ONE of
those 12 was already a GIF (a GIF is an image sidecar, `docs/gif.md`) - not a thirteenth
card. Re-measured 2026-09-20: 13 images, 2 of them GIFs, Fabio having made another — Fabio's mascot
clips are cards already, so `gif.make` finds them by id today.

If it is ever wanted, it is the same shape as the four verbs here and small:
`POST /connector/import { sourcePath, name? }` → a `media.import` job → upload, then
`_landNewCard`. One wrinkle: the upload route fills `pixelDimensions` from `probeVideo`
for a video but NOT for an image (the renderer normally measures those and posts
`width`/`height`), so an image imported this way would land 0x0 unless the route reads it
with sharp first. Documented as a limitation in
`.claude/skills/cubric-vision-gif/SKILL.md` § Getting footage in.

## Claim audit, 2026-09-20 (close-out)

Read-only auditor over this card's six commits and the skill doc: **28 PROVEN, 0 FALSE,
2 OVERSTATED.** Both overstatements were re-verified against source before acting, per
the rule that its findings are evidence and not verdicts.

1. **"12 images and one GIF" — real, corrected above.** A GIF card IS an image sidecar,
   so the phrasing read as 13 cards when the count was 12 with one of them the GIF. Now
   stated as 12 of which one, and dated, because re-measuring on 2026-09-20 already gives
   13 and 2.
2. **`APP_UNAVAILABLE` / `TIMEOUT` "absent from `routes/connectorGif.js`" — NOT a defect,
   no edit made.** Both are raised inside `dispatchToRenderer` in `routes/connector.js`,
   which every verb here calls through `_run()`, so they genuinely do fire for these
   routes and the skill doc's table is right. The finding is an artifact of the audit
   instruction naming one file; the auditor said as much itself.

Proven along the way, worth keeping because each was a place this card could have lied:
43 tests really are 19 + 24; `fpsToDelay(8)` really is 13; `editGif` really refuses
crop + resize together; the `_findGif` legacy-GIF fix really is in the committed code;
and `exportGif` really is still a live registry key after MPI-760's rename.
