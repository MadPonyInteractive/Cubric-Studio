# MPI-754 research — shared filter bar (read-only investigation, 2026-09-14)

## 1. Tier verdict + legal home
- Live rule `.eslint-rules/no-same-tier-component-import.js` only flags import specifiers containing `/Compounds/` (`:39`), so `../../MpiOkCancel/MpiOkCancel.js` lints clean today; wired as `warn` (`eslint.config.js:47`).
- The real rule is PARKED at `.agents/mpi-kanban/tasks/MPI-751/rule/no-same-tier-component-import.js`: Primitives may import no component (`:48-49`), Compounds only Primitives (`:50-51`), `LandingPages` is a grouping folder (`:15`, `:26-28`). Lands when hits are cleared (MPI-751 `checklist.md:8,12`).
- Parked rule in memory reported 22 hits, incl. `MpiFlowLibrary.js:12` and `MpiModelManager.js:3` (MpiOkCancel), `MpiRemote.js:2-3`, `MpiMaskedImagePreview.js:24` (only Primitive->Primitive). Known hits owned by MPI-751, not exemptions (`eslint-tier-rule.test.cjs:34`).
- Primitives render their own controls: MpiRadioGroup `<button>` (`MpiRadioGroup.js:75`), MpiTreePicker search `<input>` (`MpiTreePicker.js:129`); `no-bare-form-control` exempts Primitives (`.eslint-rules/no-bare-form-control.js:44`).
- Legal home: `js/components/Primitives/MpiFilterBar/`. A Compound under `Compounds/LandingPages/` is a hit; an Organism cannot be imported by a Compound.

## 2. Presentational vs consumer split (Model Library today)
- Moves: markup `MpiModelManager.js:64-79`; `_mkTag` toggle (`:203-218`); search input + trim/lowercase (`:235-237`); CSS `MpiModelManager.css:91-174`. `:115-129` and `:161-172` restate MpiButton/MpiInput chrome (forbidden by `components.md:25`) — owning the controls removes that.
- Stays in consumer: Sets `_mediaActive` `:139`, `_filterActive` `:159`, `_searchQuery` `:142`; option lists (`:157-158`, `:221`); list signature `:1120`; media-block gating `:1220-1221`; predicates `:1379-1385`; plugin search `:1356`; force rebuild.
- Trailing slot: only Refresh sits in the row (`:78`); `__disk` is above it (`:63`). Bar renders an empty `__trail`, exposes `el.appendTrailing(node)` (precedent `MpiOverlay.js:219` `appendToContainer`, used `MpiModelManager.js:133`). Append, never mount — mount wipes the container (`components.md:116`).

## 3. Recommended API
- Props `{ groups: [{ key, label, options: [{ value, label }] }], searchPlaceholder }`; separator drawn between groups.
- Emits `change { key, active: { [key]: Set }, query }` (copies). Name follows `MpiDropdown.js:221`; Set payload follows `MpiAutoMaskThumbs.js:78`; not `select` (single-choice meaning, `component-contracts.md:76`).
- `el.setActive(key, values)`, `el.setQuery(q)`, `el.appendTrailing(node)`, `el.destroy()` — setters required for an externally driven Primitive (`component-contracts.md:121`). Factory: `instance.on` subscribes, destroy chains `el.destroy` (`factory.js:111-123`).
- Take option VALUES, never a property name: a generic `'type'` key would read models' family `'sdxl'` (`models.js:7`).

## 4. Registration checklist
1. `js/shell/preloadStyles.js` Primitives block (format `:20`).
2. `js/components/types.js` typedef w/ Emits + instance methods (model `:543-561`).
3. Gallery (`js/pages/components.js`) — Fabio said NO (2026-09-14).
4. `docs/component-contracts.md` optional entry (precedent MpiTileSheet `:89-95`).
5. Rule-map drift, edit only with permission: `component-events-primitives.md` (format `:95`), `component-mounts.md` `:180`, `:181`, `:246-253`.

## 5. Overlap
None in `js/components`. MPI-749 plans a Compound `MpiGalleryToolbar` with a FILTER button + popup panel (`plan.md:54-58`) — different pattern; only the heat-dot tag look (`DESIGN.md:170-176`) should match.

## 6. Risks
- Tag letter-spacing 0.14em (`MpiModelManager.css:118`) vs `DESIGN.md:172` ≥0.16em.
- List signature (`:1120`) must keep filter state or filter changes stop rebuilding.
- Bar adds listeners → `el.destroy` required; both consumers must call it.
- No test references today's filter classes.
