# MPI-754 Brief

Approved in brainstorm 2026-09-14. The Flow Library overlay must look and filter like the Model Library overlay.

## Flow type

New descriptor field `type: 'create' | 'edit' | 'enhance'` beside `mediaType` in `js/data/flowsRegistry.js` (+ typedef).

Rule, in Fabio's words: anything that creates stuff is `create`, anything that edits existing stuff is `edit`, anything that enhances existing stuff is `enhance`. Three types only; no fourth bucket.

| Type | Flows |
|---|---|
| create (9) | scribble, character-sheet, outpaint, ltx-extend, chatter-box, drama-box, minimax-music, sound-and-music, stems |
| edit (5) | head-swap, scribble-object, object-stamp, ltx-foley, voice-changer |
| enhance (1) | ltx-upscale |

Guard: a small test fails when any flow lacks a valid `type`. One line in the add-flow playbook's descriptor step (so `/mpi-add-flow` inherits it).

## Header (approach A)

- New shared filter-bar **Primitive** `MpiFilterBar` (tag groups with separators + search), used by BOTH overlays. Primitive, not Compound: the tier rule parked in MPI-751 blocks Compound -> Compound. It draws its OWN tag buttons and search input (Primitives import nothing; precedent MpiRadioGroup, MpiTreePicker) — option (a), Fabio 2026-09-14. Not added to the component gallery (Fabio, 2026-09-14).
- Flow Library groups: Media (Image / Video / Audio), Type (Create / Edit / Enhance). Multi-select; empty group = all. Same look as the Model Library's `__filters` / `__tag` / `__search`.
- Search matches flow title + description.
- Image/Video/Audio section headers stay; the Media filter hides whole sections (Model Library `_mediaBlock` gating).
- Subtitle mirrors the Model Library's: accented `N installed` + `· M available — install a flow and its models fetch automatically.` (tail wording from Fabio's "Install Flow and its models and dependencies. Install automatically.", tightened to mirror the Model Library line; revisit at the user-ux check). A flow is installed when `flowAvailability` says available. Count covers ALL flows, never the filtered set. (Today: plain `N ready · M need models`.)
- Rejected: B, copying the Model Library markup/CSS into the Flow Library (two copies drift, e.g. the Size -> Tier rename).

## Sequencing

Put the Primitive into the Flow Library first; migrate the Model Library after MPI-752 (owns `MpiModelManager.js`/`.css`) closes. MPI-591 (doing) touches `flowsRegistry.js`.

## Out of scope

Disk space used in either header: MPI-755 (deferred).
