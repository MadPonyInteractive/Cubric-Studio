# MPI-857 — validation

Written 2026-09-21 during MPI-859's close-out. The work shipped on 2026-09-20 and the card was
never written up, so it sat in `doing` with an untouched checklist while its code was already on
origin. This file records what the commit actually proves.

## What shipped

`b2a6ecb2` — *"duplicate a GIF frame from the strip's right-click menu"*, **on `origin/master`**.

| file | what it carries |
|---|---|
| `js/components/Organisms/MpiFrameStrip/MpiFrameStrip.js` | the `Duplicate frame` row, the copy's identity token, the staged insert |
| `tests/desktop/gif-workspace.spec.js` | +94 lines covering the new row and the staged insert |
| `js/components/types.js` | the third menu row named in the strip's typedef |
| `docs/gif.md` | the menu documented |

## Checklist, item by item, against the diff

- **Duplicate frame in the right-click menu** — the strip's own doc comment now reads
  *"duplicates a frame (MPI-857), deletes it, or clears its cut-out mask"*, and the hover hint
  became `right-click to duplicate / delete / clear mask`.
- **The copy carries the source frame's mask, with no `_viewerPos` collision** — the copy takes a
  **negative** identity token: *"Identity for a frame no committed list held — a duplicate's copy.
  Negative so it can never collide with a committed index, which keeps `_viewerPos` …"*, and
  *"A duplicate's copy names its SOURCE's position, so the mask comes with it"*.
- **Staged only** — *"Staged like every other strip edit; the pill's …"*; `stage-change` now emits
  `{ frames, order }` for *"reorder, delete, duplicate or Discard"*.
- **Multi-thumb selection duplicates each frame after itself** — the staged API takes
  `@param {Set<number>|number[]} indices`.
- **Spec coverage** — +94 lines in `gif-workspace.spec.js` in this commit.
- **Docs + types name the row** — `docs/gif.md` and `js/components/types.js` both in the commit.

## CI

`b2a6ecb2` is an ancestor of `1d4215bd`, which CI passed (Tests run **35541611838**, conclusion
`success`). Its content has been through a green run.

## Not separately eye-checked by Fabio

He did not sign this one off frame-by-frame; he raised it on 2026-09-21 as a card that should
already have been closed, the code having shipped. Closing on the evidence above — commit on
origin, desktop spec, green tree — not on a rubber stamp.
