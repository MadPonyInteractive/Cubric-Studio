# MPI-754 Flow Library: filters, search and count

## Current State

- **Status (2026-09-14 14:24Z):** card in `doing`, checklist 1/3. Parallel Batch "foundations" DONE and verified (validation.md), all UNCOMMITTED: `js/data/flowsRegistry.js`, `tests/flow-type.test.cjs`, `docs/playbooks/add-flow/01-descriptor-and-ops.md`, `docs/playbooks/add-flow/README.md`, `js/components/Primitives/MpiFilterBar/{MpiFilterBar.js,MpiFilterBar.css}`, `js/shell/preloadStyles.js`, `js/components/types.js`. Claim `161a5093…` released as `complete`. Batch committed; handed off (`state/handoffs/6e73e610…`). **Next action: Phase 2 (Flow Library header)**, sequential not parallel (one file pair), user-ux stop at the end. Take a FRESH claim under the new session id first. MPI-752 is `done` (e742d82c), so Phase 3's first gate holds; re-check its claim and `git status` before Phase 3.
- **Project mode:** scalable-foundation. Every decision below is resolved with Fabio (2026-09-14); no task carries an open question.
- **Design:** [brief.md](brief.md). **Evidence with file:line:** [research/filter-bar.md](research/filter-bar.md), [research/flow-library.md](research/flow-library.md), [research/flow-type.md](research/flow-type.md).
- **Model Library today** (`js/components/Compounds/LandingPages/MpiModelManager/`): header row = Media tags + Tier tags + search `MpiInput` + Refresh (MM.js:64-79, 100-110, 196-238); filter Sets, list signature, media-block gating and predicates are consumer logic (MM.js:139-159, 1120, 1220, 1379-1385); CSS `MMc:91-174`, of which `:115-129` and `:161-172` restyle MpiButton/MpiInput chrome from outside (forbidden, `components.md:25`).
- **Flow Library today** (`js/components/Compounds/LandingPages/MpiFlowLibrary/`): title + plain `N ready · M need models` subtitle (FL.js:650), one MpiTileSheet per Image/Video/Audio section + "Other" (FL.js:627-679), full rebuild on every `open()` (FL.js:766-770), NO preview cache (FL.js:635). Not dev-gated since MPI-589.
- **Flow descriptors** (`js/data/flowsRegistry.js`): 15 flows, `mediaType` on each; no top-level `type` key exists or is read anywhere — `type` is safe.
- **Peers:**
  - MPI-752 (doing; only Fabio's two user checks left) holds a live claim on `MpiModelManager.js` + `.css` (session `b69d4b25…`) and owns `docs/releases/UNRELEASED.md` → Phase 3 and the release note wait for it.
  - MPI-591 (doing) — no live claim on `flowsRegistry.js`; its remaining ltx-extend `fields` edits sit near the `ltx-extend` descriptor. Insert `type:` beside each `mediaType:` by TEXT, never by line number.
  - MPI-751 parks the strict tier rule; `MpiFlowLibrary.js:12` and `MpiModelManager.js:3` (MpiOkCancel imports) are its known hits — do NOT fix them here.

### Resolved decisions

| Decision | Resolution |
|---|---|
| Type rule | create = makes new stuff · edit = changes existing stuff · enhance = improves existing stuff |
| Mapping | create: scribble, character-sheet, outpaint, ltx-extend, chatter-box, drama-box, minimax-music, sound-and-music, stems · edit: head-swap, scribble-object, object-stamp, ltx-foley, voice-changer · enhance: ltx-upscale |
| Key name | `type` (no collision) |
| Shared header | Primitive `js/components/Primitives/MpiFilterBar/`, draws its OWN tag buttons + search input (option a) |
| Gallery | NOT added to the component gallery |
| Subtitle | `<accent>N installed</accent> · M available — install a flow and its models fetch automatically.` — count covers ALL flows |
| Filter persistence | kept across close/reopen (Model Library parity) |
| No match | "No flows match — clear filters or search." |
| Matching | a flow shows only if it matches every group that has a selection; unknown `type` / "Other" media drop out while that group is active |
| Search | title + description, trim + lowercase; no autofocus (breaks `flows-tab-ring.spec.js`); no debounce |
| Detail drawer | filters never touch it (scrim covers the header while open) |
| Tag letter-spacing | keep shipped 0.14em (DESIGN.md:172 asks ≥0.16em — revisit at user-ux) |
| Test | validity of `type` only, not the mapping |
| Playbook | line in `01-descriptor-and-ops.md` AND `; type` in `README.md:137` checklist |

## Completed

- [x] **Parallel Batch "foundations"** (2026-09-14): flow `type` on all 15 descriptors + typedef + `tests/flow-type.test.cjs` + playbook lines; `MpiFilterBar` Primitive + CSS + preloadStyles line + typedef (appended at the END of `types.js`, not beside MpiTileSheet). Evidence in [validation.md](validation.md). Public API: props `{ groups, searchPlaceholder }`; `change { key /* group key or 'search' */, active /* Set copies */, query }`; `el.setActive` / `el.setQuery` do NOT emit; `el.appendTrailing(node)`; `el.destroy()`. BEM `mpi-filter-bar__{group,label,tags,tag,sep,search,search-input,trail}`.

## Remaining Work

## Parallel Batch: foundations

Both tasks are independent and file-disjoint. `mpi-execute-parallel` is appropriate for THIS batch only. Verify mode: auto.

- [x] **Flow `type` field.** Add `type: 'create' | 'edit' | 'enhance'` beside `mediaType:` on all 15 descriptors per the mapping; add the `@property {'create'|'edit'|'enhance'} type - …` typedef line after `mediaType` in the `FlowDef` block (same format, continuation indented to column 40) stating the rule; new `tests/flow-type.test.cjs` (ESM-from-CJS import pattern of `tests/flow-derived-fields.test.cjs:26-31`) looping every entry of `FLOWS` and asserting `type` is one of the three, naming the offending flow id on failure; playbook line after `mediaType` in `docs/playbooks/add-flow/01-descriptor-and-ops.md` (`type, // 'create' | 'edit' | 'enhance' — creates new / edits existing / enhances existing (always required).`) and `; type` appended to the descriptor checklist item at `docs/playbooks/add-flow/README.md:137`. Ownership: `js/data/flowsRegistry.js`, `tests/flow-type.test.cjs`, `docs/playbooks/add-flow/01-descriptor-and-ops.md`, `docs/playbooks/add-flow/README.md`. Briefings: root-cause (+ Critical Rules Snapshot). **Verify:** `node --test tests/flow-type.test.cjs` passes; `node -e "import('./js/data/flowsRegistry.js').then(m=>{const c={};m.FLOWS.forEach(f=>c[f.type]=(c[f.type]||0)+1);console.log(c)})"` prints `{ create: 9, edit: 5, enhance: 1 }`; `git diff js/data/flowsRegistry.js` shows only the 15 `type:` lines + typedef.

- [x] **`MpiFilterBar` Primitive.** New `js/components/Primitives/MpiFilterBar/MpiFilterBar.js` + `.css` via `ComponentFactory.create()`. Props `{ groups: [{ key, label, options: [{ value, label }] }], searchPlaceholder }`. Renders, per group, an uppercase label + its own `<button aria-selected>` tags (multi-select toggle; selected tag gets the `●` heat dot via `::after` in `var(--accent-heat)`), a 1px separator between groups, a search `<label>` with `renderIcon('search', 'sm')` + its own `<input autocomplete="off">`, and an empty trailing element. Emits `change { key, active: { [groupKey]: Set /* copy */ }, query /* trimmed, lowercased */ }` on every tag toggle and search input. Methods `el.setActive(key, values)`, `el.setQuery(q)`, `el.appendTrailing(node)` (append, never mount), `el.destroy()` removing every listener. Takes option VALUES only — never a descriptor property name. Listeners via `js/utils/dom.js` `on`; BEM `mpi-filter-bar__*`; CSS ported from `MpiModelManager.css:91-174` with the control chrome now owned by the bar (tokens only, 0.14em tag letter-spacing); imports nothing from `js/components/` except `factory.js`. Register the `.css` in the Primitives block of `js/shell/preloadStyles.js`; add an `MpiFilterBar` typedef (props, Emits, instance methods) to `js/components/types.js` modelled on `:543-561`. No gallery entry. Ownership: `js/components/Primitives/MpiFilterBar/MpiFilterBar.js`, `js/components/Primitives/MpiFilterBar/MpiFilterBar.css`, `js/shell/preloadStyles.js`, `js/components/types.js` (new MpiFilterBar typedef only). Briefings: components, dos_and_donts, events, root-cause. **Verify:** `npx eslint js/components/Primitives/MpiFilterBar js/shell/preloadStyles.js js/components/types.js --max-warnings=0` clean; `grep -n "^import" js/components/Primitives/MpiFilterBar/MpiFilterBar.js` lists only `factory.js`, `js/utils/dom.js`, `js/utils/icons.js` (plus clientLogger if used); `grep -nE "#[0-9a-fA-F]{3,6}\b|rgb\(|hsl\(" js/components/Primitives/MpiFilterBar/MpiFilterBar.css` returns nothing.

**Batch verify:** `npm test` green after both land.

## Phase 2: Flow Library header

Depends on BOTH batch tasks. Verify mode: **user-ux**. Ownership: `js/components/Compounds/LandingPages/MpiFlowLibrary/MpiFlowLibrary.js`, `js/components/Compounds/LandingPages/MpiFlowLibrary/MpiFlowLibrary.css`, `js/components/types.js` (MpiFlowLibrary typedef text ~1082-1092 only), `docs/playbooks/add-flow/04-overlay-and-shell.md`, `tests/desktop/flow-library-filters.spec.js` (new).

- [ ] **Mount the bar.** In setup, mount `MpiFilterBar` into a slot under `__sub` in `__head` with groups `media` [image/Image, video/Video, audio/Audio] and `type` [create/Create, edit/Edit, enhance/Enhance], placeholder `Search flows…`. Keep active Sets + query as setup-local state (survives reopen; library is mounted once, `shell.js:491`). `change` → update state → `renderList()`. Store the `on('change')` unsubscribe in `_unsubs` and call the bar's destroy in `el.destroy` (FL.js:776-784). **Verify:** `npx eslint js/components/Compounds/LandingPages/MpiFlowLibrary --max-warnings=0` reports no NEW warnings (the MpiOkCancel tier hit belongs to MPI-751).

- [ ] **Apply the predicates at one point.** In `renderList` (FL.js:659) build `visible = listFlows().filter(passesMedia && passesType && passesSearch)` (search over `title` + `description`) and feed it to the section loop, "Other" bucket included; empty groups = all. `_renderSub`, `_patchTile` and `_patchAllAffected` stay on the unfiltered `listFlows()`. Add a no-match branch — flows exist but none visible — rendering "No flows match — clear filters or search." with the existing `.mpi-flow-library__empty`. Do not touch the detail drawer. Keep `sheet.on('select', ({ item }) => _pick(item.source))` byte-identical (`tests/flow-model-choice.test.cjs:586-587`). **Verify:** `node --test tests/flow-model-choice.test.cjs tests/flow-lora-rack.test.cjs tests/flow-licence-surface.test.cjs` passes.

- [ ] **Preview cache (root cause of keystroke cost).** Add a consumer-owned `_previewCache` Map and pass it to every `MpiTileSheet.mount` in `_block` (FL.js:635), the Model Library's pattern (MM.js:175-181, 1206; `docs/model-library.md:112-122`). No debounce. **Verify:** in YOUR OWN `npm run app:isolated` instance (never `:3000`), open Flows, type `v`, `vo`, `voi` in search and clear it: thumbnails stay painted on every rebuild (screenshot / real-pixel probe).

- [ ] **Subtitle count.** `_renderSub` writes `<span class="mpi-flow-library__count">${readyN} installed</span> · ${total - readyN} available — install a flow and its models fetch automatically.` (numbers only interpolated — no user text). CSS: `.mpi-flow-library__count { color: var(--accent-heat); }` restated in FLc; `.mpi-flow-library__sub` margin-bottom `var(--s-4)` to match MMc:73. **Verify:** eslint clean; isolated instance shows the accented count with the same spacing as the Model Library header.

- [ ] **Guard spec.** New `tests/desktop/flow-library-filters.spec.js` (follow `tests/desktop/flow-library-skips-drawer.spec.js` mount pattern): Type=Enhance → exactly one tile, "Upscale Video"; Media=Audio + Type=Create → 5 tiles (Text to Speech, DramaBox, Song, Sound & Music, Stems); search `voice` with no tags → "Voice Changer" and "Text to Speech" present; a nonsense query → the no-match message; close + reopen → selections still applied. **Verify:** `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-library-filters.spec.js tests/desktop/flow-library-skips-drawer.spec.js tests/desktop/flow-uninstall-button.spec.js tests/desktop/flows-tab-ring.spec.js` passes.

- [ ] **Docs.** Remove the "no media/size filters" + dev-gated wording from the FL.js header comment (:39, :47-48) and the MpiFlowLibrary typedef in `js/components/types.js` (~1082-1092); describe the header (filters, search, count) in `docs/playbooks/add-flow/04-overlay-and-shell.md` (:10, :32). **Verify:** `grep -n -i "no .*filters\|dev-gated" js/components/Compounds/LandingPages/MpiFlowLibrary/MpiFlowLibrary.js js/components/types.js docs/playbooks/add-flow/04-overlay-and-shell.md` returns no stale Flow Library claim.

**Phase verify:** `npm test` green; the Playwright command above passes; Fabio opens Flows in the app (renderer reload picks up the tree) and compares the header to the Model Library — look, spacing, tag feel, count, tail wording. STOP here for his check.

## Phase 3: Model Library onto MpiFilterBar

**Gate — do not start until all three hold:** MPI-752 is in `done`; no live `active_file_claims` record in `.agents/mpi-kanban/state/index.json` covers `MpiModelManager.js`/`.css`; `git status --short js/components/Compounds/LandingPages/MpiModelManager/` is empty. Verify mode: **user-ux**. Ownership: `js/components/Compounds/LandingPages/MpiModelManager/MpiModelManager.js`, `js/components/Compounds/LandingPages/MpiModelManager/MpiModelManager.css`, `docs/model-library.md`, `docs/releases/UNRELEASED.md`.

- [ ] **Swap the markup and wiring.** Replace the template filter row (MM.js:64-79), the search `MpiInput` mount (:100-110), `_mkTag` + tag wiring (:196-233) and the search listener (:235-238) with one `MpiFilterBar` mount: groups `media` [image, video] and `tier` [`TIER_ORDER` × `TIER_WORD`], placeholder `Search models…`; move the Refresh button in with `bar.el.appendTrailing(...)`. Bar `change` → rewrite `_mediaActive` / `_filterActive` / `_searchQuery` → `renderList({ force: true })`. Keep the Sets, the list signature (MM.js:~1115-1120 must still include filter state), media-block gating, predicates, plugin search and `_activeDetail` reopen untouched. Remove the now-unused `MpiInput`/`mountButton` imports only if nothing else uses them. Destroy the bar in `el.destroy`. **Verify:** `npx eslint js/components/Compounds/LandingPages/MpiModelManager --max-warnings=0` reports no NEW warnings; `npm test` green.

- [ ] **Delete the moved CSS.** Remove `MMc:91-174` (`__filters`, `__filter-group`, `__filter-label`, `__tag`, `__filter-sep`, `__search`, `__search-slot`, incl. the forbidden MpiButton/MpiInput restyle); keep `__disk` and whatever `__refresh` sizing is still needed. **Verify:** `grep -rn "mpi-model-library__\(tag\|search\|filter\)" js/` returns nothing.

- [ ] **Docs + release note.** Update `docs/model-library.md` wherever it describes the filter row; one line in `docs/releases/UNRELEASED.md` covering the Flow Library filters/search/count. **Verify:** isolated instance: Media and Tier toggles + search filter the Model Library exactly as before, Refresh sits at the row's end; Fabio's side-by-side check of both overlays.

## Plan Drift

- 2026-09-14: `MpiFilterBar.setup()` event wiring has no headless check (no DOM harness in the repo); only `template()` was probed. Phase 2's guard spec must therefore exercise toggle, search, persistence AND a destroy/remount, not just filtering results.
- 2026-09-14: a worker rewrote `types.js` / `preloadStyles.js` with CRLF endings (repo is `*.js eol=lf`). Fixed by the orchestrator. Tell Phase 2/3 workers to keep LF, and byte-count CR in each touched file before accepting a report.
- 2026-09-14: MPI-752 moved to `done` (e742d82c) during planning, so Phase 3's first gate now holds.

## Verification

**Verify mode:** user-ux (Parallel Batch: auto · Phase 2: user-ux · Phase 3: user-ux)

End to end:
- Flow Library header matches the Model Library: same filter row look (one `MpiFilterBar` in both), Media Image/Video/Audio + Type Create/Edit/Enhance, search over title + description, accented `N installed · M available — install a flow and its models fetch automatically.`
- Filters and search compose, persist across reopen, empty-match message shows; thumbnails never blank while typing.
- Every flow has a valid `type` (test), and the add-flow playbook + checklist require it.
- `npm test` green; `tests/desktop/flow-library-filters.spec.js` + the three existing flow-library specs pass on an isolated instance — never Fabio's `:3000`.
- Model Library filters behave as before on the shared bar, with no `mpi-model-library__tag|search|filter` CSS left.

## Preservation Notes

- **Rule-map drift — ask Fabio before editing (CLAUDE.md rule 5):** `.claude/rules/component-mounts.md` (:180-181, :246-253 Flow Library + Model Library mounts) and `.claude/rules/component-events-primitives.md` (new `MpiFilterBar` `change` entry, format at :95).
- `docs/component-contracts.md`: optional `MpiFilterBar` entry beside MpiTileSheet (:89-95) — "Primitive because both libraries are Compounds"; external setters required (:121).
- **Stale, out of scope (spotted in research):** `.claude/skills/mpi-add-flow/SKILL.md:24,62` say flow outputs are image|video / no AUDIO; `flowsRegistry.js:4,18`, `SKILL.md:8,82`, `docs/testing-desktop-specs.md:26` still call the Flow Library dev-gated (ungated since MPI-589). Offer a separate card at close-out.
- Tag letter-spacing 0.14em vs `DESIGN.md:172` ≥0.16em — confirm at the Phase 2 user-ux check.
- MPI-755 (deferred) adds disk used beside both counts; this card's subtitle markup is where it lands. Totals must sum the UNION of on-disk dep ids once.
- Message `c921626a…` (open, to MPI-752) records the per-model `onDiskBytes` double-count trap.
