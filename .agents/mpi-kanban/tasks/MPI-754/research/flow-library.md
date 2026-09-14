# MPI-754 research — Flow Library consumer side (read-only investigation, 2026-09-14)

FL = `js/components/Compounds/LandingPages/MpiFlowLibrary/MpiFlowLibrary.js`, FLc = its .css, MM/MMc = MpiModelManager .js/.css, TS = `js/components/Primitives/MpiTileSheet/MpiTileSheet.js`.

## 1. Render path + where predicates go
- `el.open()` shows overlay + calls `renderList()` every time (FL:766-770); no signature check (FL:655), unlike MM:1370-1372.
- `renderList`: destroys sheets + clears body (FL:656-657), `_renderSub()` (660), registry-empty message (662-667), one `_block` per `MEDIA_SECTIONS` + "Other" bucket (670-679).
- `_block` returns early on an empty list (627-628) → no header; count = `items.length` (632); no `previewCache` passed (635).
- `download:*` never rebuilds: `_patchTile` fans `patchState` to every sheet (685-690); progress (702-710); start/complete/cancel re-render the drawer (730-732). `patchState` on an absent tile no-ops (TS:213-216) → filtering keeps MPI-235 safe.
- Predicates go at FL:659: `visible = listFlows().filter(media && type && query)` feeding the section loop. Search on `title` + `description` (description used at 466). Media filter hides sections via `_block`'s early return.
- Count: Model Library counts ALL (`MODELS.filter(isInstalled)`, MM:1397); only section counts filter (MM:1200, 1218). `_renderSub` must stay on `listFlows()` — `_patchAllAffected` calls it with no filter state (FL:696).

## 2. Rebuild cost
- MM force-rebuilds per tag click AND per keystroke, no debounce (MM:211-216, 235-238). Safe only because thumbs survive via a consumer-owned preview cache (MM:175-181, 1206; `docs/model-library.md:112-122`).
- FL passes no cache → fresh lazy `<img>` per rebuild (TS:100-124) = the MPI-394 blank-grid bug on every keystroke. Sheet teardown is cheap (TS:229-233).
- Pattern: `_previewCache` Map passed to `MpiTileSheet.mount` in `_block`; filter/query change → `renderList()` directly. No debounce (`js/utils/async.js:13` has no cancel → could fire after destroy). Store the bar's unsub + destroy in `el.destroy` (FL:776-784).

## 3. Empty state
MM: "No models match — clear filters or search." (MM:1400-1404). FL only handles empty registry (FL:662-667); add a no-match branch reusing `.mpi-flow-library__empty` (FLc:129-134, same as MMc:226-231).

## 4. Detail drawer
MM re-opens `_activeDetail` from full `MODELS` after rebuild (MM:1419-1422). Scrim covers the whole library incl. header (`inset:0; z-index:30`, FLc:144-153; template FL:65-72), so filters are unreachable while the drawer is open. Rule: filters never touch the drawer; `renderList` already ignores it (655-680); `_patchTile` looks up via `listFlows()` (686-689).

## 5. Header visual diff
- Same: `__head` padding/border (FLc:50-54 vs MMc:56-60), `__title` (FLc:88-94 vs MMc:62-68), root font/background (FLc:36-46 vs MMc:39-51).
- Differs: `__sub` margin-bottom `0` (FLc:98) vs `var(--s-4)` (MMc:73); count accent `--accent-heat` (MMc:76-78) absent — FL writes `textContent` (FL:650), needs markup.
- Back chip FL-only (FLc:60-86), sits above the title; a row under the sub doesn't move it.
- Filter CSS is `mpi-model-library__*` (MMc:91-174) → shared bar owns its own; borrowing another component's classes is the trap in `docs/component-contracts.md:95`. Restate `.mpi-flow-library__count` in FLc.

## 6. Tests/docs pinning the surface
- No test checks subtitle wording.
- Source-text tests: `tests/flow-model-choice.test.cjs:586-587` expects `sheet.on('select', ({ item }) => _pick(item.source))` verbatim; `tests/flow-lora-rack.test.cjs:243-252`; `tests/flow-licence-surface.test.cjs:192-199`.
- Desktop specs find `.mpi-tile` text on a fresh mount (`tests/desktop/flow-library-skips-drawer.spec.js:65-77`, `tests/desktop/flow-uninstall-button.spec.js:91-100`) — safe while filters start empty.
- `tests/desktop/flows-tab-ring.spec.js:94-97` presses Tab inside the library; Tab is blocked while typing (`hotkeyRegistry.js:322`, `hotkeyManager.js:163,189`) → never autofocus search.
- Docs to update: `docs/playbooks/add-flow/04-overlay-and-shell.md:10,32`; `js/components/types.js:1082-1092` ("No … filters"); FL header comment FL:39,47-48. Rule map `.claude/rules/component-mounts.md:246-249` (permission). `docs/flows.md` is a pointer (:7).
- No Node harness can render components (`docs/testing-harnesses.md:49-60`); use `npm run app:isolated` (§4, :152) or an in-page mount like the desktop specs.

## 7. Resolved decisions (Fabio / defaults, 2026-09-14)
- Tail: "— install a flow and its models fetch automatically."
- Filters + search persist across reopen (library mounted once, `shell.js:491`; MM keeps them, MM:1644-1648).
- Unknown `type` / "Other" media bucket: excluded while that group has an active selection (a flow is shown only when it matches every active group).

## 8. Risks
- Flow Library is NOT dev-gated since MPI-589 (`shell.js:480-482`; `listFlows` ungated `flowsRegistry.js:2785-2787`); stale wording in `types.js:1085`, `docs/testing-desktop-specs.md:26`.
- The missing cache is the root cause of keystroke cost; a debounce would mask it.
- Escape the query if it is ever echoed into markup.
