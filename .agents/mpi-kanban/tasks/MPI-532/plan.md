# MPI-532 — Flow packages: the `user_flows/` loader

Planned 2026-09-16. Umbrella: MPI-560 (phase 6). Ordered by MPI-780 (phase 1), which makes
this card block 2.0. Read with `tasks/MPI-780/brief.md` § "Requirements the package route
must meet".

## Goal

A Flow package (a folder: manifest + ComfyUI graph + preview images, no code) placed in
`user_flows/`, or dropped onto the Flow Library, appears in the Library, runs, and survives
an in-place app update. No registry file is edited to make it appear.

**Done when:** a package copied from a shipped Flow (Head Swap, so the injector path is
proven) loads from `user_flows/` on restart, installs by drop (folder AND `.zip`) without a
restart, runs a real generation with its boxes applied, and a broken package shows disabled
with its reason.

## Settled — do not re-litigate

- **Fabio, 2026-09-16:** Flows in `js/data/flowsRegistry.js` ship with the app and always
  show. A package Flow shows only once installed. Install = copy the folder into
  `user_flows/` and restart, OR drop the folder or its Gumroad `.zip` onto the Flow Library
  (live, no restart).
- From MPI-560 phase 6: the validator is developer experience, not security; never fork or
  vendor the node packs; third-party packages are **Flows**, never "flow plugins"; ids from
  `user_flows/` are namespaced `user:<id>`.
- From MPI-780: a package references only dep/model/plugin ids the app declares; the
  manifest can name an app-side injector; `user_flows/` survives updates.

## Facts this plan rests on (mapped 2026-09-16)

- **Where it lives.** `main.js:273-293` sets userData to `<portable root>/user-data` on every
  released build and exports it as `APP_USER_DATA` to the server fork (dev: default
  `%APPDATA%\Cubric Vision`). The updater copies files and PRESERVES `user-data/`
  (`scripts/build-portable.mjs:94-100`, `scripts/portable/apply-update.cjs:240-272`). So
  `<APP_USER_DATA>/user_flows/` survives updates as-is. **The 2.0 rename does not move it:**
  MPI-708 D3a leaves userData alone (only `Documents/` is renamed). Nothing to migrate.
- **Registries are mutable at runtime.** `FLOWS` (`flowsRegistry.js:424`), `COMMANDS`
  (=`commands`, `commandRegistry.js:1423`), `UNIVERSAL_WORKFLOWS`
  (`universal_workflows.js:21`), `PROGRESS_STAGES` (`progressStages.js`). Every FlowDef and
  every Flow op is plain JSON today (checked all 15). `operationRegistry.js` has no runtime
  effect; `operation_registry.json` + `release:check` only parse source text, so runtime ops
  are invisible to them (neither fail nor are checked).
- **Injectors are looked up by NAME** (`commandExecutor.js:1660`, `INJECTORS` in
  `js/services/workflowInjectors/index.js`: `resize`, `headSwap`, `ltxSigmas`), not by op
  key. `headSwap` already serves three ops. So a manifest op carries `injector: "headSwap"`
  and Head Swap keeps its boxes. No special-casing of `flowHeadSwap`/`flowDramaBox` exists
  anywhere outside the registries.
- **Every graph and preview is fetched by name under `/comfy_workflows/`**: graphs at
  `commandExecutor.js:955,1112,1618`, `comfyController.js:1357`, `llmService.js:544,558`;
  previews at `comfy_workflows/display/<name>` in `MpiTileSheet`, `MpiFlowLibrary:534`,
  `MpiBaseFlow:1832-1841`, `MpiInstalledDisplay`. `routes/workflowStatic.js` passes nested
  paths to `next()`. → **A server route answering `/comfy_workflows/user-flows/<id>/<file>`
  and `/comfy_workflows/display/user-flows/<id>/<file>` makes a package reachable with ZERO
  renderer call-site edits.** The loader sets `workflow: "user-flows/<id>/workflow.json"`
  and `preview: "user-flows/<id>/<file>"`.
- **Trap: a colon in a filename.** `getFilePrefix` (`commandRegistry.js:1748`) falls back to
  the op KEY, and `user:head-swap` is illegal in a Windows filename. The loader must set
  `filePrefix` (default: the Flow title, which `tests/flow-output-filename.test.cjs` already
  requires of every Flow).
- **The server has its own copy of `FLOWS`** (`routes/downloadManager.js:425`, the uninstall
  guard). A package's `requiredDeps` must feed that guard or uninstalling a model can strand
  an installed package. The connector gets its Flow list from the renderer, so agents see
  package Flows for free.
- **Unrecorded progress stages are fine**: `stagesFor` returns 0 = "tick without a total".
  (`PROGRESS_STAGES` is frozen and neither paid Flow has an entry, so packages get none.)
- `scripts/validate-injection-rules.mjs` is a CLI that needs a running ComfyUI
  (`/object_info`); it is not in `npm test` or `release:check`. Its graph checks (≥1
  `Output_*`, no duplicate `Input_`/`Output_` titles, every `Input_*` reaches an `Output_*`)
  need no engine and can be exported.
- `MpiFolderDrop` accepts model files only and posts to `/comfy/import-model`; it does not
  take folders as written. `extract-zip` is already a dependency (Electron 41,
  `webUtils.getPathForFile`).
- `uiComponent` is already gone (MPI-531 done), so "port the last uiComponent Flow" is done.

## Package format — `cubric/flow-package/v1`

```
user_flows/<id>/
  flow.json        the manifest
  workflow.json    ComfyUI API-format graph
  <images/video>   referenced by flow.json, package-relative, no subfolders
```

```jsonc
{
  "schema": "cubric/flow-package/v1",
  "id": "head-swap",                 // ^[a-z0-9][a-z0-9-]{1,40}$ -> registered as user:head-swap
  "version": "1.0.0",
  "author": "Mad Pony Interactive", "homepage": "https://...", "licence": "...",
  "compat": { "minAppVersion": "2.0.0" },
  "flow": { /* FlowDef minus id/operation/workflow; preview/video = package filenames */ },
  "op":   { /* the command entry: label, progressLabel, mediaType, mediaInputs,
               promptRequired, requiresImages, requiresVideo, injector, filePrefix */ }
}
```

The loader fills `flow.id = flow.operation = "user:<id>"`, `op.universal = true`,
`op.filePrefix ??= "flow" + PascalCase(flow.title)`, `UNIVERSAL_WORKFLOWS[key] = { workflow: "user-flows/<id>/workflow.json" }`.
**No markup** — `< > " \`` — in any manifest string or key (placeholders and
`injectionParams`/`modelParams` values excepted): see Plan Drift 2026-09-17, security.
Op fields are an allowlist taken from the fields built-in Flow ops use; anything else is a
validation error, not silently dropped.

## Phase 1: Server — scan, validate, serve

- `services/userFlows.js` (CJS, new): `userFlowsDir()` from `APP_USER_DATA`; `scanUserFlows()`
  → `[{ id, dir, manifest, errors[] }]`; `validatePackage(manifest, graph, known)` (pure).
- Validator checks, all engine-free, each error naming the fix: schema + id shape; FlowDef
  required fields; every `requiredModels`/`requiredDeps`/`requiredPlugins` id is declared by
  the app; `injector` is a key of `INJECTORS`; every `mediaInputs[].title` and every
  `Input_*` field id matches a node title in the graph (the silent-skip case); the exported
  `validate-injection-rules` graph checks; no absolute paths in string widget values;
  `compat.app` satisfied; referenced preview files exist in the package.
- `scripts/validate-injection-rules.mjs`: export its engine-free checks; CLI unchanged.
- `routes/userFlows.js` (new), mounted in `server.js` BEFORE `workflowStatic`:
  `GET /user-flows` (the scan); `GET /comfy_workflows/user-flows/:id/:file` and
  `GET /comfy_workflows/display/user-flows/:id/:file` (only files directly inside that
  package dir, id and filename re-validated, no traversal).
- `routes/downloadManager.js` `_flowRequiredDepIds`: include VALID packages' `requiredDeps`.
- **Verify:** `tests/user-flows.test.cjs` over synthetic fixtures in
  `tests/fixtures/user_flows/` (valid; unknown dep id; `Input_*` title with no node; absolute
  path; bad id; unknown injector; traversal request refused). `npm test` green.

## Phase 2: Renderer — register at boot, show broken packages

- `js/services/userFlowService.js` (new): `loadUserFlows()` fetches `/user-flows` and calls
  `registerUserFlow(entry)` per package: FlowDef into `FLOWS`, op into `COMMANDS`,
  `UNIVERSAL_WORKFLOWS`, `PROGRESS_STAGES`. An invalid package is still listed, carrying
  `disabledReason` (the first validator error). Called from `js/shell.js` boot before the
  Flow Library mounts.
- `flowAvailability` (`flowsRegistry.js:3069`): a `disabledReason` makes the Flow unavailable
  with that reason; `MpiFlowLibrary` shows the tile disabled with the reason named, and the
  run path refuses it. An unknown id reads "Needs <id>, which this version of Cubric Studio
  does not have" — the deprecation UX without waiting for MPI-533's ledger.
- **Verify:** unit test that a registered package resolves through `getFlowById`,
  `getCommand`, `getFilePrefix` (no colon), `getUniversalWorkflow`, `flowAvailability`;
  isolated app (`npm run app:isolated`) with a fixture package in its user-data shows the
  tile, and a broken one shows disabled with its reason.

## Phase 3: Install by drop

- `POST /user-flows/install { path, overwrite }`: a folder or a `.zip` (extracted into
  `user_flows/.staging/`); the manifest may sit at the root or inside one subfolder (how a
  zipped folder arrives); validate; `409` when the id exists; copy into staging, then rename
  into `user_flows/<id>/`, so a failed install never leaves half a package. Returns the entry.
- Flow Library drop target: generalise `MpiFolderDrop` if it takes an `accept` + handler
  cleanly, otherwise reuse the drop overlay pattern it copies — decide on reading both, never
  a third drop primitive. On success: `registerUserFlow`, the Library re-renders, toast. On
  409: confirm overwrite. On a validation error: show it.
- **Verify:** route test (folder, zip, zip-with-subfolder, conflict, invalid → nothing
  written). Then **Fabio** drops a folder and a zip on his build.

## Phase 4: Developer docs, linter, proof

- `docs/flow-packages.md` (≤200 lines): the format, every manifest field, the title law,
  allowed ids, injector names, install, the linter. Link from `docs/README.md` and
  `docs/playbooks/add-flow/README.md`.
- `scripts/lint-flow-package.mjs <dir>`: the same validator, plus the node-class check
  against a running ComfyUI when one answers.
- Proof: package Head Swap as `head-swap-test` into the isolated app's `user_flows/` (NOT
  committed — MPI's sellable Flows are authored outside the AGPL repo; MPI-781 does that):
  appears, boxes apply, real generation lands with a title-prefixed filename, Klein licence
  gate fires on a fresh model state.
- Update survival: a test asserting `user-data` is in the updater's PRESERVE set.

## Out of scope — needs Fabio

- **Generated node lockfile + dev installer → MPI-798** (split 2026-09-17, Fabio; MPI-560
  phase 7, ready at 2.0 release). The paid Flows do not need it.
- **GitHub registry → MPI-799** (created 2026-09-17, Fabio; MPI-560 phase 7, open at 2.0
  release). Library link tiles to Gumroad stay MPI-780 open question 1.
- MPI-533 tombstone ledger — phase 2's reason text covers "missing id" without it.

## Verification

**Verify mode:** auto (phases 1, 2, 4); user-ux (phase 3 — the drop feel).

- `npm test` green, including `tests/user-flows.test.cjs`.
- Isolated app only (`npm run app:isolated`), never `:3000`.
- A real generation from a package Flow is the only proof of phase 4.

## Current State

Phases 1-3 done; phase 3 **user-verified by Fabio 2026-09-17** (dropped the Stems test
package; tile appeared, drawer showed Open + Uninstall). Committed at handoff.

Scope split done (Fabio, 2026-09-17): lockfile + installer → MPI-798, GitHub registry →
MPI-799, both MPI-560 phase 7, ready/open at the 2.0 release.

**Refresh button DONE — user-verified by Fabio 2026-09-17** (evidence in validation.md). `loadUserFlows()` now prunes `user:` Flows whose folder is gone (new
`unregisterUserFlow`) — boot and Refresh share it; a failed scan prunes nothing. The Library's
Refresh sits in the filter bar's trailing slot (the Model Library's control), reloads, re-opens
or closes the drawer, re-renders, then re-syncs deps.

Next: Phase 4 (docs, linter, Head Swap proof run). `docs/flow-packages.md` should also name the
   Refresh button and point at MPI-798/799 as "coming at 2.0".

## Completed

- **Phase 1 (2026-09-17).** `services/injectionRules.js` (graph checks moved out of the
  script), `services/userFlows.js` (scan + validator), `routes/userFlows.js` (list + the two
  file routes), mounted in `server.js`; `routes/downloadManager.js` guard counts packages.
  `tests/user-flows.test.cjs` 10/10, `npm test` 1264 pass / 0 fail / 1 skip, CLI validator
  still passes two shipped graphs against the live engine.
- **Phase 2 (2026-09-17).** `js/services/userFlowService.js` (register / load, disabled stub
  for a broken package), `js/shell.js` (boot loads packages; both boot syncs await it),
  `flowAvailability` returns `reason`, `MpiFlowLibrary` Unavailable chip + reason drawer with
  no footer, `flowService` run guard names the reason, `MpiTileSheet.css` chip modifier.
  `tests/user-flows.test.cjs` 12/12; `tests/desktop/flow-packages.spec.js` + the four
  existing Flow Library specs 8/8; `npm run lint` clean; `npm test` 1266 pass / 0 fail.

## Plan Drift

- **2026-09-17 — `scripts/` does not ship** (`build-portable.mjs` excludes it), so the graph
  checks moved to `services/injectionRules.js`; the CLI imports them and keeps the
  engine-backed class check. The in-app validator has no class check.
- **2026-09-17 — folder name = id.** A package folder must be named after its manifest id
  (error says to rename it). The URL maps straight to a folder: no index, no duplicate ids.
- **2026-09-17 — `compat.minAppVersion`** (a floor), not a range string.
- **2026-09-17 — validating the 15 shipped Flows as packages** (now a test) found: three
  text-only ops have no `mediaInputs` (made optional); `Input_Denoise` is consumed by the
  `ltxSigmas` injector (injector-consumed keys need no node); `ltx-extend` switches graph
  `byModel` (packages carry ONE graph — not offered).
- **For MPI-781: shipped graphs bake Fabio's own absolute paths** into `MpiLoadImageFromPath`
  nodes (`flow_head_swap.json` nodes 79/81, `flow_ltx_extend.json` / `flow_ltx_foley.json`
  node 17: `C:\Users\Fabio\Documents\Cubric Vision\Projects\...`). Harmless in the app (the
  injector overwrites them) but the validator rejects them, and a sold package must not carry
  a username. Clear them when authoring the package.
- **2026-09-17 — SECURITY: manifest markup is code execution.** The renderer puts FlowDef
  strings into innerHTML and double-quoted attributes, and the main window runs
  `nodeIntegration: true, contextIsolation: false` (`main.js:428`). So "the validator is DX,
  not security" does not hold for manifest TEXT: the validator now rejects `< > " \`` in any
  manifest string or key, except `placeholder` (MpiInput escapes it) and values under
  `injectionParams`/`modelParams` (graph-bound; an enhance system prompt carries
  `<|im_start|>`). No single-quoted or unquoted attribute interpolation exists in `js/`
  (grepped). Errors never echo a markup key; folders with markup names are not listed; the
  renderer's disabled stub re-checks title/description/preview. The graph itself stays DX-only.
- **2026-09-17 — no `progressStages` in the manifest.** `PROGRESS_STAGES` is frozen and
  neither paid Flow has an entry; a package gets the untotalled bar.
- **2026-09-17 — two files added to ownership:** `js/services/flowService.js` (the run guard
  names a broken package's reason — reachable from the connector) and
  `js/components/Primitives/MpiTileSheet/MpiTileSheet.css` (the `--unavailable` chip). Also
  `tests/desktop/flow-packages.spec.js`, which replaced the plan's hand-driven isolated-app
  check: it boots a real app on a seeded profile, off `:3000`.
- **2026-09-17 — phase 3 shape.** `installPackage` in `services/userFlows.js` (staging under
  `user_flows/.staging/`, rename into place, old package restored if the final rename fails).
  `POST /user-flows/install` answers **200 with `status: installed|exists|invalid`** — a 409
  put "Failed to load resource" in the renderer console on an ordinary second drop. The drop
  target REUSES `MpiProjectDropOverlay` with two new optional props (`text`, `onDropPath`;
  typedef in `types.js`) — its name is now narrower than its use; a rename to a generic name
  is a later tidy, not this card. `MpiFolderDrop` was not used (model-file specific) and left
  ownership. The Library mounts its OWN `MpiOkCancel` for "Replace Flow" (the existing one is
  titled and labelled Uninstall). Drop listeners use a capture-phase `drop` reset, because the
  overlay stops the bubble.
- **For MPI-781: DramaBox's placeholder carries straight quotes** — allowed (placeholders are
  exempt), noted only because it is the case that shaped the exemption.
