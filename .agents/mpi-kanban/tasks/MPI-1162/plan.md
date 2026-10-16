# Card info hover popup — glance at how a card was made, without opening anything

## Current State

- Project mode: scalable-foundation.
- History rows (`js/components/Compounds/MpiHistoryList/MpiHistoryList.js`, row built ~L130-185) show only name + `W×H · ratio` (+ duration/fps for video).
- Gallery cards (`js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js` ~L1475-1530) show model+tier and op badge, `W × H · time` sub-line. Its own comment at L37 says "a real per-run detail panel is its own job" — this is that job.
- Every field needed is already on the in-memory HistoryItem (hydrated from the sidecar): `modelId`, `operation`, `flowId` + `generationSettings.flowModelIds`, `generationMs`, `pixelDimensions`, `duration`, fps, `createdAt`, `prompt`, `negativePrompt`, `notes`, `uploaded`. No extra fetch expected — verify `prompt` is populated on history entries before adding any lazy sidecar read.
- `MpiPopup` (`js/components/Primitives/MpiPopup/`) already portals to `document.body`, takes `triggerEl` + `position: 'left'`, but only flips top/bottom — left does not flip at the viewport edge.
- Label helpers to reuse, not copy: `tierLetterFor`, `getModelById`, `getCommand`, `_flowModelLabel` (currently private in MpiGalleryGrid — move to a shared util so both hosts use one copy).

## Design (approved 2026-10-16)

- New compound `MpiEntryInfo` (ComponentFactory, BEM `.mpi-entry-info__*`, CSS vars only), rendered inside `MpiPopup` `position: 'left'`, read-only.
- Hover-intent: opens after ~400 ms of the pointer resting on a row/card; moving across rows never flashes it. Closes when the pointer leaves BOTH the row and the flyout, after a ~150 ms grace so the gap can be crossed. Pointer inside the flyout keeps it open (text selectable, prompt copyable).
- One flyout instance per host, reused across rows (not one per row).
- Fields, in order, each omitted when empty: model + tier (or Flow model per `_flowModelLabel`; IMPORTED/RECORDED for uploads), operation / Flow label, time taken (same `m s` format as the gallery), size · duration · fps, created date (local), prompt (scrolls if long), negative prompt folded behind a disclosure, notes.
- **No seed** — users have nowhere to use it.
- Decisions taken (scalable-foundation front-load, agent's pick):
  - No room on the left (leftmost gallery column) → flip to the right. Do it in `MpiEntryInfo`'s positioning or as an opt-in on MpiPopup; must not change MpiPopup behaviour for existing callers.
  - Stack cards in the gallery: no flyout (N cards, no single "how").
  - Suppressed while dragging, while a context menu is open, and while the row is in rename mode; hidden on scroll and on workspace teardown.
  - Gallery card = its selected history entry (same data the History active row shows).

## Implementation

- [ ] Build `MpiEntryInfo` + hover-intent wiring, mount it from MpiHistoryList and MpiGalleryGrid, share the label helpers. **Verify:** unit test for the field builder (model/flow/upload/stack/no-seed cases + timing format) passes; `npm test` green for touched suites; in `npm run app:isolated`, hovering a History row and a gallery card opens the flyout after the delay, sweeping down the list does not flash, leaving row+flyout closes it, the prompt can be selected and copied, leftmost gallery column flips right.

## Completed

- [x] 2026-10-16 Built and wired: `js/utils/entryInfo.js` (field builder + `flowModelLabel` moved out of MpiGalleryGrid + shared `formatGenTime`), `js/components/Primitives/MpiEntryInfo/` (portal flyout + hover-intent `watch()`), hosts MpiHistoryList + MpiGalleryGrid, preloadStyles + types.js, `tests/entry-info.test.cjs`. Evidence in validation.md.

- [x] 2026-10-16 Fabio eye-tested: "looks good"; asked to drop resolution (already on the row/card) and label the operation row "Operation". Done.

- [x] 2026-10-16 Fabio: History only, not the gallery. Gallery wiring removed; the helper move out of MpiGalleryGrid stays (it still imports `flowModelLabel` / `formatGenTime`).

## Remaining Work

- Close-out only: commit, ask about `.claude/rules/` component maps + gallery demo page.

## Plan Drift

- 2026-10-16 MpiEntryInfo is a **Primitive**, not a Compound wrapping MpiPopup: both hosts are Compounds and may only import Primitives, and a Primitive may not import MpiPopup. It does its own body portal + left/right placement (~20 lines).
- 2026-10-16 Negative prompt: no disclosure control (there is no disclosure component and a Primitive cannot import MpiButton). It is clamped to 2 lines and opens while the pointer is on it.
- 2026-10-16 Prompt is already on the in-memory item (hydrated from the sidecar) — no lazy fetch needed.

## Verification

**Verify mode:** user-ux

Fabio eye-tests the delay, the close feel, placement and content in the running app. Agent pre-checks in `app:isolated` (never `:3000`) plus the field-builder test first.

## Preservation Notes

- New component: register its `.css` per `.claude/rules/components.md`; ask before editing `.claude/rules/` (component maps) at close-out.
- Update the `MpiGalleryGrid.js:37` comment once the detail panel exists.
- If `MpiPopup` gains a left/right flip, note it in its doc header.
