# MPI-734 Phase 1 — what "installed" can mean for PiD

Research only, no code. Read 2026-09-12 against the working tree. Line refs marked **†** come
from two read-only code sweeps and were not re-read by hand; everything else was.

## TL;DR

- **Option (b) as MPI-507 designs it strands 5.23GB for good.** A plugin's deps are protected
  while the plugin is *defined*, not while it is *installed*. With `pid-gemma` in four plugins,
  no uninstall ever releases it (§5).
- **Option (a) cannot be said about a flat model.** "Installed while any path is present" only
  exists as operation groups, so (a) means undoing MPI-453's flatten for PiD, renaming its op,
  and rebuilding a per-op uninstall UI (§4).
- **A third shape (c) needs no change to any install predicate or protection rule.** The model
  owns the shared base, and each plugin owns only its own path (§6). That is LAW 1's "both" row,
  already shipped by the `head-swap` Flow. After one path is removed, the Library tile still
  reads **Installed**.
- **Every shape hits one constraint.** Today's single `pid` graph cannot run once *any* path
  file is missing, even the path you picked (§3).
- **Recommendation: (c).** Fabio decides, along with two sub-questions (§8).

## 1. How install status is derived today

- **`nvidia-pid` is a FLAT model.** No `operations`, `engines` or `variants`.
  `supportedOps: ['pid']`, `deprecated: true`, and 11 deps: four `pid-*` transformers, four VAEs,
  `pid-gemma`, and two node packs (`js/data/modelConstants/models.js:899-928`).
- **Server flag.**
  - Local: `_localModelsCheck` (`routes/comfy.js:944-975`). `installed` means every dep is
    present. `allPresent` starts `true` (:952), so an EMPTY list reads installed.
  - Remote: `routes/remoteModels.js:346` uses `deps.length > 0 && every` (MPI-328), so an empty
    list reads NOT installed. The two engines disagree on a zero-dep model.
- **`syncModelInstalled`** (`js/data/modelRegistry.js:121`) copies that flag onto
  `model.installed` and caches per-dep status (:220).
- **`isModelUsable`** (`modelRegistry.js:486`). A flat model with no engine or variant deps
  returns `model.installed !== false` and never calls `deriveInstalledOps`. Pickers and the
  landing hero count go through it.
- **`deriveInstalledOps`** (`resolveModelDeps.js:503-534`).
  - Flat: all `supportedOps` when every common dep is complete, otherwise none.
  - Op-keyed: each op whose deps are complete. `fullyInstalled` means at least one op is
    installed.
- **`installedOpsForContext`** (`modelRegistry.js:560`) returns `null` when the model has no
  `operations`. For PiD the op strip therefore shows the static `supportedOps`.
- **`firstInstalledOp`** (:582) reduces to `isModelUsable` for a flat model.
- **The `commandExecutor` hard net** only fires when `model.operations[op]` exists
  (`js/services/commandExecutor.js:1416-1418`). **It never fires for PiD.**
- **Library tile.**
  - `_installedOpsOf` → `_modelState.anyInstalled` → `_tileState` (`MpiModelManager.js:321-334,
    663, 680`†).
  - The partial chip comes from `_computePartial` (:586-625†). It drops node packs and deps
    another installed model owns (`_sharedOwnedDepIds` :570-581†), and needs ≥1GB.
  - The deprecated flag is static (:758-760†).
- **Plugins.**
  - `pluginAvailability` (`js/data/pluginsRegistry.js:189-205`) reads installed when the
    plugin's own deps are on disk AND its `requiredModels` are in `s_installedModelIds`.
  - `upscalePluginsFor(kind)` lists installed plugins only.
  - The Library row offers **Uninstall only when the plugin reads installed AND owns deps**
    (`MpiModelManager.js:1282-1291`).

## 2. Uninstall and GC today

- **Model uninstall** sends the whole universe (`_confirmWholeUninstall`, `MpiModelManager.js:
  459-469`†). The route narrows it with `_filterDepsForEngine` (`routes/downloadManager.js:
  146-154`†).
- **Guard `_localSharedDepsMap(exclude)`** (`downloadManager.js:187-280`). Its remote twin
  `_remoteSharedDepIds` (:456-525†) applies the same rules.
  - It considers every other model with a non-empty universe.
  - Install evidence is that model's EXCLUSIVE deps, or any dep when it has none.
  - It protects `resolveDeps(model, installedOps.length ? installedOps : null)`.
  - It also unions in-flight deps, flow deps, and `_pluginRequiredDepIds(exclude)`.
- **`_pluginRequiredDepIds(excludeUninstallId)`** (`downloadManager.js:388-396`).
  - Covers every plugin DEFINITION's `requiredDeps`, except the plugin whose key is being
    uninstalled.
  - Definition-based, never presence-based. That is deliberate: presence-gating is MPI-310
    (`docs/plugins.md` LAW 1).
- **Orphan sweep.** `_orphanedDepIds` (:302-315†) runs against `_localSharedDepsMap(null)`, so a
  plugin dep can never be an orphan while its PluginDef exists.
- **The two circularities.**
  - MPI-310: protection gated on presence deleted Krea2's shared encoder.
  - MPI-258 B1: a shared file counted as its own evidence and stranded ~19GB.
  - The plugin form of B1 is MPI-579, where the LTX upscaler pinned LTX weights
    (`docs/plugins.md`).
- **Who else owns PiD's deps** (`models.js`):
  - `vae-flux-ae` → chroma-flash :526, chroma-hyper :603, boogu-edit-high :1231,
    boogu-edit-balanced :1263.
  - `vae-qwen-image` → krea2 :737, krea2-nsfw :863, qwen-edit :1809.
  - `vae-sdxl`, `vae-sd3`, `pid-gemma` and the `pid-*` transformers → PiD only.
  - No Flow references PiD (`js/data/flowsRegistry.js`, grep).

## 3. The constraint on every shape — one graph, four loaders

- **Today's `pid` op runs one graph.** `comfy_workflows/nvidia_pid.json` has four UNETLoaders
  (nodes 1573 flux1, 1592 sd3, 1598 qwenimage, 1604 sdxl) feeding the `MpiAnySwitch` titled
  `Input_Type` (node 1607). The `pidVariant` radio picks the branch and
  always lists all four (`PromptBoxControls.js:882-933`†).
- **ComfyUI validates every linked input before it runs.**
  - `validate_inputs` recurses into each link with no laziness check (`execution.py:955`).
  - A combo value that is not in the list fails `value_not_in_list` (:1070).
  - `check_lazy_status` only applies at execution time (:504).
  - Read on the G:\ComfyUi bench at 0.34.2; the shipped pin is v0.34.0.
  - A loader's options are its folder listing, so a missing file is exactly "not in list".
- **So once any one path file is absent, every `pid` run fails, including the path you picked.**
  - This cannot happen today, because a flat PiD disappears unless all 11 deps are present.
  - Any shape that lets a path be removed must give each path its own graph. The plugins get
    one op each anyway.
  - The PromptBox `pid` op then has to be split or retired (Q2).

## 4. Option (a) — PiD counts as installed while ANY path is present

**What it takes.**
- A flat model cannot express "any". Operation groups can: `hasOperationGroups`, the op branch
  of `deriveInstalledOps`, the op path in `isModelUsable`, and the hard net.
- Shape: `commonDeps: [pid-gemma, nodes]`, `operations: { <path op>: { deps: [pid-X, vae-X] } }`
  ×4, and `supportedOps` = the four path ops. `selectableOps` needs every op in both lists
  (`resolveModelDeps.js:371-376`).

**What changes.**
- **Op keys.** `pid` becomes four ops across `commandRegistry.js`, `operationRegistry.js` and
  `operation_registry.json`.
  - Existing sidecars name `pid`. `isOperationInstalled` requires the op to be in `supportedOps`
    (`modelRegistry.js:537`), so every PiD history item and Reuse becomes a dead op unless it is
    mapped. That is MPI-453's dead-op case.
- **Plugin availability.** It is model-level (`requiredModels` → `s_installedModelIds`), so all
  four dropdown entries would appear and disappear together. It needs a new op-aware field.
- **Per-path uninstall.** No UI exists for it. `_applyUpdate` is arch-only ("no per-operation
  install groups any more", `MpiModelManager.js:488-496`), and a plugin row with no own deps
  gets no Uninstall (:1291).

**Half-removed PiD (sd3 gone).**
- Tile reads Installed, because at least one op is installed.
- Op strip hides the sd3 op.
- The hard net now covers PiD.

**GC.**
- Works with the existing guard. `pid-gemma` survives until the model is uninstalled.
- After the last path goes, `pid-gemma` stays on disk. It is reclaimable only through the tile's
  "Remove files" (MPI-655, :1034†), so it is not stranded.
- **Op-level cousin of MPI-310.** If a path's VAE goes missing (failed download, hand-deleted),
  that op drops out of `installedOps`. Its 2.54GB transformer then leaves `protectedDeps`
  (`downloadManager.js:250`), and the next sweep deletes it. Bounded, but real.

**Cost:** the largest surface of the three, and it reverses MPI-453's "one install unit" for
one model (`docs/generation-lifecycle.md` § UNINSTALLED op).

## 5. Option (b) — the ModelDef owns no path weights (MPI-507's design)

MPI-507 gives each plugin `requiredDeps: [pid-X, vae-X, pid-gemma, …]`
(`tasks/MPI-507/brief.md:59-66`).

- **The encoder strands, permanently.**
  - On each plugin's own uninstall, `pid-gemma` is kept because three OTHER definitions still
    list it (`downloadManager.js:391-393`). That includes the last one.
  - After the last path goes, every row reads not installed, so no Uninstall button renders
    (`MpiModelManager.js:1282`). The orphan sweep cannot take it (§2).
  - **5.23GB, forever, on both engines** (on a Pod that is a billed volume). This is MPI-258 B1.
  - The brief's *"survives while any PiD plugin is installed"* is false. It survives while any
    PiD plugin is DEFINED.
- **Shared VAEs are pinned too.**
  - A flux plugin listing `vae-flux-ae` keeps it on disk for every Chroma/Boogu user forever,
    even one who never installs PiD. Same for `vae-qwen-image` against Krea2 and Qwen-Edit.
  - That breaks LAW 1: a model's weight must be required through `requiredModels`.
- **A weightless ModelDef has no precedent.**
  - All 21 models own at least one weight today.
  - One with only node packs reads **Installed** as soon as the packs exist (`[].every`;
    `comfy.js:952`). Node packs install with the engine.
  - So the tile, the hero count and the pickers would all show a PiD with zero paths.
  - `_install` returns on an empty list (`MpiModelManager.js:445`), so its Install button
    does nothing.
  - Local and remote disagree on an empty dep list (§1).
- **No tile installs several plugins.** A bundle means new code in `_install`,
  `_confirmWholeUninstall`, the detail footer, `anyInstalled`/`_tileState`/`renderList`,
  `_computePartial`, `_listSignature`/`_patchTile`, the trade table, and the
  `isModelUsable` / `syncModelInstalled` filter†.
- **Fixing the strand changes `_pluginRequiredDepIds` on both engines**, a shared primitive.
  - "Protect while present" IS MPI-310.
  - Per-plugin exclusive evidence works for PiD but not for the describer, whose only dep is
    shared. That means two protection rules.
  - This is a refactor to brief, not a patch (CLAUDE.md rule 4).
- **Half-removed PiD, even with the strand fixed:**
  - The tile needs an aggregate that does not exist yet.
  - The dropdown lists three paths.
  - A `pid` op on a model that reads installed trivially would offer a graph that fails
    validation (§3).

**Cost:** the highest risk of the three. The plan's recommendation assumed a weightless
ModelDef was cheap. It is not.

## 6. Option (c) — the model owns the shared base, each plugin owns its path

**Shape.**
- `nvidia-pid` stays flat and one install unit. Its `dependencies` become the shared base:
  `pid-gemma` 5.23 + `vae-flux-ae` 0.34 + `vae-qwen-image` 0.25 + both node packs.
  - `vae-sdxl` 0.33 and `vae-sd3` 0.17 belong to PiD alone, so they can sit in either the base
    or their own plugin. GC is safe both ways, because one plugin lists each.
  - The two shared VAEs MUST stay in the base, or Chroma/Krea2's copies get pinned (§5).
- **Four plugins**, each with `requiredModels: ['nvidia-pid']`, `requiredDeps: ['pid-<path>']`
  (2.54GB, plus its exclusive VAE if moved), `upscale.kinds: ['image']`, and its own op with a
  one-loader graph. This is LAW 1's "both" row, already shipped by the `head-swap` Flow.
- **Size.** SDXL path alone ≈ 8.7GB, against MPI-507's 8.1GB. The ~0.6GB difference is the price
  of not pinning Chroma's and Krea2's VAEs. Everything installed: 16.48GB, unchanged.

**What stays untouched:** `deriveInstalledOps`, `isModelUsable`, both server checks,
`_pluginRequiredDepIds`, the orphan sweep, MPI-453's one install unit, and no weightless model.

**Half-removed PiD (sd3 uninstalled from its plugin row).**
- **Library tile: Installed.** The model's own deps are all present, and removing a path does
  not touch them.
- **sd3 plugin row:** `Install (2.5GB)`, because `pluginAvailability` reports `pid-sd3` missing.
  The other three read Installed.
- **Upscale dropdown:** flux, sdxl and qwen (`upscalePluginsFor('image')`).
- **Dispatch gate:** `_handleApply` re-checks `pluginAvailability` before a plugin op runs
  (`MpiGroupHistoryBlock.js:623-639`†). The plugin op carries no model id, so the hard net does
  not apply.

**GC.**
- **Remove one path:** `uninstall('plugin:pid-sd3', [pid-sd3])`. The exclusion releases it
  (:392), no model lists it, and it is deleted.
- **Remove all four:** the base stays and the tile still reads Installed. That is honest, because
  the base is still on disk. Uninstalling PiD from the Library reclaims it, keeping any VAE that
  Chroma or Krea2 still needs.
- **Uninstall the model while paths are installed — the one hole.**
  - Each `pid-X` stays pinned by the definitions.
  - The rows then read not installed (the model is missing), so no Uninstall button appears.
    2.54GB each is stranded.
  - Two ways to close it inside this card (Q3):
    - uninstalling the model also uninstalls the plugins that require it; or
    - the row's Uninstall gate becomes "own deps on disk" instead of "installed"
      (`MpiModelManager.js:1282`). That also closes the latent gap for any future "both"-shaped
      plugin.
- **MPI-310:** no new protection edge. Plugin protection is unchanged; the model's evidence is
  its exclusive `pid-gemma`, the same fallback every model uses.

**Install bundle** (Fabio: installing PiD installs all four).
- Today the model tile starts only its own deps.
- New: the tile's Install also starts the jobs for PiD's plugins. A plugin row already does the
  reverse, since `_installPlugin` installs missing models.
- It needs an explicit list, not "every plugin requiring the model". Otherwise installing LTX
  Balanced would also start the LTX upscaler.
- No aggregate install STATE is needed, only the action and the size.

## 7. Side by side

| | (a) op groups | (b) weightless bundle | (c) base + path plugins |
|---|---|---|---|
| Tile after one path removed | Installed | undefined today; a nodes-only def reads Installed trivially | **Installed** |
| Predicate / shared-primitive change | op keys, op-aware plugin availability, per-op uninstall UI | `_pluginRequiredDepIds` (both engines), bundle aggregate | **none** |
| MPI-453 one install unit | reversed for PiD | kept, via a weightless model | **kept** |
| Stranded weights | none (encoder via Remove files) | 5.23GB encoder, plus shared VAEs pinned for other models | `pid-X` if the model is uninstalled first; closable (Q3) |
| MPI-310 exposure | op-level cousin | none as designed; a presence "fix" IS MPI-310 | **none** |
| PiD history / Reuse | breaks unless `pid` is mapped | depends on Q2 | depends on Q2 |

## 8. Recommendation and the questions for Fabio

**Recommend (c).** The plan picked (b) *"if the ModelDef mechanism can carry a weightless model
without a significant change"*. It cannot (§5), and (b) as designed loses the encoder for good.

- **Q1.** (a), (b) or (c)?
- **Q2.** The PromptBox `pid` op, i.e. PiD in the model picker. Keep it, and give it per-path
  graphs plus a radio that lists only installed paths? Or retire it, so PiD runs from the
  Upscale dropdown and its Library card is the install surface? MPI-553's 2026-08-09 rule was
  *"a weight that only upscales has no business in the model picker"*. The 2026-09-12 decision
  kept the card but said nothing about the picker. Whichever way: sidecars naming `pid` need a
  home, or PiD's past cards cannot be reused.
- **Q3** (only for c). When PiD is uninstalled from the Library with paths still installed,
  remove the paths with it, or leave them and let their rows offer Uninstall?

## Existing gaps Phase 4 inherits (any shape)

- **Upscale dropdown fallback.** A persisted plugin value that is no longer installed falls back
  to the first upscale-model FILE, not None, and overwrites the saved choice
  (`MpiToolOptionsUpscale.js:174-189`).
  - An open panel does not refresh on uninstall. Run then hits the `_handleApply` toast.
- **Stale comment.** `pluginsRegistry.js:17` says `pluginRequiredDepIds()` has "two call sites in
  routes/downloadManager.js". The backend calls its own `_pluginRequiredDepIds(exclude)` (:388),
  and the renderer function is used only by `tests/plugin-dep-gc.test.cjs`†.
- **False claim in two places.** This plan's "What PiD is made of" paragraph and
  `tasks/MPI-507/brief.md:64-66` both say the encoder survives "while any PiD plugin remains
  installed". False, see §5.
