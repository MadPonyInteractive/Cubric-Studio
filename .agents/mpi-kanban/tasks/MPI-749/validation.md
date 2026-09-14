# MPI-749 Validation

## Phase 1: asset kinds, filter logic, card corner icon (verify: auto). PASSED 2026-09-14

**Unit + lint**

- `node --test tests/asset-kinds.test.cjs tests/gallery-filter.test.cjs` → 13/13 pass.
- `npm test` → 990/990 pass, 0 fail.
- `npm run lint` (`--max-warnings=0`) → clean.
- `renderIcon('filter','sm')` and `renderIcon('cube','sm')` → `<svg>` containing a `<path>`, each from
  its own `ICONS` entry (not the `info` fallback).

**Live DOM check.** Own instance `CUBRIC_E2E=1 npm run app:isolated` (port 54679, local engine gate
skipped per its log), Chromium via `playwright-cli -s=mpi749`, `MpiGalleryGrid` mounted standalone in
a 1600×900 host on real shipped media (`comfy_workflows/display/`).

Initial mount:

| card | selected item | `--kind` class | chip | data-kind | data-info |
|---|---|---|---|---|---|
| k-img | image | false | `display:none` | image | Image |
| k-vid | video | true | `flex`, 28×28, svg path | video | Video |
| k-scene | image + `splatPath` | true | `flex`, 28×28, svg path | scene | 3D Scene |
| k-aud | audio | false | `display:none` | audio | Audio |
| k-mix | video (history: video, image) | true | `flex`, 28×28, svg path | video | Video |
| k-prev | video, `stage:'preview'` | true | **`display:none`** under `--preview` | video | Video |

After `el.setGroups(...)` (the render-key path) and `el.markQueuedContinue('k-vid', true)`:

| card | change | `--kind` class | chip | data-kind |
|---|---|---|---|---|
| k-mix | `selectedIndex` 0 → 1 (the image item) | false | `display:none` | image |
| k-img | same item gains `splatPath`; type, index and file unchanged | true | `flex` | scene |
| k-vid | queued-continue | true | **`display:none`** under `--queued-continue` | video |

The k-img row is what proves the `_getGroupRenderKey` kind entry: nothing else in the key changed, so
without it the card would not have repainted.

Screenshots: [before](research/phase1-kind-chip-before.png) (camera chip on the video card, cube on
the 3D Scene card, none on image or audio) and [after](research/phase1-kind-chip-after.png) (cube on
the image card that gained a splat; none on the queued video card, whose CANCEL row owns the corner).
The mixed and preview cards sit below the host's fold, and the DOM tables cover them.

Not exercised live: the `--mascot-cooking` hide. It is the same selector shape as the two hides verified above.
