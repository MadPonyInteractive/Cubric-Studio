# General Best Practices (Do's and Don'ts)

> **AI INSTRUCTION:** Before writing any new logic or styles, you MUST verify if a utility or CSS variable already exists. Reinventing the wheel is strictly forbidden in this codebase.

## Sub-Agent Briefing
> Copy this section verbatim into any sub-agent prompt that involves DOM work, CSS, utilities, or icons.

- **Never hardcode colors.** OKLCH variables only — from `styles/01_base.css`. No hex, no named colors, no `rgb()`/`hsl()` literals. Canonical token families: `--surface-{0,1,2,3,bar,canvas}`, `--ink-{1,2,3,4}`, `--line`/`--line-soft`, `--accent-{heat,frost,ok,warn}`, `--accent-audio`, `--t-*` (type), `--s-*` (spacing), `--r-*` (radius), `--control-h-{sm,md,lg}` (control heights), `--ease`/`--t-fast|base|slow` (motion). Legacy `--neon-*`, `--bg*`, `--primary*`, `--surface-glass`, `--text*`, `--border*`, `--radius*`, `--font-main`/`--font-display` are **removed** — do not reintroduce.
- **Stage design baseline:** sharp corners default (`--r-1: 0`), no glow, no `backdrop-filter`, no glassmorphism. Pass `shape:'pill'` to opt into rounded buttons. Gradient text only on the wordmark.
- **Never let a control's height fall out of its content.** `--control-h-{sm,md,lg}` is the one height per size — a text button is a line box and an icon button is a taller glyph box, so a row pairing them used to sit 3-4px out. Three things the token does NOT fix: a non-button control has its own padding scale (a dropdown trigger / boxed field is 39px, equal to no button size — stretch the row to the FIELD); `align-items: stretch` reaches the ComponentFactory mount HOST, not the component inside it, so that host must be `display: flex` too — never via `> *`, which kills a sibling's `text-overflow: ellipsis`; and **a control that wants to be SMALLER than the token cannot say so with `height` alone** — the floor clamps the used height after the cascade, so `height: 16px` loses at any specificity and needs `min-height: 0` beside it (five call sites rendered taller than they asked for weeks, MPI-845).
- **Never paste raw SVG.** Import from `js/utils/icons.js`. If the icon is missing, add it there first.
- **Icon stroke is auto-detected — never pass `stroke: true` to `MpiButton`.** Name icons with `ratio_` prefix or `_stroke` suffix and `renderIcon()` handles stroke automatically.
- **Never use raw `document.querySelector`.** Use `js/utils/dom.js` shorthands.
- **BEM naming is mandatory.** Format: `.mpi-block__element--modifier`.
- **Never remove an element only on `transitionend`.** It never fires when a class flip starts no transition (e.g. closed before the open transition painted a frame). Wait on `Promise.allSettled(el.getAnimations().filter(a => a instanceof CSSTransition).map(a => a.finished))` instead (MPI-788).
- **For image surfaces: prefer CSS `transform` on a stack element over `ctx.translate/scale`.** CSS transform uses the GPU compositor — no re-rasterize per frame. `ctx` transforms belong only to screen-UI overlays drawn in container px.
- **Check `js/utils/` before writing any generic logic** — `async.js`, `file.js`, `images.js`, `video.js`, `mediaDimensions.js`, `string.js`, `ratios.js`, `markdown.js` may already do what you need.
- **Never hand-roll markdown.** `js/utils/markdown.js` is the ONE renderer (`marked` parses, `DOMPurify` sanitizes): `renderMarkdown(src)` for a document, `renderInlineMarkdown(src)` for a single line with no `<p>` wrapper, `renderMarkdownInto(el, src)` + `wireMarkdownLinks(el)` for a live pane. Never `innerHTML` markdown output that did not go through it — notes arrive inside project folders the user may not have written. Style the result with the shared `.mpi-md` block in `styles/markdown.css`; do not restyle headings/tables per component.
- **Frontend logging:** `import { clientLogger } from '../services/clientLogger.js'` — never use bare `console.log/error`.
- **Backend logging:** `const logger = require('./logger')` from `routes/logger.js`.
- **🔴 Mutating a mask or paint LAYER? It must be undoable.** `MpiCanvas` owns a shared
  `UndoStack` (MPI-376). Any new code that writes `manualCanvas` / `subtractCanvas` — or a
  future paint layer — records an entry FIRST or it silently punches a hole in Ctrl+Z. A
  gesture uses `undo.begin(layers)` / `commit(dirtyRect)`; a one-shot layer-wide op uses
  `mask._recordUndo()` before mutating. **Read `docs/masking-undo.md` before touching any
  layer.** Undo that works for some edits and not others is worse than none — the user learns
  to trust it, then loses work at the first unwired path.

## 🧰 The Utilities Folder (`js/utils/`)

Whenever you need generic functionality, ALWAYS check the `js/utils/` directory first. If a pattern is repeated across components, abstract it into a utility file here.

### Critical Utilities You MUST Use:
1. **`icons.js` (The Icon Source of Truth):** 
   - NEVER paste raw SVG code directly into component templates. 
   - ALL icons must be imported from `js/utils/icons.js`. If an icon doesn't exist, add it to this file first.
   - **Stroke is auto-detected by `renderIcon()` — never pass `stroke: true` to `MpiButton`.** Icons render as stroke automatically if: the name starts with `ratio_`, the name ends with `_stroke`, or it is in the built-in list (`seed`, `gallery`). Name your icon accordingly and stroke is free.
   - **For outline/stroke icons:** use the `_stroke` suffix (e.g. `refresh_stroke`). For ratio/rect icons: use the `ratio_` prefix (e.g. `ratio_16_9`). No extra props needed.
2. **`dom.js` (DOM Shorthands):** 
   - Use the shorthands in this file instead of raw, verbose `document.querySelector` or generic DOM manipulation where applicable.
3. **`ratios.js` (Aspect Ratios):** 
   - The absolute source of truth for all image/canvas aspect ratios. 

**Other available utilities you should check before writing code:**
- `async.js`
- `file.js`
- `images.js`
- `video.js`
- `mediaDimensions.js` — measure pixel dimensions (`{w,h}`) from `File`/`Blob`/URL for images or videos. Use before uploads that populate sidecar `pixelDimensions`.
- `string.js`
- `markdown.js` — the app's ONLY markdown renderer (MPI-545). `marked` + `DOMPurify`, both zero-dependency single-file browser ESM imported straight from `node_modules/` (no bundler; `express.static(__dirname)` serves them and `electron-builder.yml` ships them). Exports `renderMarkdown` (document), `renderInlineMarkdown` (one line, no `<p>`), `renderMarkdownInto(el, src)` (tags `.mpi-md`, safe to re-call) and `wireMarkdownLinks(el)` (call ONCE — a bare `<a>` click would navigate the whole Electron app away; collect the returned unsubscribe in `_unsubs`). Consumers: `MpiNotesEditor` (project + card notes) and `MpiChangelogDialog` (release notes — it takes full markdown now, even though no shipped version's notes use any yet). Shared typography lives in `styles/markdown.css` as `.mpi-md`.

> **Rule of Thumb:** If you write a block of generic data-processing or DOM-manipulation code that isn't completely specific to a single component, it belongs in `js/utils/`.

---

## 🎨 CSS & Styling (The Source of Truth)

### 🔴 The "No Hardcoding" Rule
1. **NEVER hardcode colors:** Do not use raw hex codes (e.g., `#ff0000`), standard CSS colors (e.g., `purple`), or `rgb()`/`hsl()` literals in your `.css` files. All color values MUST be OKLCH and must come from the token block in `styles/01_base.css`.
2. **Use the Base Variables:** You MUST pull colors, spacing, radii, type sizes, and motion timings from the CSS variables in `styles/01_base.css`. Canonical token families:
   - **Surfaces:** `--surface-0`, `--surface-1`, `--surface-2`, `--surface-3`, `--surface-bar`, `--surface-canvas`
   - **Ink (text):** `--ink-1`, `--ink-2`, `--ink-3`, `--ink-4`
   - **Lines:** `--line`, `--line-soft`
   - **Accents:** `--accent-heat` (pink/magenta — primary), `--accent-frost` (cyan — focus/generative), `--accent-ok`, `--accent-warn`
   - **Media-type accent:** `--accent-audio` (greenish-cyan — Cubric Audio). Mirrored from the Cubric Studio (Website) repo, never invented here; the rest of the family is MPI-736. Not a status colour — do NOT substitute `--accent-ok`, which is close enough to tempt.
   - **Type scale:** `--t-2xs`…`--t-display`
   - **Spacing:** `--s-1`…`--s-8`
   - **Radius:** `--r-1` (0px, sharp default), `--r-2` (4px), `--r-3` (12px), `--r-pill` (999px)
   - **Control heights:** `--control-h-sm` (34px), `--control-h-md` (50px), `--control-h-lg` (62px) — ONE height per size, whatever the control holds. See rule 4 below: a control that sits beside another wears the matching token instead of arriving at its own answer.
   - **Motion:** `--ease`, `--t-fast`, `--t-base`, `--t-slow`
   - **Fonts:** body = `'JetBrains Mono', monospace`. `--font-wordmark` = `'Russo One'` (self-hosted at `assets/fonts/RussoOne-Regular.woff2`) — used ONLY for the brand wordmark (titlebar + landing hero). See `.claude/rules/components.md` § Stage design baseline.
3. **`color-mix(in oklch, ...)` interpolates HUE — use `oklab` across hues.** Mixing a token whose hue is far from the surface family's 350 walks the hue *past* the colour: `--accent-audio` (170) is antipodal to it, and a 22% mix landed on a yellow, which reads as "the token never loaded" rather than as a mix. `--accent-heat` (355) hides this because it is 5 degrees away, so **no existing `color-mix(in oklch, var(--accent-heat) ...)` call site proves the pattern safe**. Rectangular space (`oklab`) has no hue to walk. MPI-730; `--accent-video` (48) and `--accent-prompt` (102) will hit it too.
4. **NEVER let a control's height fall out of its content — use `--control-h-*`.** A text button's height is its line box (13/17/20px, from a 10/13/15px font) and an icon button's is its glyph box (16/20/24px), so before MPI-822 one `md` MpiButton was 47px and another was 50px, and every row pairing them sat 3-4px out. `.mpi-btn--sm|md|lg` now carry `min-height: var(--control-h-*)`, which is the *taller* side, so nothing shrinks and a taller child (the `image` prop's 32px face) still wins. Two traps this does NOT solve, both found the same day:
   - **A control that is not a button has its own padding scale.** `.mpi-base-flow__model-name` and `.mpi-dropdown__trigger` are 39px on 10px padding — deliberately equal to each other, and equal to no button size. A button placed beside one must take the FIELD's height (stretch the row), not a `--control-h-*`.
   - **`align-items: stretch` reaches the mount HOST, not the component inside it.** `ComponentFactory` mounts into a wrapper; a `display: block` wrapper stretches while its child keeps its own height, which is exactly what reads as a dented button. The wrapper must be `display: flex` too. Do **not** apply that with `> *` — a box relying on `text-overflow: ellipsis` loses it the moment it becomes a flex container. Give the one host a class.
   - **A call site that wants to be SMALLER than the token cannot say so with `height` alone.** A floor clamps the *used* height AFTER the cascade resolves, so a rule's `height: 16px` loses to `min-height: 34px` at **any** specificity — outranking the selector cannot win it, only `min-height: 0` in the same rule releases the floor. MPI-822's "nothing shrinks" held for every control sitting on the default height and was false for all five that had deliberately shrunk below it: the media-strip remove X rendered 16×34 instead of 16×16 for weeks (Fabio spotted it by eye, MPI-845), plus both `MpiQueuePanel` buttons, `.mpi-detail__close` and the memory monitor's rail. When you write a `height` under `--control-h-*`, write `min-height: 0` beside it.
   - Guards: `tests/desktop/control-heights.spec.js` asserts every variant at every size against its token, and the flow model row against its field. `tests/button-size-floor.test.cjs` fails any rule whose SUBJECT is a button asking for a height under its size token without releasing `min-height` — and pins the floor itself, so deleting it cannot make the check pass vacuously.
5. **Template UI Adherence:** The active design system is **Stage** (see `docs/redesign/`). Stage = OKLCH mauve surfaces, heat/frost accents, sharp corners by default, **no neon glow, no glass blur, no `backdrop-filter`**. Legacy tokens `--bg`, `--bg-light`, `--bg-dark`, `--bg-elevated`, `--bg-recessed`, `--bg-modal`, `--surface`, `--surface-glass`, `--neon-electric`, `--neon-glow*`, `--neon-accent`, `--neon-border`, `--primary`, `--primary-dim`, `--text*`, `--border*`, `--radius*`, `--font-main`, `--font-display`, `--transition`, `--bounce` have been **removed** — do not reintroduce them. The only place `background-clip: text` (gradient text) is allowed is the wordmark.

### 🔴 Class Naming Convention
- **BEM is Mandatory:** Since we do not use a standard bundler, you MUST use BEM (Block Element Modifier) architecture strictly in your component CSS.
- **Format:** `.mpi-component-name__element--modifier`. This guarantees styles do not bleed globally. 
- Example: `.mpi-btn`, `.mpi-btn__icon`, `.mpi-btn--primary`.

### 🔴 `hidden` loses to your own CSS — add the override
A class carrying `display` **outranks** the UA sheet's `[hidden] { display: none }`. So `el.hidden = true` on an element your component styles with `display: flex/block/grid` does **nothing**, silently.

- Give every such element an explicit `[hidden]` rule: `.mpi-x__thumb[hidden], .mpi-x__empty[hidden] { display: none; }`.
- Or don't render it at all — `.remove()` the node, which is the right call for a control that will never apply to this mount (a destination with no opacity slider, a front end with no second slot).
- Toggling a modifier class instead of `hidden` is equally fine; what is never fine is `hidden` alone against a `display` you wrote.

**This has shipped three times** (MPI-382 inert slider rows, MPI-373 twice — the second time with warning comments about it sitting in the same file). If you write `hidden`, grep your own `.css` for that element's `display` in the same edit.

### 🔴 Never remove an element ONLY on `transitionend`
`transitionend` fires only if a transition actually RUNS, and a class flip does not guarantee one. If the computed value already equals the target, nothing runs and the event never comes. The common case: an element opened and closed before its open transition has painted a frame is still at its start values, so the close changes nothing.

- Wait on the element's real transitions instead: `Promise.allSettled(el.getAnimations().filter(a => a instanceof CSSTransition).map(a => a.finished))`, called right after the class change (`getAnimations()` flushes style, so it sees the transitions that change started). No transitions = the promise settles at once; a cancelled one settles too.
- No `setTimeout` backstop in new code: it hides the missing transition instead of handling it.

**It bit MPI-784's click-to-dismiss:** a toast clicked while its fade-in was still pending stayed invisible in the stack forever, holding a slot, so every toast queued behind it stayed hidden (MPI-788, `MpiToast.js`). `MpiSlideOver` still uses the older 400 ms timeout backstop.

---

## 🐞 Logging & Error Handling

> **CRITICAL:** Do NOT rely solely on `console.log()` or `console.error()`. We use custom log routing so errors can be saved to log files for production debugging.

### Node.js Backend (`routes/`, `server.js`)
If you are writing backend code, you MUST use the `routes/logger.js` file.
```javascript
const logger = require('./logger');
logger.error('system', 'Description of error', err);
```

### Browser Frontend (`js/`)
If you are writing frontend code, you MUST use the `js/services/clientLogger.js` file.
```javascript
import { clientLogger } from '../services/clientLogger.js';
clientLogger.error('comfy', 'Description of error', err);
```

### Backend logger arity — the 3rd arg is error-only

`routes/logger.js` public API: `logger.info(category, message)` — 2 args; `logger.warn(category, message)` — 2 args (3rd argument is SILENTLY DROPPED, not formatted, not logged); `logger.error(category, message, err)` — 3 args (`err.stack` appended). To attach structured detail to a `warn`/`info`, fold it into the message string yourself (e.g. `JSON.stringify(detail)`). The frontend `clientLogger` has the same trap — its 3rd arg is an ERROR slot; object payloads vanish silently. Interpolate values into the message string.

---

## 🔔 User Feedback Conventions (toast vs dialog)

- **`ui:error` → MpiErrorDialog** (GitHub-report dialog) — reserve for genuine reportable bugs, never expected transient states.
- **`ui:warning` / `ui:info` / `ui:success` → toast.**
- **No toast on user-initiated actions** (e.g. Stop) — user actions are self-evident; toasts are for NON-user events only.

---

## 🖱️ Context menus — three separated groups, and EVERY row explains itself

Any menu raised through `Events.emit('ui:context-menu', …)` is **three groups, separated,
coarse → fine → irreversible** (Fabio, 2026-09-19, MPI-821):

1. **make something NEW from the selection** — nothing here touches the cards
   (Compare, Combine, Make GIF, Cue all)
2. **edit THIS item's own data** (Rename, Card notes, Describe image)
3. **files and the system**, ending on the irreversible pair — **Archive directly above
   Delete**, Delete last (Add to project, Open in file system, Download, Archive, Delete)

**Every row carries `info`, and a DISABLED row carries its REASON, not its label.** This app
has no tooltips: `info` → `MpiButton`'s `data-info` → the status bar is the only place a row
can explain itself, and a greyed row with no reason is the case that actually hurts
("Select exactly 2 cards to compare", not "Compare").

`MpiContextMenu` already supports `{ separator: true }` and `info` — **do not rebuild
either**; until MPI-821 nothing in the repo used them, so there is no second precedent to
copy from. Reference implementation: `MpiGalleryGrid.js` card menu.
`MpiHistoryList` and `MpiMediaSlot` raise their own menus and are **not** converted yet —
bring one over when you are next in it, not as a drive-by.

---

## 🎛️ PromptBox controls — `scope` is the persistence SoT

Adding a `PROMPT_BOX_CONTROLS` control? Its `scope` (`shared` / `perOp` / `perModel`) is the **single source of truth** for persistence, sidecar snapshot, and Reuse — the machinery is `scope`-driven. **Never hand-maintain a persistence key-list** (`_MODEL_WIDE_KEYS`, the snapshot loop, the reuse loop) to make a control save or restore; if you feel the urge, the machinery regressed off `scope` — fix the machinery. Full contract + checklist: [`docs/playbooks/common/prompt-box-controls.md`](../../docs/playbooks/common/prompt-box-controls.md) (MPI-336).

---

## 🗄️ Persisted-config fields — the normalizer is a WHITELIST, on read AND write

Adding a field to `DEFAULT_RUNPOD_CONFIG` (or any config with a `normalize*` companion in [`js/core/storage.js`](../../js/core/storage.js)) is **TWO edits, not one**. `normalizeRunpodConfig` rebuilds the object field by field and runs on BOTH `getRunpodConfig` and `setRunpodConfig`, so a field present only in the defaults is **silently stripped on every save and every load** — no error, no warning. The feature appears to work in-session and forgets itself on the next boot. Same failure class as MPI-370's `requirementsDrop` vanishing through the `_createDepJob` whitelist (that field was deleted in MPI-413 — the trap is the whitelist, which is still there). Write the field into the normalizer too, and pin it with a test that fails when the normalizer line is removed (negative-control it — see [`tests/runpod-skip-local-engine.test.cjs`](../../tests/runpod-skip-local-engine.test.cjs), MPI-390).

Related: write through `state.<key>`, never `Storage.set*` directly, when the value is also mirrored in [`js/state.js`](../../js/state.js). State is seeded once at module load and write-throughs to Storage; a raw Storage write goes stale and the next state write clobbers it.

---

## 📦 Imports — depth and case sensitivity

Relative import depth varies by how deep a component sits under `js/`. Reference depths to reach `js/` root: `js/components/Compounds/<X>/file.js` → 3 ups; `js/components/Compounds/LandingPages/<X>/file.js` → 4 ups (extra `LandingPages/` segment). Wrong-depth import → boot JS halts → app stuck forever on the landing spinner; server log stays clean (error is browser-side). Case sensitivity (Linux-only): dev box is Windows (case-insensitive); Linux portables are case-sensitive. A relative import whose CASE doesn't match the on-disk filename resolves fine on Windows but 404s on Linux → same spinner failure. SWEEP before any portable/Linux release: walk the whole `js/` import graph and verify EXACT-CASE existence.

---

## 🧪 Tests — replay the shape production actually delivers

A test feeds the code YOUR model of the input. If that model is wrong, the test passes
against broken code and you ship the bug — the check is not evidence, it is a second
copy of your assumption.

- **Transcribe a real run, don't imagine one.** Pull the actual bytes/lines/events from
  `logs/app.log`, a captured payload, or the wire — then replay those. Guessed input
  shapes are where false greens come from.
- **App contradicts a passing test → suspect the TEST first.** Two live cases: MPI-315
  replayed `app.log` line-by-line while production passes multi-line CHUNKS (`.some()`
  kept all 126 lines); MPI-350's tile test called `tile()` once per tile while USDU
  emits **T+1** ticks, so the trailing tick swallowed the fix and the first cut shipped
  broken. Both suites were green.
- **Prove the test bites.** Run it against the UNFIXED code and watch it fail with the
  expected assertion. A test that passes both ways is only a guard against regression
  in the OTHER direction — fine to keep, but say which cases those are and never count
  them as proof the fix works.

## 🛰️ Pod runtime — publish to `dev`, reach `stable` only by `promote`

`wrapper.py` / `start.sh` are R2-floated, and RELEASED users' Pods boot the `stable`
channel on every start. So a runtime edit ships `./publish-runtime.sh dev` → test on a
dev Pod → `./publish-runtime.sh promote` (server-side copy of the tested bytes; refuses
on working-tree drift). `./publish-runtime.sh stable` publishes the working tree straight
to released users — deliberate, warned hotfix only, never the day-to-day verb. Same shape
for images: a dev build bumps `POD_IMAGE_VERSION_DEV`/`_CPU_DEV`, never the stable pins.
Both are gated on `BUILD_HASH === 'dev'`, so a shipped app cannot resolve either. (MPI-340;
full flow: `c:\AI\Mpi\mpi-ci\cubric-vision-pod\README.md` § "Runtime externalize".)

## 🔌 Consuming a route — call it once, don't infer its shape

A wrong response shape never throws. It destructures to `undefined`, defaults to empty,
and reads as **"nothing exists yet"** — so the code acts on that. `scripts/smoke-workflows.mjs`
did `const { volumes = [] } = await app('/runpod/volumes')` against a route that answers a
**bare array**: every run concluded the account had no volumes and created a new 350 GB
one. Three existed before it was caught (MPI-467, 2026-08-08), while the weights already
downloaded sat on a twin each later run ignored.

- **Hit the route once and look at the body** before writing code against it. One `curl`.
- **Before an action that SPENDS, CREATES or DELETES, make the code refuse to guess.**
  Several candidates match → don't take "the first that fits"; report them and demand an
  explicit id. An empty list right before a create is the moment to be suspicious.
- Same class, same session: the runner logged "installing on a CPU Pod" while never
  creating one, because `/comfy/models/download/start` was assumed to target the Pod. It
  branches on `isRemoteActive()` — unverified, that downloads ~300 GB to the local disk.
