# MPI-1191 Flow machinery (2026-10-24, read-only research agent)

- Media slots: `inputSchema.media` `{type, mode:'upto', max, roles}` read by `_getMediaGroups`
  (MpiBaseFlow.js:126); `items` sparse by slot, one write point `_setSlot` (:953); X clears, never
  splices (:859). Picker = one pick per open (MpiMediaPicker.js:676). **`onPick` keeps only `{filePath}`
  (MpiBaseFlow.js:996): no card id, no notes.** No drag from the gallery into a Flow slot (drop reads only
  `dataTransfer.files`, :924). No reorder anywhere. No shipped Flow has > 2 slots.
- Stacks hidden from the picker twice: members by `_inScope` (galleryFilter.js:52-56), the stack by its
  empty history (MpiMediaPicker.js:197-201). Smallest change: keep stacks in `_entries`, `onPick`
  returns the group, a group flag `acceptsStack:true` expands via `expandStacks` (stackModel.js:118)
  and fills slots in order; other Flows still refuse stacks.
- Notes: `item.notes` on the history item after load; store `itemId`/`groupId` in the slot. No code
  puts notes into a prompt today.
- Enhancer in a Flow: button `{action:'enhance', from, to}` (Character Sheet flowsRegistry.js:1503-1540)
  -> `_runEnhance` (MpiBaseFlow.js:1371) -> `runEnhanceDecl` (flowEnhance.js:276) -> `enhanceFlow`
  (llmService.js:797), Qwen3-VL graph recipe, overridable by `injectionParams.Input_System_Prompt`
  (static: cannot follow the model pick). `from` can be an array; a `hidden:true` `Input_Beats` field
  filled from notes is the only context path. Flow enhance never reads `js/data/recipes`; a model-keyed
  prompt needs `selectSystemPrompt(...)` in `_runEnhance` + a new keyframe mode in `RECIPE_MODES`
  (registry.js:49). **Recipe conflicts:** ltx-2.5 bans timestamps (ltx-2.5.recipe.js:72,:141,:206) and
  its i2v takes start/end only; H3's `timeline` `[Shot N] At MM:SS` means CUTS. New mode in both via
  `/create-enhancer-recipe`.
- Two models: `requiredModels:[{models:[...]}]` + `UNIVERSAL_WORKFLOWS.<op>.byModel`
  (flowsRegistry.js:582, universal_workflows.js:89-108), `hiddenWhen:{model}`.
- **No Flow dev gate exists** (`FLOWS` returned whole by `listFlows`, flowsRegistry.js:539/:2963; only
  models/plugins filter `devOnly`, models.js:2791, pluginsRegistry.js:174). Trap: `flowModelIds` falls back
  to `models[0]`, so `ltx-25` first = a model a release cannot install. Gate: filter slot candidates
  against `MODELS` in `flowModelSlots` (:3080), or a `devOnly` filter on `FLOWS`.
- Injector (`workflowInjectors/`, commandExecutor.js:2120-2147) sees workflow + `injectionParams`, not
  `mediaItems`: can write evenly spaced `frame_idx` and prune unused guides given N + length.
- Traps: empty `Input_Image_N` loaders with `block_if_empty` silently block a guide chain (fork on
  `loaded` or prune); `findMissingMediaSlot` is per TYPE; Enhance never overwrites typed text.
