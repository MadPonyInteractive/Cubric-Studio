## Sub-Agent Briefing
> Use this file when you need to know what events a Primitive or Compound component emits or listens to.
> Organism/Block events live in `component-events-organisms.md` and `component-events-blocks.md`.
> Generation lifecycle (commandExecutor, StatusBar, Active Generation Registry) lives in `component-events-lifecycle.md`.

---

## Primitives

### MpiButton
EMITS:   `toggle` `{ active: boolean }` — only in icon-button toggleable mode
         `click`  `{ originalEvent: Event, active: boolean }`
LISTENS: (none — pure DOM events only)
API:     `el.setActive(active)` · `el.setLabel(label)` · `el.setDisabled(disabled)`
NOTE:    Stage redesign added `shape: 'sharp' | 'pill'` prop (default `'sharp'`, applies `--r-1: 0`); pass `shape: 'pill'` to opt into the legacy rounded look. Icon-button variant supports `'ghost'` (transparent, hover lifts) in addition to `secondary`/`danger`.
         External callers MUST use `el.setActive(bool)` / `el.setDisabled(bool)` to mutate state — the click handler reads `props.active` / `props.disabled` and toggling the DOM attributes alone leaves `props.*` stale, causing clicks to silently bail.

### MpiCanvas
EMITS:   `modechange` `{ mode: 'none'|'mask'|'crop'|'compare' }`
LISTENS: (none)
PROPS:   `onBrushSizeChange(size)` · `onBrushTypeChange(type)` · `onPointsChange(count)` — plain callbacks passed at mount, NOT events.
API:     `setPointsMode(bool)` / `isPointsMode()` · `clearMaskPoints()` / `getMaskPointCount()` / `getPointsMaskDataURL()` · `bakeAutoPicksInto('manual'|'subtract')` (MPI-361)
NOTE:    Point prompts are a FOURTH mask layer and deliberately not a canvas — `MaskManager.points[]` holds `{x, y, positive}` in SOURCE-image px (not the MASK_MAX_EDGE-capped working px), because the graph measures each dot's bbox in real pixels of the image it loads. `getPointsMaskDataURL()` renders them white-on-BLACK at full source size on demand; nothing composites them. Polarity is carried by RADIUS: r=8 positive / r=4 negative straddles the exact `< 10px bbox width` cliff `mask_hint_use_negative='Small'` uses. In points mode, left-click adds a positive dot, right-click a negative one, and clicking an existing dot removes it; `InputController`'s contextmenu handler calls `stopPropagation` as well as `preventDefault` because `MpiCanvasViewer` has its own contextmenu handler on its root.

### MpiCheckbox
EMITS:   `change` `{ checked: boolean }`
LISTENS: (none)
API:     `el.isChecked()` → boolean · `el.setChecked(bool)` — imperative sync

### MpiColorPicker
EMITS:   `change` `{ r: number, g: number, b: number, hex: string }`
LISTENS: `ui:close-all-popups` — closes the portaled picker popup
API:     `el.getRGB()` · `el.setRGB(r, g, b)` · `el.setHex(hex)` · `el.getHex()`
NOTE:    Primitive HSV visual picker with saturation/value square, hue slider, RGB/hex precision inputs, lightweight portaled floating popup, pointer/keyboard support, and MutationObserver cleanup.

### MpiDropdown
EMITS:   `change` `{ value: string, label: string }`
         (bus) `ui:picker-open` `{ owner }` — on open, so every OTHER open picker closes (MPI-728; the trigger's `stopPropagation()` hides the click from their document listeners)
LISTENS: `ui:picker-open` — closes unless `owner` is its own list · `ui:close-all-popups` — closes (also document click + MutationObserver for cleanup)

### MpiFilterBar
EMITS:   `change` `{ key: groupKey|'search', active: { [groupKey]: Set }, query: string }` (DOM event `mpifilterbar:change`; `active` holds COPIES, `query` is trimmed + lowercased)
LISTENS: (none)
API:     `el.setActive(key, values)` / `el.setQuery(q)` — silent, never emit · `el.appendTrailing(node)` — APPENDS into the trailing slot, never mounts · `el.destroy()`
NOTE:    Shared header row of the Model Library (groups media + tier, Refresh in the trail) and the Flow Library (media + type), MPI-754. Draws its OWN `<button>` tags and `<input>` and owns their chrome — a consumer must not restyle `.mpi-filter-bar__tag` / `__search-input`. Takes option VALUES, never a descriptor property name. Factory `instance.on('change')` returns no unsubscribe: teardown is `bar.el.destroy()` in the consumer's `el.destroy`.

### MpiTreePicker
EMITS:   `change` `{ value: string, label: string }`
         (bus) `ui:picker-open` `{ owner }` — on open (MPI-728, same contract as MpiDropdown)
LISTENS: `ui:picker-open` — closes unless `owner` is its own box · `ui:close-all-popups` — closes the portalled box (also document click + MutationObserver for portal-node cleanup)
NOTE:    Searchable folder-tree picker (MPI-233) for path-shaped option values; drop-in for MpiDropdown (same `change` contract). Value = full path string. First consumer: LoRA slots in MpiModelSettings.

### MpiInput
EMITS:   `input`  `{ value: string|number, originalEvent: Event }`
         `change` `{ value: string|number, originalEvent: Event }`
LISTENS: (none)

### MpiModal
EMITS:   (none)
LISTENS: `ui:close-all-popups` — calls `el.hide()` if backdrop is active

### MpiOverlay
EMITS:   `close` `{}`
LISTENS: `ui:close-all-popups` — calls `el.hide()` if currently shown
         (MutationObserver for safety release only)

### MpiPopup
EMITS:   `close`      `{}`
         `mouseenter` `MouseEvent`
         `mouseleave` `MouseEvent`
         `select`     `{ id: string, el: HTMLElement }` — item clicked (when items prop used)
         `click`      `MouseEvent`
LISTENS: `ui:close-all-popups` — removes `is-active`, emits `close`

### MpiMediaDropOverlay
EMITS:   (none — dumb primitive; calls `props.onDrop({ files: [{ file, mediaType }, ...] })` once per drop with all valid image/video files; all side effects in caller)
LISTENS: `ui:close-all-popups` — hides overlay (Escape during drag)
NOTE:    Accepts any image/video OS file drag (multi-file supported). Ignores internal `application/mpi-media` drags.

### MpiProjectDropOverlay
EMITS:   (none — dumb primitive; calls `props.onDrop({ folderPath, source })` on valid drop; all side effects in caller)
LISTENS: `ui:close-all-popups` — hides overlay
NOTE:    Accepts a project folder OR a project.json file. Resolves absolute path via Electron `webUtils.getPathForFile`; no-op when `window.require` is absent (browser dev mode). Used by landing page (projectUI.js) — `onDrop` calls `addProjectByFolder()` then reloads the grid.

### MpiProgressBar
EMITS:   `input`  `{ value: number }`
         `change` `{ value: number }`
LISTENS: (none)

### MpiRadialMenu
EMITS:   `select`    `{ action: string }`
         `will-open` `{}` (fires BEFORE items render; listeners can call `setContextItems()` synchronously to refresh availability)
         `open`      `{}`
         `close`     `{}`
LISTENS: Hotkeys 'control+tab' (`radialMenu.devToggle`, MPI-338 — hold swaps to the `dev` context, restored by `_hide()` on every close path; dev-mode-gated so inert in production), window keyup/mousemove (close on release — intentional exception for radial menu gesture)
NOTE:    **DEV-ONLY as of MPI-378.** The component does NOT bind bare Tab any more — Tab is the workspace flipper (`workspace.flip`, `js/shell/navigation.js`, `docs/shell.md`). `RADIAL_ITEMS` and the `PAGE_GALLERY`/`PAGE_GROUP_HISTORY` contexts are gone; `_syncRadial()` early-returns unless `APP_CONFIG.dev_mode`, so in production nothing mounts at all. Do NOT re-add a Tab item or a workspace context — take a hotkey of your own instead.
NOTE:    Dev actions (Apps/Components/Restart Engine) live on the `dev` context (Ctrl+Tab), the only context there is — `navigation._syncRadial` sets it only in `APP_CONFIG.dev_mode`. The old `extraItems`/`setExtraItems` API was removed (MPI-338).
NOTE:    Items may carry `disabled:true` (MPI-337). Disabled items render dimmed (`.mpi-radial__item--disabled`) and can never be `select`-ed. MPI-356: the resolver aims at the NEAREST sector INCLUDING disabled ones and then returns -1 if that one is dimmed — it must not fall through to the nearest enabled neighbour, or a blind gesture at a dead sector fires the wrong action.
NOTE:    Ops LEFT the radial (MPI-356) — they live in the prompt box's op strip. Models left too (MPI-378): the prompt box's model button is now the only emitter of `ui:open-model-picker`. There is no op→item mapping and no `refreshRadial`/`refreshGroupHistoryRadial` plumbing any more.

### MpiRadioGroup
EMITS:   `select` `{ value: string, option: object|string }`
LISTENS: (none)
NOTE:    Options accept `string` or `{ label, value, icon?, info?, disabled? }`. Props: `iconOnly` (bool) hides labels and renders icon-only buttons; per-option `info` overrides group `info` for status-bar text. **Emits `select` not `change`** — wiring `change` silently no-ops persistence/injection.

### MpiToast
EMITS:   `close` `{}`
LISTENS: (none)

---

## Compounds

### MpiAutoMaskThumbs
EMITS:   `change` `{ picks: Set<number> }`
LISTENS: (none)

### MpiChangelogDialog
EMITS:   `dismiss`     `{ version }` — Done button only. Escape/backdrop hide the modal but do NOT emit dismiss; shell persists the seen version solely on `dismiss`.
LISTENS: (none — internal MpiModal handles `ui:close-all-popups`)
NOTE:    Startup "What's New" overlay. Content set via `el.open({ version, stage, notes })` before `show()`. Reads release notes from `js/data/releaseNotes.js`. Not an updater.

### MpiEngineInstall
EMITS:   (none — emits to Events bus, not component events)
LISTENS: `engine:downloading` — engine archive bytes (or the uv bootstrap label)
         `engine:extracting` — unpack (`status:'extracting'`, `percent`, `file`) or a uv/pip/git output line (`status` = stage id)
         `engine:patching` — Finish step
         `engine:upgrade-status` — upgrade step label
         `engine:uw-installing` — label; `phase:'nodes'` moves the tracker to Install
         `download:progress` — modelId='__universal_workflow__' only: UW bytes
         `download:complete` — modelId='__universal_workflow__' only: UW bytes are no longer live
         `engine:complete` — Complete state, emits `engine:ready` to Events bus after 500ms
         `engine:error` — displays error message with retry button
PATTERN: Single SSE connection bridge — all events come from `downloadService` (no own EventSource)
NOTE:    Handlers only record facts on `_run`; `_paint()` derives steps, label, bar-or-spinner and detail, and runs once a second from the elapsed ticker (MPI-792). No handler writes the screen directly — two streams writing one element was the MPI-410 strobe.

### MpiErrorDialog
EMITS:   `dismiss`     `{}`
         `downloadLog` `{}`
LISTENS: (none — internal MpiModal handles `ui:close-all-popups`)

### MpiGroupCard
EMITS:   `open`          `{ group: ItemGroup }`
         `select`        `{ group: ItemGroup, selected: boolean }`
         `media-missing` `{ group: ItemGroup, itemId: string }`
LISTENS: (none)

### MpiContextMenu
EMITS:   (none — calls `props.onSelect(key)` callback then self-closes)
LISTENS: `ui:close-all-popups` — self-close
API:     Static `MpiContextMenu.show({ x, y, items, onSelect })` — portals to body, clamps to viewport, dismisses on outside-click / Escape
NOTE:    `items` shape: `[{ key, icon?, label, kbd?, separator?, disabled?, danger? }]`. Stage redesign: `kbd` renders right-aligned keyboard hint (3-column grid layout); `separator: true` renders a divider line and ignores other fields.
NOTE:    Compounds never call `show()` (same tier): MpiGalleryGrid, MpiHistoryList and MpiMediaSlot emit `ui:context-menu` `{ x, y, items, onSelect }`, and `shell.js` is its only listener, calling `show()` (MPI-751). Blocks and the shell call `show()` directly.

### MpiHistoryList
EMITS:   `entry-selected`    `{ idx, item }` — card clicked (single-select)
         `selection-changed` `{ indices: number[], anchor: number }` — ctrl/shift-click updated selection (`indices` chronological — see API note)
         `selection-exited`  `{}` — selection mode ended (count → 0)
         `delete-selected`   `{ indices: number[] }` — Delete chosen from context menu OR `Delete` hotkey (selection → indices; no selection → `[_selectedIdx]` so active entry is targeted)
         `compare-requested` `{ indices: [number, number] }` — Compare chosen from context menu (exactly 2 selected)
         `combine-requested` `{ indices: number[] }` — Combine chosen from context menu (video group, ≥2 selected, chronological order)
         `composite-requested` `{ indices: [number, number] }` — Mask composite chosen from context menu (image group, exactly 2 selected, ≥1 of them masked — gate awaits `props.hasMaskForIndex` on BOTH)
         `add-to-gallery`    `{ index: number }` — Add to gallery chosen from context menu (exactly 1 selected)
         `reuse`             `{ positive: string, negative: string }` — Reuse-prompt icon button on a card clicked. Parent emits `workspace:inject-prompts` so PromptBox restores text. Button hidden on cards without `item.prompt` or `item.negativePrompt`.
LISTENS: (none)
GLOBAL EMITS: `ui:context-menu` `{ x, y, items, onSelect }` — the right-click menu. A Compound may not import `MpiContextMenu`, so `shell.js` shows it (MPI-751)
API:     `el.setActiveIndex(idx)` · `el.setGroups(history)` · `el.appendEntry(item)` · `el.removeEntries(indices)` · `el.exitSelectMode()`
         `el.getSelectionOrder()` → `number[]` in chronological click order. Set insertion order alone is fragile across shift-range rebuilds (direction-aware walk in `_rangeSelect` keeps anchor first, target last). First shift-click without prior selection anchors at `_selectedIdx` (the currently-active entry), not at the stale default `_anchor = 0`.
NOTE:    Selection: plain-click single-selects; ctrl/cmd-click first-time seeds anchor+selection from current active entry then toggles clicked; shift-click range-selects. Right-click NEVER enters selection mode — context menu acts on existing selection if right-clicked card is in it, otherwise acts on right-clicked card alone (ephemeral target; `compare-requested`/`combine-requested`/`delete-selected`/`add-to-gallery` indices reflect that single card). Dev-mode gate: if `APP_CONFIG.dev_mode` truthy, skips `e.preventDefault()` on contextmenu so Electron inspect-element works. Selection-order numeric badge (`#N`) renders on each selected card when `_selection.size >= 2`; hidden below.

### MpiHistoryTools
EMITS:   `activate` `{ mode: string }` — any mode change (user click or `setMode`). No `deactivate` event.
LISTENS: (none)
API:     `el.setMode(mode)` — activate programmatically; re-activating current = no-op; emits `activate`
         `el.setDisabled(map)` — bulk update `{ [toolMode]: { disabled: bool, reason?: string } }`; sub-modes accepted
         `el.getActiveMode()` — read current mode
NOTE:    Radio behaviour: re-click active tool = no-op. `mask` is now a flat tool (no group/sub-modes). `disabled` tools render grayed, non-interactive, show `reason` as tooltip.
         Image Transform group contains `crop` and `resize`. Video Transform contains `crop` and `resizeVideo`. Both resize entries route to the same `MpiToolOptionsResize` compound via `TOOL_OPTIONS_REGISTRY`; the compound branches on `props.kind`.

### MpiOptionSelector
EMITS:   `change` `{ value: string, def?: object }` — user picked a value (ratio/number/buttons variants)
         `change` `{ qualityTier: 'very_low'\|'low'\|'medium'\|'high'\|'very_high' }` — quality variant only
         `orientation_change` `{ orientation }` — ratio variant orientation toggle
         `popup_toggle` `{ active: boolean }` — popup opened/closed (ratio/number/buttons; quality has no popup)
LISTENS: `ui:close-all-popups` — closes popup if open (ratio/number/buttons)
API:     `el.getValue()` · `el.setValue(v)` · `el.setTriggerIcon(icon)` · `el.setTriggerActive(bool)` · `el.setButtons(buttons)` · `el.getButtons()`
         Ratio variant only: `el.setQualityTier(tier)` — switches the rendered ratio set without going through any popup, picks a fallback label if current ratio is missing from the new set, then emits `change` with the resolved dims.
NOTE:    Four variants — `ratio`: preset ratio picker (renders `.ratio-row` + `.ratio-pick.r-X-Y` Stage selectors inside the popup); `number`: value list used for the PromptBoxControls `batch` entry (nodeTitle `'Batch_Size'`; replaces the retired MpiNumberSelector/MpiBatchSelector); `buttons`: generic button-list popup; `quality`: standalone inline radio row (no popup, no trigger button) used by the `qualityTier` PromptBoxControl for quality-mode models (wan, future ltx). All popup variants share: trigger button, portal popup, outside-click dismiss, viewport clamp, `ui:close-all-popups` self-close.
         Delegated `popupEl` click handlers call `e.stopPropagation()` first — sub-popup interactions never bubble to document-level listeners. Required because handlers rewrite `grid.innerHTML` / `trigger.innerHTML` synchronously; without it, `e.target` detaches mid-bubble and breaks parent popup `closest('.mpi-popup')` exclusion → parent closes incorrectly.
         Quality is no longer a header inside the ratio popup. The standalone `quality` variant emits `change` to its parent PromptBoxControl, which fans out via `Events.emit('ratio:quality-change', { modelId, qualityTier })`; the ratio control filters by `modelId`, then calls its own `el.setQualityTier(tier)` to re-render. Keeps a single source of truth under `modelSettings[modelId].ratioSelector.qualityTier`.

### MpiSlideOver  *(Stage redesign — replaces full-page modal pattern for landing actions)*
EMITS:   `close` `{}` — panel dismissed (close button, outside-click, or `ui:close-all-popups`)
LISTENS: `ui:close-all-popups` — closes
         (module-level) `slide-over:open` `{ title, component }` — mounts a fresh instance into a fresh `<div>`, calls `el.open()`, registers `close` → singleton clear. Opening a second slide-over closes the first.
API:     `el.open()` — append to `document.body`, force reflow, set `aria-expanded="true"` (slide-in)
         `el.close()` — set `aria-expanded="false"`, await transitionend, remove from DOM, emit `close`
NOTE:    Owns chrome only (header with UPPERCASE title + close button, scrollable body, optional footer). Content is supplied via `props.component` — a ComponentFactory blueprint mounted into `.mpi-slide-over__body`. Calls `_contentInstance.el.onOpen?.()` after mount so content can re-init fields. Module-level `let _active = null;` enforces the singleton. Outside-click is registered on `document` with a `setTimeout(..., 0)` so the triggering click does not immediately close. `_doClose` destroys the content instance (MPI-177 — content `el.destroy()` actually runs now; previously every open leaked its timers/subs) and removes the panel node on `transitionend` with a 400ms backstop (throttled windows can skip the transition).

### MpiSettings *(content-only — body of MpiSlideOver)*
EMITS:   (chrome owned by MpiSlideOver; no `close` event. RunPod events moved to MpiRunpodSettings — MPI-177)
LISTENS: `state.promptReuseOptions` / `state.promptReuseSource` via `Events.onState` — sync the Reuse Prompt controls.
API:     `el.onOpen()` — re-runs `_initFields()` with current values from `Storage` / `state`. Called by `MpiSlideOver.setup()` once per open.
NOTE:    Trigger via `Events.emit('slide-over:open', { title: 'Settings', component: MpiSettings })`. The legacy `el.show()/el.hide()` instance methods have been removed. **Settings is about THIS machine:** the RunPod Remote Engine and Language Models sections are NOT here — both MOVED to `MpiRemote` (MPI-728), not duplicated. `el.destroy()` cleans reuse subs + extra-folder controls.

### MpiRemote *(content-only — body of MpiSlideOver; MPI-728)*
EMITS:   (none — chrome owned by MpiSlideOver)
LISTENS: (none)
API:     `el.onOpen()` — forwards to `MpiLlmSettings` and `MpiRunpodSettings`. Called by `MpiSlideOver.setup()` once per open.
NOTE:    Trigger via `Events.emit('slide-over:open', { title: 'Remote', component: MpiRemote })`. The sections about SOMEBODY ELSE'S machine. Owns no controls: mounts `MpiLlmSettings` into `#mpiRemoteLlmMount` and `MpiRunpodSettings` into `#mpiRemoteRunpodMount`, once each in setup; `el.destroy()` destroys both. Section chrome (`.mpi-settings__*`) still comes from `MpiSettings.css`.

### MpiLlmSettings *(content section — mounted by MpiRemote; MPI-728)*
EMITS:   (none)
LISTENS: (none)
API:     `el.onOpen()` — rebuilds every control from scratch (connection + key presence, `/llm/models`, `/llm/connection/models`, plugin install state); forwarded by MpiRemote.
NOTE:    The Language Models section, one row PER JOB (Prompt enhancement, Image descriptions, Agent). Enhancement backend = ComfyUI / Ollama / Remote (code value `'endpoint'`, MPI-737), Image descriptions = ComfyUI / Remote, with NO automatic entry; both default to ComfyUI (`backendPreference()` / `describeBackendPreference()` in `js/services/llmService.js`, localStorage `cubric.llm.backend` / `cubric.llm.describeBackend`). An entry that cannot run stays LISTED but `disabled` — Remote only on `NO_KEY`/`NO_PROFILE` (`_remoteBlocked`; an unreachable endpoint stays pickable, its error under the model list), ComfyUI until the `image-describer` plugin is installed — and a pinned backend that later becomes unavailable is shown as-is with a note, never swapped. The model dropdown sits UNDER each backend: hidden for ComfyUI, the registry list (`/llm/models`) for Ollama (`cubric.llm.enhancerModel`), the connection's list for Remote (enhance `cubric.llm.endpointModel`, describe `cubric.llm.describeModel`, vision-flagged models only when the endpoint reports flags). No DeepInfra-only key or backend remains. "New to DeepInfra?" promo (`https://deepinfra.com/dash`, `.mpi-settings__signup`, shared with RunPod) tops the connection block.
NOTE:    **Shared connection (MPI-774).** ONE provider + key block feeds every Remote-backed job: pick persists via `Storage.setLlmConnection({ profileId })` (`deepinfra`/`openrouter`/`openai`/`ollama`/`custom`), key is write-only through `secretsClient.setEndpointKey()` (never read back, no state key; the key group is hidden for the keyless `ollama` preset), `custom` reveals a Base URL saved via `secretsClient.saveEndpointProfile()`. ONE `GET /llm/connection/models?profileId=` per render (`_refreshModels`) feeds every Remote model dropdown via `_remoteModelOptions(job, saved, filter)`, recommended-for-that-job entries first, labelled "(recommended)"; a newer render supersedes a slower one by sequence number.
NOTE:    **Agent row (MPI-774).** Backend is a fixed text label, not a dropdown ("Remote · <provider>" — no local backend exists for the agent). Model and mode both persist in the SAME `Storage.getAgentPrefs()`/`setAgentPrefs({ ...prev, <key> })` bag (`model`: string, empty = the connection's recommended pick; `mode`: `'auto'`\|`'ask'`, default `'auto'`) — the same bag `agentService.agentSendMessage()` reads to build every `POST /agent/message`. "Test tool use" POSTs `/agent/probe { profileId, model }` (one small request) and reports tool-call support + latency. No `state.js` key anywhere in this row.

### MpiOllamaSetup *(Compound, mounted by MpiLlmSettings; MPI-728)*
EMITS:   `state` via the component-local `emit` (read with `inst.on('state', fn)`, NOT `Events`): the `/llm/ollama` state after every read, about once a second while a start, install or download is running.
LISTENS: (none)
API:     `el.setModel(id)`: points the row at another Ollama model and re-reads the state. `el.destroy()`: stops the poll and destroys its button and progress bar.
NOTE:    The inline Ollama row under the backend picker, mounted at `#mpiSettingsLlmOllamaSlot` ONLY while Ollama is the picked backend. Mounting it STARTS a stopped Ollama (no consent needed for an app the user installed); installing Ollama and downloading a model are buttons, and the click is the consent: no toast, no popup. The work runs in the server (`services/ollamaLifecycle.js`), so closing the panel does not stop a download, and the row picks the progress back up when it opens.

### MpiRunpodSettings *(content section — mounted by MpiRemote since MPI-728; MPI-177 extraction from MpiSettings)*
EMITS:   `remote:wait-start`  `{ gpuType, datacenter }` — MPI-110: ask the shell to start an auto-retry wait for an out-of-stock GPU (Connect pressed with `autoRetry` on + GPU not in stock, or a mid-connect snipe). The WAIT LOOP lives in shell.js (`_initGpuWaitBridge`), NOT here, so it survives navigating away from Settings.
         `remote:wait-cancel` `{}` — MPI-110: Cancel pressed while waiting → stop the shell wait (no Pod was created, so no teardown).
LISTENS: `state.remoteWaitGpu` via `Events.onState` — repaints the engine button (waiting…/Cancel) when a shell-owned wait starts/ends. Also drives `_applyEngineStatus`.
API:     `el.onOpen()` — re-runs `_initRunpodSection()`; forwarded by MpiRemote on every panel open.
NOTE:    Verbatim extraction of MpiSettings' RunPod section — DOM ids (`mpiSettingsRunpod*`) and `mpi-settings__runpod-*` classes kept. Owns the 5s engine-status poll + volume disk poll; `el.destroy()` clears both and sets `_connectAbort` (breaks in-flight `_pollEngineReady`; the Pod keeps booting — destroy ≠ Cancel). Auto-retry wait loop owner = shell.js (`_startGpuWait`/`_stopGpuWait`/`_initGpuWaitBridge`); on the GPU freeing it calls `_initRemoteBoot` for the full create→ready→WS flow. App-wide connecting state is surfaced by the connection feed reading the backend `connecting` flag — this panel does not own it.

### MpiHotkeys *(content-only — body of MpiSlideOver)*
EMITS:   (none)
LISTENS: (none)
NOTE:    Static hand-authored HTML. Trigger via `Events.emit('slide-over:open', { title: 'Hotkeys', component: MpiHotkeys })`. Hotkey rows still hand-authored — see `docs/shell.md` and `components.md` for the registry/hotkeys-page pairing rule.

### MpiAbout *(content-only — body of MpiSlideOver)*
EMITS:   (none)
LISTENS: (none)
NOTE:    Trigger via `Events.emit('slide-over:open', { title: 'About', component: MpiAbout })`.

### MpiInstalledDisplay
EMITS:   `delete`      `{}`     — Action button clicked (Install when idle)
         `pause`       `{}`     — Pause button clicked (during download)
         `resume`      `{}`     — Resume button clicked (when paused/partial)
         `cancel`      `{}`     — Cancel button clicked
         `uninstall`   `{}`     — Uninstall button clicked (when installed)
LISTENS: (none)

### MpiMemoryMonitor
EMITS:   `release` `{ deep: boolean }`
LISTENS: (none — uses raw `window.addEventListener('keydown/keyup')` for Ctrl detection)
FLAG:    Uses `Hotkeys.bind('memoryMonitor.ctrl.down/up', fn)` for Ctrl visual feedback.

### MpiModelSettings
EMITS:   `saved` `{}`
         `close` `{}`
GLOBAL EMITS (via Events.emit, consumed by projectService):
         `settings:model:select` `{ modelId }` — emitted in `el.open()` when opened for a model
         `settings:tool:select`  `{ toolKey }`  — emitted in `el.open()` when opened for a tool
         `settings:model:update` `{ modelId, key, value }` — loras + upscaleModel on _autoSave (no `opName`: projectService routes to the model-wide bucket)
         `settings:tool:update`  `{ toolKey, key, value }` — upscaleModel on _autoSave
LISTENS: `state:changed` `{ key: 'availableLoras' | 'upscaleModels' }` — live re-render while open; `_rescanning` excludes open()'s OWN loadAssets (MPI-356)
         `settings:model:update` `{ key: 'loras' }` from **MpiLoraRack** (MPI-724) — the other view of the same value. Applied IN PLACE through a per-slot handle registry (`setValue` / `applyBypass`), never by re-running `_mountLoraSlots`, which would tear down an open `MpiTreePicker` mid-search. Its own emit is skipped via a `_selfWrite` flag — safe as a plain boolean because `Events.emit` is synchronous
         (otherwise reads `state.currentProject`, `state.upscaleModels`, `state.availableLoras`)
         `ui:error` emitted on save failure via `Events.emit`

### MpiLoraRack — the current model's LoRAs in the PromptBox popup (Compound — js/components/Compounds/MpiLoraRack/MpiLoraRack.js, MPI-724)
EMITS:   `resized` `{}` — rendered row count changed; the host re-anchors (MpiPromptBox calls `positionPopup()` when the popup is open)
GLOBAL EMITS:
         `settings:model:update` `{ modelId, key: 'loras', value }` — a strength or bypass edit, in the SAME shape `MpiModelSettings._autoSave()` writes. Deliberately does NOT emit `upscaleModel`: the rack does not own that value
LISTENS: `settings:model:update` `{ key: 'loras' }` — filtered to its own `modelId`, own echo skipped via `_selfWrite`. Filled-set signature changed (only the overlay can cause that) → full rebuild; same signature → in-place `setValue`/`applyBypass`
FLAG:    **No `state:changed` subscription, deliberately.** projectService debounces ~300ms and assigns `state.currentProject` INSIDE the timer, so a listener on that key re-enters on its own echo — the loop that made MpiModelSettings unclosable in MPI-356. Every re-read is guarded by `_dirtyFor`, which keeps the held value while this rack's own write is still in flight; without it `_refreshOpSlot` (which runs on EVERY op change) would revert a strength typed less than 300ms earlier.
FLAG:    Read-only over the SET — no picker, no add, no clear. `el.refresh()` exists for the one writer its listener cannot hear: Reuse Prompt writes `loras` straight into the project (`projectService.applyPromptReuseSettings`) and arrives via `el.refreshControls()` → `_refreshOpSlot` → `setModel`.

### MpiModelManager — the Model Library overlay (Organism — js/components/Organisms/MpiModelManager/MpiModelManager.js)
EMITS:   (none — the hosted MpiOverlay owns its own `close` + `ui:close-all-popups` handling)
LISTENS: `state:changed` `{ key: 's_installedModelIds' }` — re-renders the tile grid when install state changes
         `remote:connection` `{ connected, phase, vramGb }` — engine switch → re-render + re-sync (drives VRAM table + Pause visibility)
         `download:progress` `{ modelId }` — patches that tile's inline state row in place (+ rebuilds the open detail if it's that model)
         `download:started` `{}` — full grid re-render (started tile shows progress bar; detail footer → Pause/Cancel)
         `download:paused` / `download:resumed` / `download:installing` `{ modelId }` — patch that tile in place
         `download:cancelled` / `download:complete` `{}` — `awaitReSync()` (re-render; install state moved sections)
         `download:uninstalled` `{ modelId, ... }` — emits a `ui:success`/`ui:info` toast summarizing kept/removed.
         **NOT the only listener since MPI-682:** `MpiFlowLibrary` carries its own, because this
         one resolves a `flow:<id>` key to neither a MODEL nor a PLUGIN and only exists while the
         Model Library is mounted. The two never both speak — each returns early on a key it does
         not own. A new uninstallable entity needs its own handler for the same reason
         `download:failed` `{}` — `awaitReSync()`
         `ui:close-all-popups` — closes the detail drawer
API:     `el.open()` — shows the hosted overlay + re-syncs installed state + one-shot hardware fetch (alias: `el.onOpen`)
         `el.close()` — hides the overlay
         `el.destroy()` — tears down subscriptions, tiles, detail toggles, the uninstall dialog, and the hosted overlay
PATTERN: MPI-215 — self-hosts `MpiOverlay(mountTarget:'body')` styled as a dark contact sheet. Lean tiles
         (Map by modelId, patched in place) split into Installed/Available × Image(4:5)/Video(16:9) sub-grids;
         Media/Tier/search filters compose (shared `MpiFilterBar`, MPI-754). Clicking a tile opens a right-drawer detail panel (absolute child of
         the overlay — stacks above it, reuses MpiSlideOver's CSS chrome, NOT its singleton) carrying description,
         arch toggles (MPI-200/209), inline VRAM→RAM table (MPI-168), disk, and
         Install/Update/Uninstall. Detail video autoplays; click → native `requestFullscreen()` (Escape exits FS only).
         Opened via `models:open` (shell mounts once + `el.open()`); also the project-page `Models` nav action + dev gallery.

### MpiNewProject
EMITS:   `create` `{ name: string, location: string|null }`
         `cancel` `{}`
LISTENS: (none — internal MpiModal handles `ui:close-all-popups`)

### MpiAddToProject
EMITS:   `confirm` `{ projectId: string }` — after `onConfirm` prop resolves
         `cancel`  `{}` — Cancel button only (NOT on Escape/hide)
LISTENS: (none — internal MpiModal handles `ui:close-all-popups`)
NOTE:    Compound overlay: MpiModal + MpiDropdown (project picker) + OK/Cancel MpiButtons. `onConfirm(projectId)` prop does the async copy; OK disabled while it runs, modal stays open on reject. Mounted on demand by MpiGalleryBlock's `add-to-project` handler.

### MpiOkCancel
EMITS:   `ok`     `{ inputValue?: string }`
         `cancel` `{}`
         `input`  `{ value: string }`
LISTENS: (none — internal MpiModal handles `ui:close-all-popups`)

### MpiProjectName
EMITS:   `up`      `{}`
         `gallery` `{}`
         `flows`   `{}` (MPI-589) — shell answers with `Events.emit('flows:open')`, which carries the no-engine guard
         `record`  `{}` (MPI-678) — shell calls the exported `recordAudioIntoProject()` directly (it shows the recorder, uploads, and emits `media:imported` itself)
LISTENS: (none)
API:     `el.setRecordVisible(visible)` (MPI-678) — **Record is GALLERY-ONLY, and the technical reason is GONE (MPI-723).** It was: `media:imported` built the ItemGroup and its only listener sat inside `MpiGalleryBlock`, so recording from group-history wrote the file + sidecar to disk and created no group. That build is now `js/services/mediaImportService.js`, app-lifetime — a recording made from any page becomes a card. The gate stays as an UNDECIDED PRODUCT QUESTION (what should Record do from inside a history entry?), so do not cite the old reason, and do not lift the gate without asking. Gated on the same `_updateBreadcrumb` branch that sets `ASSETS` vs `ENTRIES`. Flows + Record share one absolutely-centred `.mpi-project-name__centre` group, so Flows sits half a Record button left of true centre in the gallery (accepted; it was dead centre in MPI-589).
         `el.getToolbarSlot()` (MPI-749) — the empty `.mpi-project-name__toolbar` slot before the stats. `navigation.js` mounts `MpiGalleryToolbar` into it on the gallery page only; the stats hide below a 1400px bar width only while it is filled, so group-history keeps its ENTRIES readout.

### MpiGalleryToolbar (Compound — js/components/Compounds/MpiGalleryToolbar, MPI-749)
EMITS:   (none — every control writes state: `gallerySizeLevel`, `galleryVolume`, `gallerySort`, `galleryShowInfo`)
LISTENS: `state:changed` — those four keys + `currentProject` (calls `filter.refresh()` for the FILTER dot, tooltip and open panel rows)
NOTE:    FILTER + panel are `mountGalleryFilter` (`js/components/galleryFilterPanel.js`, MPI-785), shared with MpiMediaPicker; the parts file has no state listener of its own, the host calls `refresh()`. The panel is an `MpiPopup` created on open and removed on close; it closes on a 300 ms pointer leave, an outside pointerdown and `ui:close-all-popups`. It binds NO Escape hotkey: `overlay.close` runs first on every Escape and, with no overlay open, emits `ui:close-all-popups`. Never calls `Overlays` (that would engage the grid's `'overlay'` media hold). Details: `docs/gallery-filters.md`.

### MpiMediaPicker (Compound — js/components/Compounds/MpiMediaPicker)
EMITS:   `pick`   `{ filePath, mediaType }` — a tile, or a finished mic recording (modal closes)
         `import` `{ files: File[] }` — upload card, or a decoded voice-library pick (modal closes)
         `cancel` `{}` — Cancel button only (not Escape / backdrop)
LISTENS: (none — its FILTER runs on a LOCAL sort, never `state:changed`; MpiModal handles `ui:close-all-popups`)
NOTE:    Filtering = the shared `mountGalleryFilter` (MPI-785) with `setSort` re-rendering the grid. Its `<audio>` must stay unmarked (no `data-src`) — see `docs/component-contracts.md` § MpiMediaPicker.

### MpiResizeHandle (Primitive — js/components/Primitives/MpiResizeHandle/, MPI-797)
EMITS:   `resize-start` / `resize` / `resize-end` `{ x, y }` — the pointer's client coordinates while the handle holds pointer capture (`resize-end` on `lostpointercapture`, so a window blur ends a drag too). It sizes nothing; the owner does (the agent panel: `js/shell/agentPanel.js`)
LISTENS: (none — its own pointer events only; `el.destroy()` removes them)

### MpiStartingComfy
EMITS:   (none)
LISTENS: (none — direct portal, bypasses Overlays queue intentionally)

### MpiAgentChat (Compound — js/components/Compounds/MpiAgentChat/, MPI-774)
EMITS:   `working` `{ working: boolean }` — component-local; mirrors `agent:working` (own `_setWorking` helper), also fired by `el.setWorking(bool)`
GLOBAL EMITS (via Events.emit): `gallery:open-card` `{ itemId, groupId }` — a result-card thumbnail clicked. The one listener is the shell (`js/shell/agentPanel.js`): it opens that card's Group History when the open project holds the group and it is not audio; otherwise nothing happens.
LISTENS: `agent:working`    `{ turnId, working }` — flips the working dot (panel mode) / mascot (standalone mode)
         `agent:message`   `{ turnId, id, text }` — appends a markdown reply bubble
         `agent:tool`      `{ turnId, id, tool, status, label }` — appends/updates a tool status line keyed by `id`; renders `label` ONLY, never `args.prompt`
         `agent:confirm`   `{ turnId, confirmId, kind, modelId, modelName, downloadGb }` — appends an install-confirm card (Yes/No `MpiButton`s → `agentPostConfirm(confirmId, yes)`)
         `agent:result`    `{ toolCallId, ok, output?, error? }` — appends a result thumbnail card on `ok`, an error line on `!ok`
         `agent:compacting` `{ turnId, on }` — appends a "Compacting conversation…" marker when `on`
         `agent:error`     `{ turnId, code, message }` — appends an error line, forces `working` false
         `agent:user`      `{ turnId, id, text, attachments }` — a request carried in from another conversation (Phase 3c D5): draws its bubble ONCE, keyed by `id` (the history entry has the same id). The sender's own chat never gets one: it draws its bubble at send
         `agent:session`   `{ from, to }` — a conversation moved (the landing chat opened a project): reloads when `from` or `to` is its own session
         `project:changed` — reloads: another project, another conversation (the standalone landing chat always loads the landing conversation)
         `agent:send`      `{ text, attachments }` — **panel mode only** (`!props.standalone`); emitted by MpiPromptBox's Agent/Prompt toggle, routed straight into this instance's own `_sendMessage()`
API:     `el.setWorking(bool)` — force the working state externally. `el.destroy()` — runs every stored unsubscribe; there is no own `EventSource` to close (shared singleton owned by `agentService.js`).
NOTE:    One conversation per project (Phase 3c): every `agent:*` event but `agent:session` carries `session`, and the chat applies only events whose `session` equals the key its last `GET /agent/history?project=` returned (events arriving mid-load are queued, then applied). The chat never builds a key; it echoes the server's.
NOTE:    All `AGENT_EVENT_NAMES` (`js/services/agentService.js`) are bridged renderer-side by `agentService.agentInitStream()` (ONE `/agent/stream` EventSource, opened once at shell init by `agentPanel.js`) onto the app `Events` bus — this component only ever calls `Events.on`, never opens its own connection, so N mounted instances (panel + landing) share one stream. Every subscription is pushed onto `_unsubs` and unwound in `el.destroy()`.
NOTE:    On mount and on every reload, `_reload()` replays `GET /agent/history?project=` — entries are typed by `entry.kind` (`'user'\|'agent'\|'tool'\|'result'\|'confirm'\|'handoff'`), NOT `.role`. A `'confirm'` entry renders ONLY when it is `history.pendingConfirm` (still actionable) — an already-answered confirm is skipped. A `'handoff'` entry renders as a plain "Conversation compacted" marker, the same DOM shape a live `agent:compacting` uses.
