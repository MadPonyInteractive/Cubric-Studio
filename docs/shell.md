# Shell

The shell wires the application together — global dialogs, window controls, project UI, memory ops, StatusBar, and navigation.

## shell.js (`js/shell.js`)

Entry point that runs after the HTML shell loads. Calls `initShell()` which:
- Wires global error dialog (`ui:error` → show error dialog)
- Binds window controls (minimize, maximize, close)
- Sets up project UI (model badge, gallery title)
- Initializes memory ops
- Wires StatusBar
- Calls `initNavigation()`

## navigation.js (`js/shell/navigation.js`)

History-stack router. Key functions:
- `handleNavigation()`: Dispatches to `_showLanding` or `_loadView` (lazy-imports workspace).
- `navigate(route, params?)`: Pushes to history stack.
- `back()`: Pops history.
- **Tab = workspace flipper (MPI-378).** `workspace.flip` is bound in `_showShell()` and unbound in `_showLanding()` — NOT app-lifetime, because `hotkeyManager` suppresses native Tab traversal the moment any `down:tab` handler exists, which would kill tabbing through the landing page's project form. **Phase 2 landed in MPI-589 and was re-ordered by MPI-611: it is a THREE-state ring** — gallery → last card → **the flow you have open** → gallery. `_flipWorkspace()` sends gallery → `resolveFlipTarget(state.currentProject)` (`js/data/projectModel.js`), group-history → `flow:restore`, and an open flow → `flow:suspend` plus the gallery. **The third stop is the flow itself, not the library that lists them**: `flow:suspend` hides `MpiBaseFlow` WITHOUT its outward `close`, so the shell's MPI-345 destroy never fires and `flow:restore` shows the same instance — same step, same inputs, same running job (`el.suspend()`, and the per-show `_bindKeys`/`_unbindKeys` that keep a parked flow's ArrowLeft/Right + Ctrl+Enter from firing off screen). `flows:open` survives as the FALLBACK third stop when no flow is parked, which is what the Library leg is now: Tab leaves it back to the gallery, it is not a stop on the way round. That resolver returns `null` for a project with no cards, an audio-only card (the gallery won't open those either), or a remembered card that was deleted; the ring then degrades to gallery ↔ Flows rather than dead-ending, which is the change from MPI-378, where Tab did **nothing at all** in that case. A project with exactly ONE card always flips to it. The remembered card is `project.lastGroupId`, written by `_rememberGroup()` from the single choke point in `_loadView` (after the Block mounts, so restore-on-boot and any future entry path are covered) and cleared inside `projectService.removeGroup` — never at the four call sites. No `SCHEMA_VERSION` bump: the field is optional and absent means nothing to flip to.
  **Flows is an OVERLAY, not a page**, and that is the whole trap in this ring: `workspace.flip`'s when-gate blocks on `.mpi-overlay--body`, so before MPI-589 Tab died the instant the Flow Library opened — the ring could get in and never out, silently. The gate now excepts `.mpi-overlay--body .mpi-flow-library` **specifically**, so the Model Library and every other body overlay still block. `tests/desktop/flows-tab-ring.spec.js` covers all three legs, the parked-flow round trip (it stamps the live node and asserts the SAME one comes back, so a re-mount cannot pass as a restore) and that exclusion, and the exclusion is mutation-tested: restore the blanket gate and the ring spec goes red. An open flow needs no exception of its own — it mounts `main-area`, not `body`.
- **The workspace radial is GONE (MPI-378).** No `RADIAL_ITEMS`, no page contexts, and `MpiRadialMenu` no longer binds bare Tab. In production nothing mounts at all — `_syncRadial()` early-returns unless `APP_CONFIG.dev_mode`, where it mounts the Ctrl+Tab `dev` ring (Components / Apps / Restart Engine, MPI-338). Models is reached from the prompt box's model button, which still emits `ui:open-model-picker`.

## overlayManager.js (`js/managers/overlayManager.js`)

Stack-based overlay controller. Multiple overlays can be visible simultaneously, each at its own z-index.
- `Overlays.request({ show, hide, id })`: Pushes onto stack, calls `show()` immediately, returns `{ depth, zIndex }` — caller applies z-index to DOM nodes. **Emits `ui:close-all-popups` `{ reason: 'overlay-open' }` BEFORE showing** — so a popup that opens an overlay from inside itself dismisses itself unless its own handler exempts that reason (MpiSlideOver and the PromptBox parameters popup both do; MPI-360).
- `Overlays.release(instance)`: Splices instance out of stack (any position).
- `Overlays.closeTopOverlay()`: Calls `hide()` on top of stack only (Escape key).
- `Overlays.isTop(instance)`: Returns true if instance is current top — use to gate Enter hotkeys.
- `Overlays.onDepthChange(cb)`: Subscribe to stack depth changes; returns unsubscribe fn.
- `Overlays.reset()`: Clears all overlays (used after navigation to fix stale state).

## hotkeyManager.js (`js/managers/hotkeyManager.js`)

- `Hotkeys.init()`: Call once at shell startup — attaches window listeners and registers builtins.
- `Hotkeys.bind(id, fn) → unbindFn`: Bind a handler to a registry entry by stable id (e.g. `'mask.brush.toolbar'`). Returns an unbind function — store and call in `destroy()`.
- `Hotkeys.unbind(id, fn)`: Remove a specific handler.
- `Hotkeys.getRegistry()`: Returns the full `HOTKEY_REGISTRY` array.
- F11 toggles native Electron fullscreen. On `enter-full-screen` / `leave-full-screen`, `windowControls.js` syncs `body.window-fullscreen`; CSS hides the custom titlebar and collapses `--titlebar-h` so the app fills the viewport.
- Ctrl+Shift+I opens devtools (dev mode only, gated by `APP_CONFIG.dev_mode`).
- Context Menu / Shift+F10 opens the app context menu at the last hovered point when dev mode is off. In dev mode, the key is left to Electron so the native Inspect Element menu can open.
- Focus gating treats only text-entry controls as typing (`TEXTAREA`, contenteditable, and text-like `INPUT` types such as `text`, `number`, `search`, `email`, `password`, date/time types). Non-text controls such as `input[type="range"]`, checkboxes, radios, and buttons may keep focus without blocking global hotkeys.
- **`modal.confirm` is bound by `MpiModal` for EVERY modal**, whether or not the dialog subscribes to `'confirm'` — `show()` binds it unconditionally — and `_dispatch` calls `preventDefault()`/`stopPropagation()` on any bound+eligible key BEFORE it reaches the handlers (`hotkeyManager.js:210`). So a key swallowed inside a modal has no listener to blame, and the search starts in the wrong file. That ate Enter in every modal textarea until MPI-738 gave the entry a `when` gate skipping `TEXTAREA`/contenteditable — the notes editor (project notes and card notes) could not start a new line. `MpiNotesEditor` and `MpiEnhanceDialog` both carry comments claiming they dodge the clash by not listening for `confirm`; that was never sufficient. A field inside a modal that needs a key the registry binds gets a registry gate, not a local listener.

### Adding a hotkey

1. Declare an entry in `js/managers/hotkeyRegistry.js` — set `id`, `key`, `type`, `category`, `scopeLabel`, `description`, `allowWhileTyping`, and optionally `when(ctx)`.
2. In the component `setup()`, call `Hotkeys.bind(id, fn)` and push the returned unbind fn into `_unsubs`.
3. `_unsubs` is called in `el.destroy()` — no manual `unbind` needed.

### Hotkeys page — hand-authored HTML

The Hotkeys slide-over (`MpiHotkeys`) is **not** generated from `hotkeyRegistry.js`. Its layout is hand-authored static HTML inside `js/components/Compounds/LandingPages/mpi-hotkeys/mpi-hotkeys.js` (the component's `template`). This is intentional: the user curates wording, grouping, ordering, and which entries appear, without writing custom display fields on every registry entry.

**Authoring rule (mandatory):** Whenever you add, rename, or remove a hotkey in `hotkeyRegistry.js`, you MUST also add/rename/remove the matching `<li><span>KEY</span><span>Description</span></li>` row in `mpi-hotkeys.js`. Treat the two files as paired: a registry change without a hotkeys-page change is incomplete work.

**Row format:**
```html
<li><span>KEY</span><span>Verb-first description</span></li>
```
- Key text uppercase (`F5`, `CTRL+F5`, `SHIFT`, `ESCAPE`).
- Description in concise imperative phrasing ("Release Memory", "Pan canvas (hold)").
- Group rows under an existing `<div class="mpi-hotkeys__shortcut-group"><h4>Group Name</h4><ul>…</ul></div>`, or add a new group following the same pattern.
- Modifier variants of one concept become sibling rows (e.g. `F5` "Release Memory" + `CTRL+F5` "Release Memory + Cache").
- Hold/release pairs collapse into a single "(hold)" row — do not list keyup mirrors separately.

### Gating model

`isTyping` means a real text-entry context: `TEXTAREA`, `[contenteditable]`, or text-like `INPUT` types. Non-text controls such as `input[type="range"]`, checkboxes, radios, and buttons are not typing contexts, so global hotkeys continue to work after those controls receive focus.

Keydown fires handlers only if all guards pass (in order):
1. Entry found in registry for normalized key + type.
2. `isTyping` check — single-letter and bare-modifier keys blocked while a text-entry control is focused, unless `allowWhileTyping: true`. F-keys and `Ctrl+`-chords always pass.
3. `when(ctx)` optional gate — receives `{ state, event, activeElement, isTyping }`.
4. `preventDefault`/`stopPropagation` called only after all guards pass.

## statusBar.js (`js/shell/statusBar.js`)

Bottom status bar. Shows ComfyUI engine status, active model, generation progress.

> **Before touching progress display, Stop handling, or lane/queue interplay, read
> [generation-lifecycle.md](generation-lifecycle.md)** — the stdout-driven progress pipeline
> (MPI-147) and the per-gen identity doctrine (MPI-195/203/208/245) live there. The bar derives
> ownership + idleness from `generationStore`, and every driving `tool:*` event carries a gen id.
- Listens to `comfy:starting`, `comfy:ready`, `comfy:error`, `tool:running`, `tool:loading-model`, `tool:sampling-start`, `tool:cancelled`, `tool:idle`, and `state.generationQueueCount`.
- On `tool:running`: prepares the progress bar without starting elapsed timing
- On `tool:loading-model`: updates label to "Loading model..." (model VRAM load phase)
- On `tool:sampling-start`: updates label back to "Generating..." and starts elapsed timing
- On `tool:cancelled`: cancels progress bar instantly
- On `tool:idle`: completes progress bar, fires success toast with "Generation finished"
- On `state.generationQueueCount`: appends pending Cue depth to the active label, e.g. `GENERATING (2 queued)`. The progress bar remains per active job; it does not aggregate across the full queue.
- On `ui:success` / `ui:warning` / `ui:info`: fires a standalone toast via `StatusBar.notify(message, variant)` — **this is the correct way to show toasts from anywhere in the app**
- `progress.update(value)`: driven by KSampler step progress (called directly from blocks, not via events)
- New active runs invalidate pending completion animation from the previous run, so a queued item cannot have its progress bar cleared by the prior item's delayed `complete()` timers.

**Showing a toast (non-progress):**
```js
Events.emit('ui:success', { message: 'Model removed.' });
Events.emit('ui:warning', { message: 'Some files were kept.' });
Events.emit('ui:info',    { message: 'No changes made.' });
```
Never call `MpiToast.mount()` directly from components — emit the event instead.

## windowControls.js (`js/shell/windowControls.js`)

Electron window controls — minimize, maximize, close, fullscreen. Fullscreen can be triggered by the custom titlebar button or by F11 through `Hotkeys`; both route to the `window-fullscreen` IPC channel. The renderer listens for `window-fullscreen-change` and asks `window-state` on startup so restored fullscreen windows also hide the custom titlebar immediately.

## heroStats.js (`js/shell/heroStats.js`)

The three landing-hero footer slots: GPU/engine (`/system/gpu-info` + `remote:connection`), models (`models:checked`), session (`projects:listed`, or live Pod cost while remote-connected).

**The models slot never asserts a count it cannot have (MPI-404).** The models root is engine-owned — it lives in the engine's `extra_model_paths.yaml`, written when a local engine is provisioned (`routes/engine.js` step 6). With the MPI-390 escape hatch taken and no Pod connected there is no engine, so `/comfy/models/check` stats a root that was never created and answers "not installed" for every model — a real HTTP 200 that looks exactly like a measurement. Rendering it read `MODELS 0 / 18` on a disk full of weights, which was a cloud-only user's first impression of the app.

So the slot renders `—` whenever `hasNoEngine()` (`js/services/engineGate.js`, the same predicate behind the three no-engine door guards) is true, and the real count otherwise. Zero is only shown when an engine actually answered. `engine:ready` and the remote connect/disconnect **edge** repaint it, because an engine arriving can make the count knowable without the installed SET changing, and the `models:checked` emit is diff-gated in `modelRegistry.js`. The connection repaint is edge-gated on purpose: the status heartbeat re-emits `{connected:true}` every ~5s and `hasNoEngine()` refreshes the Pod each call.

## heroCrew.js (`js/shell/heroCrew.js`)

The landing hero's mascot crew (MPI-766): Prompt, Vision, Studio, Video and Audio on a lit stage, Studio centre. Layout, entrance and the 3px float are CSS (`styles/shell/landing.css`, `.mpi-landing__crew*`); the module builds the members and swaps poses — hover = greet, click = happy for 1.4s, one ambient greet every 3.2s (none under reduced motion).

- **It follows the PAGE, not a mount.** The landing is never unmounted (`_showLanding` / `_showShell` only toggle `.hide`), so `initHeroCrew()` subscribes to `currentPage`: the crew mounts on landing and is destroyed anywhere else. Destroy clears every timer, removes every listener and empties `#heroCrew`; the entrance replays on each return because the members are new.
- **The entrance waits until the screen is clear.** The crew mounts paused (`--held`) and plays once `state.screenClear` is true (screenClearService.js, below). A cover arriving mid-entrance pauses it where it is, and the first release also starts the ambient greeting.
- **`_poseSrc(key, pose)` is the only code that knows a mascot file** — `assets/mascot/<key>/<pose>.webp`, 620px tall, each character's poses sharing one registration box so a swap never shifts the body. The stills are placeholders for animated alpha WebM loops (VP9; not GIF, whose 1-bit transparency fringes the dark outline), which replace that function, not the layout.
- **A loop must be released, not hidden.** Destroy pauses every `video` in the layer, removes its `src` and calls `load()`. A hidden playing video keeps its decoder.
- **The stage is one 1120×1000 unit** (the hero at the 1920×1032 reference window), scaled as a whole so the row never reflows. Two scales: the headline reads `--hero-k` = `min(100vw / 1920px, (100vh - --titlebar-h) / 1000px)` in CSS, and the crew reads `--crew-k`, which `_fit()` sets from a `ResizeObserver` on the hero and the quote: never past 1, never wider than the hero, and small enough that Vision's head clears the quote and Studio's clears the headline. The floor stays 160px above the hero's bottom at every scale (the labels and stats foot do not shrink). Below 0.66 the role lines drop out, below 0.41 the names, below 0.25 the crew (label widths measured against the closest pair of characters). **Never make the hero a size container to get a scale:** under `container-type: size`, every text change inside the hero (the quote, a heroStats repaint) restarts the crew's entrance animations. Measured with `getAnimations()`; a separate container frame around the crew restarted them too. `hero-inner` is `pointer-events: none` with the nav re-enabled: the headline paints over the crew and the crew still gets the pointer.
- Label dots and floor glows read the family identity tokens in `01_base.css` (`--hub-accent`, `--vision-accent`, `--prompt-accent`, `--video-accent`, `--accent-audio`). Identity only, never an action colour (MPI-736).

## screenClearService.js (`js/shell/screenClearService.js`)

One reusable signal for "the app has booted and nothing covers the screen" (MPI-766). `state.screenClear` is `false` until `_bootApp` emits `shell:booted` (past the engine gate, the 18+ notice and the changelog), then follows the screen: `false` while a blocking overlay is up, `true` when it is gone. Read it at mount and react with `Events.onState('screenClear', fn)`; a one-shot event would be missed by anything that mounts late.

- **Covered = either source.** The `Overlays` stack is not empty (every `MpiModal` and `MpiOverlay`, main-area ones included), or a backdrop sits directly on `<body>` (`.mpi-modal-backdrop`, `.mpi-overlay-backdrop`). The second is how `MpiStartingComfy` covers the screen: it portals its own backdrop and bypasses `Overlays` on purpose.
- **A close-then-open handoff never reads as clear.** The 18+ notice's Continue hides it and opens the changelog one animation frame later (MPI-333, so the backdrops never stack). A microtask recompute DID report `true` in that gap (measured); the service now recomputes on the next frame, after the changelog's own frame callback. A hidden window runs no frames, so the signal also waits until the app can be seen.
- First consumer: the landing crew's entrance (`heroCrew.js`).

## projectUI.js (`js/shell/projectUI.js`)

The landing page's project grid (rows built by `_buildProjectRow`, thumbnails drained newest-first, 3 at a time) and the New Project dialog.

- **The grid stops when the landing is left (MPI-786).** `_showShell()` calls `releaseProjectGrid()`: it aborts the batch `AbortController` (thumbnail queue + row stats) and empties the grid; the abort also drops every preview `<video>`'s `src` and calls `load()`, detached or not. Without it the queue kept loading clips behind the open project, and a hidden, paused `preload="auto"` clip holds its range request until Chromium idle-suspends it ~15s later. The app server is HTTP/1.1 on one host (six connections) and the renderer keeps three for its EventSource streams, so three such clips queued every fetch: a save waited 14.9s in 6 of 10 real-app runs. `loadProjectGrid()` rebuilds on the way back. Spec: `tests/desktop/landing-grid-release.spec.js`.

## memoryOps.js (`js/shell/memoryOps.js`)

Global VRAM and RAM release operations that communicate with ComfyUI. Exports `triggerMemoryRelease(isDeep, monitorEl)` (calls `/comfy/unload`) and `bindMemoryHotkeys(monitorEl)` (registers F5 / Ctrl+F5 via `Hotkeys`).

## projectService.js (`js/services/projectService.js`)

Centralized persistence layer for project mutations. Replaces the old `projectManager.js` pattern where blocks directly mutated `state.currentProject` and called ad-hoc save functions.

**Key pattern:** All group mutations (add, update, remove) go through ProjectService. The service handles in-memory state update, disk persistence (via `/update-project`), and event emission in a single atomic operation.

**API:**
- `addGroup(group)` — Add group, persist, emit `project:group-added`
- `updateGroup(group)` — Update group, persist, emit `project:group-updated`
- `removeGroup(groupId)` — Remove group, persist, emit `project:group-removed`
- `persistGroups()` — Low-level: serialize and write all groups to disk
- `saveGeneration(opts)` — Save a generated media file to the project folder with sidecar metadata

**Architectural principle:** Blocks never write `state.currentProject.itemGroups` directly. They call ProjectService methods which handle the full mutation → persist → emit cycle.

**Settings pipeline:** `projectService` subscribes to `settings:model:*` and `settings:tool:*` events and processes them through per-model/per-tool debounced queues (300ms). All writes to `modelSettings` and `toolSettings` in `project.json` are centralized here.

**Queue behavior:** Each `modelId` (and `toolKey`) has its own queue. Multiple models write in parallel. `ratioSelector` sub-keys are deep-merged so rapid partial updates (`orientation`, `qualityTier`, `selectedRatio`) don't drop each other. `loras` and `upscaleModel` are full replacements.

**Key creation:** Keys are created on first `select` event using defaults from `getModelSettings` / `getToolSettings`. Components never need to check key existence.

**Disk write safety:** Server-side `project.json` writes in `routes/projects.js` go through a per-file queue and atomic temp-file replace. This serializes concurrent writes from `/update-project`, `/update-project-settings`, `/migrate-project`, and project template routes so group persistence and debounced settings saves cannot interleave and corrupt the JSON file.

**Events consumed:**
- `settings:model:select` — create `modelSettings[modelId]` key with defaults if missing
- `settings:tool:select` — create `toolSettings[toolKey]` key with defaults if missing
- `settings:model:update` — queue partial update, debounced write
- `settings:tool:update` — queue partial update, debounced write

## generationService.js (`js/services/generationService.js`)

Centralized generation lifecycle manager. Wraps `runCommand()` with project persistence, StatusBar progress, and callback-based state management.

**API:**
- `startGeneration(config, callbacks, opts)` — Run a generation with automatic save, group creation/update, and progress tracking. Returns `{ cancel }`.

- `enqueueGeneration(config, callbacks, opts)` - Cue-mode entry point. Adds to the in-app queue and dispatches one generation at a time.
- `clearPendingQueue()` - Clears pending Cue jobs without interrupting the running job.
- `getGenerationQueueSnapshot()` - Returns the visible Cue snapshot for queue panels.
- `cancelPendingCueJob(queueJobId)` / `cancelRunningCueJob(queueJobId)` - Cancel a pending Cue item or stop the current Cue item by stable queue id.

**Callbacks:** `onPreview`, `onComplete`, `onCancel`, `onError`

**Key pattern:** Blocks enqueue through `enqueueGeneration()` for Cue mode. The service handles backend lifecycle, file save, project mutation, visible queue snapshots, loop re-fire, and Cue dispatch sequencing. Queue UI subscribes to `generation-queue:changed`; do not poll ComfyUI queue depth for Cue.
