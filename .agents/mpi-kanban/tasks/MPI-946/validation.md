# MPI-946 validation

**Verdict: done.** Fabio restarted his app and dictated successfully (2026-09-27): "restarted, dictation works".

## Evidence

| Check | Result |
|---|---|
| `tests/deepinfra-transcribe.test.cjs` | 5/5 pass: fixed endpoint, data-URL body, `translate` task, status to code mapping, no upstream body leaks, 200-without-text is a failure |
| `npm test` | 1995 pass, 0 fail |
| `npm run lint` | clean |
| Live `_transcribe` with Fabio's key | exact text back for an 11 s WebM clip; a bad key maps to `NO_KEY` |
| `app:isolated` renderer | greyed + "needs a DeepInfra key" with no key; enabled when the key appears (`models:checked`); click record -> real route -> `NO_KEY` toast; stubbed success inserts at the caret with a separating space; hold Ctrl+Space fills the FOCUSED box, one request despite autorepeat, Ctrl-up first keeps recording, Space-up stops; the English toggle sends `?translate=1` |
| CI | run 36278564806 green on 6ee78cb83, which carries 77dfdee20 (this card's code commit) |
| Fabio, his own app, his mic and key | works, after a full restart |

## Cost

Four billed test calls, 42 audio seconds: **$0.00014** by DeepInfra's own usage record. The
per-call `inference_status.cost` claimed $0.0027 each (~70x too high); recorded in
`docs/dictation.md` so it is never surfaced.

## Found on the way

- A stale server (renderer reloaded, server not restarted) answers the route with the SPA's HTML:
  the mic shows but fails with `Unexpected token '<'`. Dev-only; a build ships both halves together.
- Master went red on 7df2f423b (MPI-945) from a lint error in MPI-944's committed research fragment.
  MPI-944 deleted the file (6ee78cb83); the root cause, `eslint .` linting `.agents/**` that CI and
  the pre-push gate both skip, is fixed in 55265f1d7.
- Privacy page: Dictation section pushed with Fabio's yes (Website repo 9ff2e4e).
