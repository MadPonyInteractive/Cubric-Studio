# MPI-852 — the live price tag in the prompt box

**Umbrella:** MPI-849 phase 2. Needs MPI-850 (the module) and MPI-851 (the `provider` field).

**Verify mode:** `user-ux`.

## What Fabio asked for

A price in the prompt box when a paid model is selected, updating as the user adds images or
videos to the box. Copy: **"about $0.07"**, never `$0.0679` — the Gemini models emit a variable
number of text tokens worth about 2 %.

## Mount

A new `__col` immediately before `#bottom-right-slot` (`MpiPromptBox.js:122`). Copy
`#engine-toggle-slot` (`:121`) for the column + `hide` pattern and its `_showEngineToggle`
(`:2654-2660`) gate; copy `.mpi-prompt-box__badge-batch` (`:1704-1706`) for the inner text.
**Never mount inside `#bottom-right-slot`** — `_renderRunCluster` does `innerHTML = ''`.

## Recompute in `_refreshOpSlot`, not on events alone

`_refreshOpSlot()` (`:1924-1987`) is the single convergence point for every path that
reassigns model or operation, **and it destroys and rebuilds every control**, so Width and
Height can change with **no event at all**. An event-only price goes stale on every op switch.
Also hook `_emitMediaChange()` (`:446-488`) — every reference add, remove, reorder, role-swap
and prune routes through it.

Then the global events: `settings:shared:update` (ratio, duration, **batch**),
`settings:model:update` (quality tier, turbo), `ratio:*`, `state:changed` on
`s_selectedModelIdByType`, `models:checked`.

## The traps that decide whether this works

- **Grid tracks.** `MpiPromptBox.css:4` declares exactly 8; agent mode declares its own 5 at
  `:132-143`. A 9th column must join both or the bar reflows.
- **Edit ops have no pixel dimensions.** `modelShowsRatio` returns false when the op is in
  `model.imageSizedOps`, so the ratio control is not mounted and `injectionParams` carries no
  size. Klein's `kleinEdit` and `depth` do this — output inherits the source image's size.
  **`$0.00` on every edit op is the default failure mode, and it reads as "free".**
  *Recommendation (open decision 5): price from the staged reference's own dimensions; where
  even that is unknown, show a range, never a number.*
- **No steps control exists anywhere.** The formula's steps term has no live input; it comes
  from a ModelDef field, keyed off `resolveTurboControlId(model)` where a turbo toggle exists.
- **`settings:model:select` is Gallery-only** and `pb.on('model-change')` does not fire on a
  normal pick. Subscribe to `state:changed` / `el.setModel`.
- **The ~300 ms project-write debounce** means re-reading `state.currentProject` right after a
  `settings:*` emit gets the pre-edit value. Read `el.getRunPayload()` or the event payload.
- **`_activeControls` is closure-private** — the only door is `el.getRunPayload()`, which is
  the argument for the price line living *inside* `MpiPromptBox`.
- **Hide or zero when `state.engineOverride === 'local'`**, or the bar quotes money for a free
  local run.

## Verify

In the running app: the estimate appears only for a paid model; matches the measured figure in
`01d` for that configuration; moves when a reference is added or removed and when ratio, tier
or duration changes; **multiplies by the batch count** (a batch of 4 on Nano Banana Pro reads
about $0.54); survives an op switch; and disappears when Run-locally is on.
