# MPI-823 — validation

## The defect, measured before the fix

`js/core/storage.js` runs `normalizePromptReuseOptions()` on the WRITE as well as the read,
and it only knew five keys. The Settings grid (`REUSE_PARTS`) and `MpiReusePromptDialog`
both set seven. Driving the real module with a stubbed `localStorage`:

```
raw localStorage  : {"ask":false,"prompt":true,"settings":true,"model":true,"images":true}
after restart     : {"ask":false,"prompt":true,"settings":true,"model":true,"images":true}
video survived    : false
audio survived    : false
```

In-session behaviour was correct — `state.promptReuseOptions` holds the full object — so the
untick worked until the app was closed, which is why it read as "Reuse just ignores my
setting sometimes" rather than as a storage bug.

## The fix

`DEFAULT_PROMPT_REUSE_OPTIONS` and `normalizePromptReuseOptions` both carry `video` and
`audio`, on the same `!== false` default-ON rule as the other parts. No consumer changed:
`MpiGalleryBlock`, `MpiGroupHistoryBlock` and `MpiReusePromptDialog` already read
`options.video` / `options.audio`, and were the reason the drop was invisible in-session.

## Evidence

`tests/prompt-reuse-options-persist.test.cjs` — reads the part list out of MpiSettings'
own `REUSE_PARTS` block rather than repeating it, so an eighth part added to the UI without
teaching the store about it fails here. It asserts both that the unticked part reaches
localStorage and that it comes back off after a re-read.

Green on the fix:

```
✔ every Settings reuse part survives a restart (5.6296ms)
✔ a fresh store reads every part as ON, and ask defaults ON (0.459ms)
ℹ pass 2  ℹ fail 0
```

RED on pre-fix code — `js/core/storage.js` restored from `HEAD` for one run, the test file
untouched:

```
--- pre-fix storage.js in place, running test ---
ℹ fail 2
```

Full suite: `npm test` — see the run recorded in the card's events.
