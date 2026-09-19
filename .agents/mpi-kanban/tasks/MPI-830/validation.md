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

## What is NOT proven here, and needs the user's own app

The cut-out's engine leg. `runGifCutoutTrack()` reaches `getEngine()` and a real
ComfyUI, so no stub can prove it: its guards are tested, the graph is not. A live
check would be, in Fabio's own app with a GIF card open:

```bash
curl -s -X POST http://127.0.0.1:3000/connector/gif/cutout \
  -H 'Content-Type: application/json' \
  -d '{"itemId":"<the gif item id>","method":"background"}'
```

and the same again with `{"method":"name","prompt":"robot"}`. Expect a new
transparent entry on the same card, one per call. Offered, not run: driving `:3000`
is the user's own session.
