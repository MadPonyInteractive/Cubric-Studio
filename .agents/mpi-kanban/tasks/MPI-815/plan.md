# Elements library — reusable multi-file elements outside any project

> **Scheduling (Fabio, 2026-09-19): this starts AFTER the 2.0 release. It is never a 2.0 blocker.**
> Project mode: `scalable-foundation` — no prototype shortcuts, full guardrails.

## Current State

### Where this came from

Brainstormed with Fabio on 2026-09-19 (triggered by the MiniMax H3 **RefMod** video —
`ComfyUI-MiniMaxH3Mod`, a no-training reference adapter — but the design is deliberately
model-agnostic). **The design below exists nowhere else**: it was settled in that conversation
and this file is its only record.

### The design, as approved

1. **An element is a folder**: an id, a name, text fields, and user-named **groups**. A group's
   items are **files** (image/video/audio/anything) or **links** to other elements.
   **One ★ active item per group**, or none ("no hat").
2. **Ids are identity; names are labels.** A shipped "Hats" and a user's "Hats" coexist. A fork
   of a shipped element gets a **new id**, never the same one, so a listing is never ambiguous.
3. **A pick belongs to whoever USES the group**, never to the linked element — otherwise one
   character's hat choice would change every other character's. A link may target a whole
   element (the user then picks inside it) or one exact file.
4. **Two roots, both always walked, in a fixed order** (the MPI-791 lesson — a reader that walks
   one root silently under-reports):
   - shipped, read-only: `elements/` at the repo root (the packaged build copies the app tree
     verbatim, so `path.join(__dirname, '..', 'elements')` resolves identically in dev and in a
     portable build — **no build-script change**). An app update overwrites this root, which is
     why it is read-only: **editing a shipped element forks a copy into the user's library**
     (new id, a one-line note saying so), and that fork receives no later updates from us. A
     merge layer over ours is deliberately not built unless the forks turn out to hurt;
   - the user's: `<userData>/elements/` — `process.env.APP_USER_DATA`, the same store
     `services/userFlows.js:46` uses, chosen because `scripts/build-portable.mjs:103-111`
     **preserves `user-data/` across a portable update**. NOT the engine folder: `engine/` is
     disposable and excluded from the app copy.
   - A user-selectable root (Documents or elsewhere) is deliberately **later** — see § Later.
5. **Projects do not own elements**, and there are **no element cards in the project gallery**.
6. **Nothing is derived or auto-built.** No `cache/`. Mods (`.safetensors`) are ordinary files a
   user adds, and are **out of v1 entirely** (Fabio: mods still need their own creation path).
7. **Loading is contextual.** Each consumer declares which file kinds it takes; the resolver
   returns the active items of matching groups, recursively through links with a cycle guard,
   and **reports** parts over the model's slot limit rather than silently dropping any.
8. **Fields are a knowledge record** — a character/prop/location "bible" for the user and the
   in-app agent, **not prompt injection**. Read like an object: a consumer asks for the keys it
   needs (`name`, a representative image, `description`), and a missing key is simply absent,
   never an error. Character template keys: `name`, `age`, `appearance`, `personality`,
   `prompt_base`. Users may add their own fields freely. `prompt_base` MAY later become an
   optional tick in the drop dialog; not in v1.
9. **Templates only pre-fill** fields/groups and set the icon. First and only v1 template:
   Character.
10. **The three surfaces, and how the drop dialog behaves.**
    - The **Elements overlay** — create from a template or blank, edit fields, groups, links and ★.
    - The **PromptBox "+" popup** — an Elements filter row, and the **first tile is a big "+"**
      that creates a new element (the prompt-box history precedent).
    - The **drop dialog — on EVERY drop and every library pick**, never an immediate insert
      (Fabio's call: predictable beats fast, and Reuse Prompt already works this way). It opens
      **pre-ticked from that element's last use**, each row showing its ★ item with a way to swap
      it, **Enter accepts**. Groups the current model cannot use are **greyed out**, the way Reuse
      greys out media the source does not have. If the ticked items exceed what the op accepts,
      the dialog makes the user choose — nothing is dropped silently.
11. **Naming.** Product term "Elements". In code **never a bare `element` identifier** (it means
    a DOM node everywhere in this repo) — `elementLibrary`, `ELEMENT_TEMPLATES`, `elementService`.

### Two decisions taken after investigation (2026-09-19)

- **It is an OVERLAY, not a fourth workspace** (Fabio approved). The app has exactly three router
  pages (`js/router.js:11-13`); the "Image/Video/GIF workspaces" are branches inside
  `MpiGroupHistoryBlock`, not pages. The precedent for a new full-screen surface is the **Model
  Library / Flow Library**: a lazy-singleton Organism self-hosting `MpiOverlay(mountTarget:'body')`,
  opened by an event (`js/shell.js:481-489`, `:497-504`). A real page would inherit the project
  bar, and **13 sites assume a page shows the current project's media** — `_updateBreadcrumb`
  (`js/shell/navigation.js:261-291`), `updateTitlebarProject` (`:197-200`), `_syncGalleryToolbar`
  (`:300-311`), the up-arrow (`:67-73`), Record → `mediaImportService.js:92`, the Tab radial gates
  (`js/managers/hotkeyRegistry.js:379,398`), `focusModeService.js:34-38`, `MpiFlowLibrary.js:592`
  (`canOpen = currentPage === PAGE_GALLERY`), `MpiPromptBox.js:121` + `state.promptDraft` /
  `state.promptMedia` (which have exactly two workspace slots, and silently coerce anything else
  to `'gallery'`), and `generationService.js` (every dispatch resolves paths from
  `state.currentProject`). The overlay touches none of them.
- **Nothing is copied into the project** (Fabio, 2026-09-19: *"If the user deletes elements, it's
  his problem… this is the default in most apps"*). The sidecar records which element, which
  version and which items; deleting or moving an element breaks a later reuse, and that is
  accepted. This lines up with **MPI-821**, which retires the `.preview-assets` copy store in
  favour of Archive. Today images used as references self-heal into
  `Media/.preview-assets/<sha256>` via `materializeGenerationFrameSnapshots`
  (`routes/projects.js:702`) while video and audio never do — **do not** extend that path for
  elements; MPI-821 is removing it.

### What already exists and must be reused, not reinvented

| Need | Existing thing | Where |
|---|---|---|
| "Which file kinds does this consumer accept?" | `getCommandMediaInputs(opKey)` + `filterMediaInputsForModel(slots, model)` — per-op `mediaInputs` with `key/mediaType/title/required/ordinal/tag`; `ref2v_ms` declares 15 slots tagged `Picture 1…Audio 3`, `kleinEdit` 3 | `js/data/commandRegistry.js:108-126, 360, 775, 1725, 1788` |
| Library overlay skeleton | `MpiFlowLibrary` (itself "a clone of the Model Library skeleton") — filter state + `_matchesFilters` `:157-205`, sheet mount + select `:723-727`, `:766` | `js/components/Organisms/MpiFlowLibrary/` |
| Grid + filter primitives | `MpiTileSheet` (consumer-owned `previewCache` Map is mandatory — without it the grid blanks on every keystroke, MPI-394) and `MpiFilterBar` | `js/components/Primitives/` |
| A user-level file store with a server triple | `services/userFlows.js` + `routes/userFlows.js` + `js/services/userFlowService.js`; folder name IS the id; scan-on-demand, no registry file; **invalid entries are listed with their error, never hidden** | `services/userFlows.js:31-33, 46, 256, 263`, `routes/userFlows.js` |
| Path safety for a library root | `packageFilePath()` — whitelist by shape (`ID_RE`, `FILE_RE`, flat names only, `null` → bare 404). **`GET /project-file` validates NOTHING** (`routes/projects.js:1861-1870`) and is not a precedent | `services/userFlows.js:288` |
| Chip URL for an out-of-project path | `resolveMediaUrl()` → `/project-file?path=<encoded abs>`; a bare `C:\…` path renders no thumbnail (`MpiPromptBox.js:970-981`) | `js/utils/mediaActions.js:39` |
| Agent-facing list+read pair | `GET /connector/knowledge` / `/connector/knowledge/:id`, `{ok:true,…}` / `{ok:false,error:{code,message}}` at HTTP 200 | `routes/connector.js:715, 733` |
| Additive sidecar key, no migration | `flowId`/`flowInputs`, `gif`, `splatPath` all did exactly this; readers spread unknown keys | `routes/projects.js:2182-2212`, `js/managers/projectReconciler.js:76` |

### Constraints and open risks

- **`persistGroups()` is a whitelist** — an unlisted key on an itemGroup is silently dropped on
  every save (`docs/data.md:75`). Element provenance goes on the **sidecar**, never the group.
- **Never write `project.json` from outside while a project is open** — the renderer owns
  `itemGroups` and overwrites. (`docs/generation-lifecycle.md:134-138`.)
- **A new drag MIME is required.** `application/mpi-media` is JSON-parsed by
  `_handleMediaDrop` (`MpiPromptBox.js:612`) and immediately staged as one file. Elements need
  `application/mpi-element` — **and** the two inverted guards that treat an unknown type as an OS
  file drag must learn it, or dropping an element opens the import overlay
  (`MpiGalleryBlock.js:242`, `MpiGroupHistoryBlock.js:1512`).
- **Never `preventDefault()` in a gallery `dragstart`** (`docs/gallery.md`, MPI-318 — a card was
  reverted once for it), and any new drop target must `preventDefault()` but never
  `stopPropagation()`, or `MpiMediaDropOverlay` sticks open (MPI-82).
- **`MpiReusePromptDialog` cannot be reused**: its `PARTS` are a module constant, its title is
  baked in, and it reads/writes `state.promptReuseOptions` / `state.promptReuseSource` — an
  element dialog would corrupt the user's Reuse defaults. Copy the pattern into a sibling.
- **`MpiMediaPicker` hard-assumes project media**: `_entries()` reads
  `state.currentProject.itemGroups`, `matchesGallerySort` needs `group.archived/favourite`,
  `byGalleryOrder` needs `group.createdAt`, and `props.mediaType` is **single-valued** so a mixed
  element does not fit it. The in-flow source swap already exists as a precedent:
  `_buildVoiceCard` + `_openVoiceLibrary` hide the grid and the filter row and swap a second
  source in (`:346, 396`).
- **`.mpi-detail*` is a global selector owned by `MpiModelManager.css` and already borrowed
  across a component boundary by the Flow Library** (`.claude/rules/component-mounts.md:185`).
  Known debt — **do not extend it a third time**; the element editor styles its own drawer.
- **The in-app agent never deletes**: `tests/agent-no-delete.test.cjs` bites on any new tool or
  route reachable from `services/agentTools.mjs`. Touch it deliberately, with the reason.
- Every new component costs: folder + `.css` + a `js/shell/preloadStyles.js` entry + a
  `js/components/types.js` typedef + **asking Fabio** before adding it to the dev gallery
  (`.claude/rules/components.md:63`).

## Completed

- [ ] Nothing yet.

## Remaining Work

### Phase 1: the data layer (no UI) — `auto`

Sequential and first: everything else consumes it.

- [ ] `services/elements.js` — scan BOTH roots in fixed order, parse `element.json`, validate, and
      return invalid entries **with their errors** rather than hiding them. Folder name is the id.
      Scan on demand, no registry file, no cache (userFlows pattern). Resolve a file with a
      `packageFilePath`-shaped whitelist; a shipped element is read-only and a write to one is
      refused with a distinct code. **Verify:** `node --test tests/elements.test.cjs` covers a
      two-root scan with an id in each, an invalid `element.json` surfacing as a listed error, a
      `../` and an absolute path both refused, and a write to a shipped element refused.
- [ ] `routes/elements.js` + its three lines in `server.js` (require beside `routes/userFlows`,
      one `app.use`) — list, read, create, update, delete (user root only), and one guarded file
      route. House style: guard params first, `{ success:false, error }` on 4xx/5xx,
      `logger.error('elements', …)`, **never** `console.log`, and `logger.warn/info` take exactly
      two arguments. **Verify:** each route exercised in `tests/elements.test.cjs` against a temp
      root; a traversal attempt returns a bare 404; the delete of a shipped id returns a refusal.
- [ ] `GET /connector/elements` + `/connector/elements/:id` in the connector envelope
      (`{ok:true,…}` / `{ok:false,error:{code:'UNKNOWN_ELEMENT',…}}` at HTTP 200), so the in-app
      agent and a CLI agent get one surface. Element media bytes go through the guarded element
      file route, never `/project-file`. **Verify:** both routes return the envelope for a hit and
      a miss; `node --test tests/agent-no-delete.test.cjs` still passes with the new routes
      present (no delete tool added).
- [ ] `js/services/elementService.js` — the renderer's read/write wrapper, modelled on
      `js/services/userFlowService.js`. **Verify:** called from a scratch page against a live
      isolated app, it lists the seeded elements; no `console.log` survives `npm run lint`.
- [ ] Seed **one** real Character element under the shipped root for testing (name, description,
      a sheet image, a voice clip). **Verify:** it appears in the list route with its groups and
      its ★ items, from both a dev run and `npm run build:portable:dry-run`'s staged tree.
- [ ] `docs/elements.md` (≤200 lines) + a row in `docs/README.md`. **Verify:** the doc names the
      two roots, the id rule, the link rule, and the "nothing is copied into the project"
      decision with its date.

### Parallel Batch: the two surfaces — `user-ux`

Runnable by `mpi-execute-parallel` **only after Phase 1 is green**. The two tasks own disjoint
files except for the two shared registration files called out below.

- [ ] **The Elements overlay.** `MpiElementLibrary` Organism: `MpiOverlay(mountTarget:'body')` +
      `MpiFilterBar` + `MpiTileSheet` (with its own `previewCache` Map), a lazy singleton in
      `js/shell.js` beside `_modelLibrary`/`_flowLibrary`, opened by an `elements:open` event with
      an entry point in the Landing nav (`js/shell/projectUI.js:81-91`). The editor is this
      overlay's own drawer: create from the Character template or blank, edit fields, add/remove
      groups, files and links, set ★. Every control is a `ComponentFactory` component; BEM
      throughout; `el.destroy()` releases every `Events.on` unsubscribe.
      **Ownership:** `js/components/Organisms/MpiElementLibrary/**`, `js/shell.js`,
      `js/shell/projectUI.js`, `js/utils/icons.js`.
      **Briefings:** `components`, `dos_and_donts`, `component-mounts`, the Critical Rules Snapshot.
      **Verify:** a desktop spec (`--output=<scratchpad>`) opens the overlay from Landing, creates
      a Character element, adds a field and a file, sets ★, reopens it and reads both back from
      disk; `npm run lint:components` clean; no bare `element` identifier
      (`grep -n "\belement\b *=" ` in the new files returns only DOM nodes).
- [ ] **The drop path.** `js/utils/elementResolve.js` — a pure resolver taking
      `(element, opKey, model)`, reading `getCommandMediaInputs` + `filterMediaInputsForModel`,
      returning the active items of matching groups, recursing through links with a **cycle
      guard**, and reporting an over-limit set instead of truncating it. Plus
      `MpiElementDropDialog` (a sibling of the Reuse dialog, copying its row/availability pattern
      and **not** its global state), a new `application/mpi-element` drag type taught to the two
      inverted guards, and chips inserted through `injectMedia` with `resolveMediaUrl` URLs. The
      picker gains an Elements source and a create tile via the `_openVoiceLibrary` swap pattern.
      **Ownership:** `js/utils/elementResolve.js`,
      `js/components/Compounds/MpiElementDropDialog/**`,
      `js/components/Organisms/MpiPromptBox/MpiPromptBox.js`,
      `js/components/Compounds/MpiMediaPicker/MpiMediaPicker.js`, and the two guard lines in
      `js/components/Blocks/MpiGalleryBlock/MpiGalleryBlock.js` +
      `js/components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js`.
      **Briefings:** `components`, `dos_and_donts`, `component-events`, the Critical Rules Snapshot.
      **Verify:** `node --test` unit tests for the resolver (kind matching against a real `ref2v_ms`
      slot list, a link cycle terminating, an over-limit set reported not truncated); a desktop
      spec drops a seeded element on the PromptBox, accepts the dialog with Enter, and asserts the
      expected chips exist with `/project-file?path=` URLs and a visible thumbnail.

**Shared-file tail (both tasks, serialized).** `js/components/types.js` and
`js/shell/preloadStyles.js` take one append each. These were the claim-contention point on
MPI-757. Each worker claims the file, appends only its own block, releases, and does this **last**;
whoever is second rebases their append. Do not batch these two files.

### Phase 3: wiring the record — `auto`

- [ ] Add an additive `elements: [{ id, version, items: [itemId] }] | null` key to the sidecar in
      `POST /project/save-generation` (`routes/projects.js:2182-2212`), populated from the chips'
      provenance. **Not** on the itemGroup — `persistGroups()` would drop it.
      **Verify:** a real generation with an element chip lands a sidecar carrying the key; a
      generation without one carries `null`; `POST /load-meta-batch` returns it unchanged; an
      existing project opens with no migration and no console error.
- [ ] Regenerate the four component maps with `mpic-update-component-map`, and update
      `docs/workspaces.md` + `.claude/rules/workspaces.md` to record that Elements is an **overlay
      surface, not a fourth page** (both currently say "three workspaces" and list only pages).
      **Verify:** the maps name `MpiElementLibrary` and `MpiElementDropDialog`; a `git diff` of the
      rule files is reviewed by Fabio before it is committed (rules are never edited without
      explicit permission).

### Later — separate cards, not this one

Mods as element files (a `.safetensors` a user adds), and everything they need: reaching the
engine's RefMod folder locally **and** on a Pod, which nothing does today. Flow slots consuming
elements. Starter elements we ship (Hats, locations). The sheet-builder Flow (character + clothes
+ weapon → a character sheet). A user-selectable library root (the honest precedent is
`extra_model_folders.json` + `setExtraModelFolders()` with `fs.realpath.native`, **not** the
primary models root). `prompt_base` as an optional tick in the drop dialog. Telling a model WHICH
reference is which subject in a multi-subject shot — a prompt-level problem, tags already exist in
`mediaInputs` (`Picture 1…Audio 3`).

## Plan Drift

- None yet.

## Verification

**Verify mode:** user-ux

Phase 1 and Phase 3 are `auto`. The Parallel Batch is `user-ux` — Fabio must open the overlay,
build a character, drop it on the PromptBox and judge that the dialog and the chips feel right in
the running app before this closes.

End to end: with the app running, create a Character element with a sheet image and a voice clip,
drop it on the PromptBox with MiniMax H3 selected, accept the dialog with Enter, generate, and
confirm the sidecar records the element id, version and items. Restart the app and confirm the
element survives; run `npm run build:portable:dry-run` and confirm the shipped root is staged and
`<userData>/elements/` is untouched by the update path.

## Preservation Notes

- **`docs/elements.md`** is the durable home for this subsystem. This plan is not.
- **Memory:** the RefMod/mods facts belong in memory or `docs/`, not here — an element's `cache/`
  was dropped deliberately, and a future session should not re-derive it.
- **Doc drift found during investigation** (report, do not silently fix — and none of it is this
  card's job): `docs/workspaces.md:108` claims the Gallery auto-emits `models:open` at zero models,
  which `MpiGalleryBlock.js:1880-1903` no longer does; `docs/workspaces.md:3,5-9,112-117` predates
  the Tab radial and the project-bar toolbar mount; `docs/models-path.md` contradicts itself on
  deleting `extra_model_paths.yaml` (the Gotchas section is the correct half);
  `docs/plugins.md:10` cites a dead `js/data/models.js` path (it is
  `js/data/modelConstants/models.js`); `js/state.js:10` says `'groupHistory'` where the value is
  `'group-history'`; `js/shell/navigation.js:515` uses a raw `console.warn` against
  `mpi/no-raw-console`; `MpiFilterBar.js:15-17` and `MpiTileSheet.js:22-29` call the Model and Flow
  libraries "Compounds" when they are Organisms.
- **Related cards:** MPI-821 (Archive replaces the `.preview-assets` store — the reason this card
  copies nothing into a project). Product context: `project_lora_free_character_system` in memory.
