# MPI-757 validation — GIF workspace umbrella

**An umbrella closes on its members' evidence.** There is no umbrella-level check:
this card carried no code of its own until the close-out edit below, and every
behaviour it promised was verified on the member card that built it. Each member's
own `validation.md` is the record.

## Members

| Card | Outcome | Evidence |
|---|---|---|
| MPI-768 | complete | `tasks/MPI-768/validation.md` |
| MPI-759 | complete | `tasks/MPI-759/validation.md` |
| MPI-769 | complete | `tasks/MPI-769/validation.md` |
| MPI-770 | complete | `tasks/MPI-770/validation.md` |
| MPI-771 | complete | `tasks/MPI-771/validation.md` — Fabio verified live 2026-09-19 |
| MPI-772 | complete | `tasks/MPI-772/validation.md` |
| MPI-773 | complete | `tasks/MPI-773/validation.md` |
| MPI-760 | complete | `tasks/MPI-760/validation.md` |
| MPI-758 | **rejected** | closed without being built; the decision is the record |

Raised after the plan's member table was written, and also done:

| Card | Outcome | Evidence |
|---|---|---|
| MPI-857 (duplicate a frame) | complete | `tasks/MPI-857/validation.md` |
| MPI-858 (transparent clip came back black) | complete | `tasks/MPI-858/validation.md` |
| MPI-871 (playback ignored the trim bar) | complete | commit `3417bb87`, CI run 35587954794 green, Fabio verified live 2026-09-21 |

## The two open items the handoff carried

**1. Frame-strip highlight polarity — NOT A DEFECT. The note was stale when it was
written down.** It was recorded 2026-09-19, and MPI-859 landed on 2026-09-20 and
removed the thing it described. The store no longer holds "what stays": it holds
what gets cut (`MpiGifViewer.js` § "NO COMPLEMENT HERE"), drawn as itself. The strip
reads that same store — `_emitMasks()` sends `_masks.overlay()`, which is
`overlayAt()` per position, with no inversion anywhere between the store and
`MpiFrameStrip`'s `thumb-tint`. Stage and strip therefore highlight the same pixels,
and both mean "this goes". The only remaining difference is deliberate and
documented in `gifFrameMasks.js`: the stage draws a pending proposal as a separate
green layer over the white, while the strip folds it into one tint — "one thumb, one
tint". No code changed.

**2. Cross-Organism import — FIXED, Fabio authorised it 2026-09-21.** `gifTiming.js`
moved from `Organisms/MpiToolOptionsGifTiming/` to `js/utils/`, and MPI-871's
`eslint-disable mpi/no-same-tier-component-import` is gone with the reason for it.
Four of the module's five consumers were never that panel: `MpiGifViewer`,
`MpiGroupHistoryBlock`, `js/shell/gifJobs.js` and `tests/gif-timing.test.cjs`. The
lint rule's `locate()` returns null outside `js/components/`, so a `js/utils/` import
is not tier-checked at all — the disable is not being relocated, it is not needed.

Verified:

- `npm run lint` (`eslint . --max-warnings=0`) — clean, so the disable was genuinely
  the only thing holding the old import up.
- `node --test tests/gif-timing.test.cjs tests/connector-gif-jobs.test.cjs` — 30/30
  pass, including `rangeBounds` and the `GIF_HANDLERS` dispatch that `gifJobs.js`
  feeds.
- `git mv` recorded as a rename (`R`), so the module's history follows it.
- No `MpiToolOptionsGifTiming/gifTiming` reference remains in code; the three
  surviving hits are historical board records (MPI-836 `files.json`, MPI-871
  `plan.md` / `brief.md`) and are left as written.
