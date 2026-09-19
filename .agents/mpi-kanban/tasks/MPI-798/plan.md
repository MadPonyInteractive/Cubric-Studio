# MPI-798 — Flow developer kit: publish the pin set, install against it, and tell a developer when their ComfyUI does not match

Umbrella: MPI-560 (phase 7). Split out of MPI-532 on 2026-09-17. Targets the day
Cubric Studio 2.0 ships. Card: [task.json](task.json).

## Current State

**2026-09-19: all FIVE steps are built and self-verified (`npm test` 1383/0, lint clean);
see [validation.md](validation.md). Steps 1-4 shipped as 37e7357c; step 5 (the extra-pack
warning) shipped as e6908dd6. Nothing is left to implement and nothing is left uncommitted —
the card closes on the evidence in validation.md as soon as its own CI run is green. Also know that decision 2 below (drop the static node-class allowlist) is a
deliberate scope reduction of the card as written, flagged to Fabio and not contradicted.**

Project mode: scalable-foundation.

Planning read the code rather than the card's summary, and four of the card's premises
moved. Verified 2026-09-19:

- **`dev_configs/node_lock.json` already IS the lockfile.** Schema `cubric/node-lock/v1`:
  core `tag` + `commit`, both frontend package versions, and **21** packs (the card says
  14), each with `repo`, `commit`, `filename` (the on-disk folder name) and
  `installRequirements`. Nothing needs generating.
- **`nodesDeps.js` consumes the lock, it does not own the pins.** It imports
  `node_lock.json` and derives every URL through `lockUrl(id)`
  (`js/data/modelConstants/nodesDeps.js:8-27`). The card's "generate the lockfile from
  nodesDeps.js" has the direction backwards.
- **The app already answers "does this installed pack match the pin".**
  `checkUniversalWorkflowDepsStatus()` (`routes/shared.js:1099`) compares a per-pack
  marker file `.mpi_node_commit` (`NODE_COMMIT_MARKER`, `routes/shared.js:1032`) against
  `getPinnedNodeCommit(depId)` (`routes/shared.js:1042`) and returns `driftedDeps`. A
  zip-extracted pack has no `.git`, so this marker is the only thing that can answer it —
  the developer installer must write the same marker.
- **The linter already checks node classes, and better than an allowlist would.**
  `scripts/lint-flow-package.mjs` hits a live ComfyUI `/object_info` at `COMFY_URL`. Its
  own header states the check "only means something against a ComfyUI whose node packs
  match the shipped engine" — and it has no way to tell the developer whether that holds.
  That blind spot, not a missing allowlist, is the real hole.
- **`mpi-bump-local-comfy` covers half the installer.** It bumps ComfyUI **core** on the
  `G:\ComfyUi` bench and syncs `extra_model_paths.yaml`. It never installs the node packs
  at their pins.
- **No publish path exists.** `scripts/build-portable.mjs` does not reference
  `node_lock.json`; nothing puts it in front of a developer at a release.
- `scripts/resolve-comfy-node.mjs` already maps a `class_type` back to the pack that
  ships it, via ComfyUI-Manager's `extension-node-map.json` (network, 24h cache).

### Decisions taken at planning (reversible — each names the section it changes)

1. **Do not build a lockfile generator.** Publish `node_lock.json` itself. → Step 1.
2. **Drop the static node-class allowlist** (card scope item 3). A list baked from the
   lock would go stale, and the lock pins repos, not class names — deriving classes needs
   a network round trip to ComfyUI-Manager's map. Replace it with a *match check*. → Step 3.
3. **Installer is Node + the zip URLs the app already uses**, not `git clone`. `lockUrl()`
   is written, the app proves the path, and a developer needs no git. → Step 2.
4. **The installer writes `.mpi_node_commit`**, so the app's own drift logic is the check.
   → Steps 2 and 3.

## Implementation

- [ ] **1. Publish the pin set.** Add `node_lock.json` to the release output alongside the
      portable artifacts, stamped with the app version it belongs to (a thin wrapper that
      copies the file and adds `appVersion` + `generatedAt`; the pins are copied verbatim,
      never re-derived). **Verify:** `npm run build:portable:dry-run` stages it, and the
      stamped copy's `nodes` block is byte-identical to `dev_configs/node_lock.json`.

- [ ] **2. `scripts/install-flow-devkit.mjs`** — run against a developer's own ComfyUI
      folder. Reads a published lock, and for each pack: downloads the pinned
      `archive/<commit>.zip` through the existing `lockUrl()`, extracts to
      `custom_nodes/<filename>`, writes `.mpi_node_commit`, and pip-installs
      `requirements.txt` when `installRequirements` is true. Warns (does not fail) on a
      core tag or frontend version mismatch, and defers the core bump to
      `/mpi-bump-local-comfy` rather than duplicating it. `--check` reports without
      writing. **Verify:** run `--check` against `G:\ComfyUi`, which
      `/mpi-bump-local-comfy` already keeps matched, and expect zero drift; then run it
      into a scratch ComfyUI folder and confirm every pack lands at its pinned commit with
      a marker.

- [ ] **3. Make the linter state whether the engine matches.** Before the `/object_info`
      pass, `scripts/lint-flow-package.mjs` reports pack drift for the ComfyUI it is
      pointed at, reusing the marker/pin comparison rather than a second implementation.
      A mismatch is a loud warning, not an error — the developer may be testing
      deliberately. **Verify:** a package that lints clean against a matched ComfyUI still
      lints clean and now says so; pointed at a ComfyUI with one pack rolled back, it
      names that pack.

- [ ] **4. Document it** in `docs/flow-packages.md`: where the published lock lives, the
      one command that matches a ComfyUI to it, and what the linter's match line means.
      **Verify:** `npm run lint` clean and the doc's commands run as written.

## Completed

- [x] **1. Publish the pin set — no change needed.** Both pin files already ship at every
      release tag of the public repo, and the tag IS the app version. The installer takes
      `--version <tag>` and fetches them from there; proved against `v1.5.0`.
- [x] **2. `scripts/install-flow-devkit.mjs`** — 21/21 packs installed into a scratch
      ComfyUI, markers match the lock, `--check` clean on re-run.
- [x] **3. Linter engine-match check** via `COMFY_PATH`, warns without failing. Both the
      matched and the drifted case proved.
- [x] **4. `docs/flow-packages.md`** — new "Match your ComfyUI to the release" section,
      `COMFY_PATH` documented, stale MPI-798 pointer replaced.
- [x] **5. The match check now names EXTRA packs too.** `findExtraPacks()` in
      `scripts/lint-flow-package.mjs`: one `readdirSync` of `custom_nodes` minus the lock's
      `filename`s, warning only. Documented in the same doc section.

Evidence, including the three bugs verification caught: [validation.md](validation.md).

## Remaining Work

- Nothing to implement. Commit step 5 and close through `mpi-end-session` on the evidence
  in [validation.md](validation.md).
- Reversal cost is still low if Fabio rejects decision 2: the allowlist would be a further
  step writing a class list into the published lock, built from `resolve-comfy-node.mjs`.

## Plan Drift

- 2026-09-19, close-out: pushing step 5 hit a RED master (`.husky/pre-push`), so this card
  paid for someone else's break — the rule is that a red master belongs to whoever meets it.
  `tests/desktop/agent-chat.spec.js:645` had been failing deterministically since f124f535.
  Root cause was NOT the pinned-settings-panel feature: `textShare` divides one FLEXING slot
  by the box while its siblings are fixed-width, so it measures the WINDOW WIDTH — 0.6865 on
  a 1280 dev box, 0.6081 on the runner's 1024, against a bar of 0.65 measured at 1280. That
  is why the number had gone red three times: every previous fix re-measured it and silently
  re-encoded the measuring box's width. Fixed in 188cdc78 by pinning the host to 1024 before
  measuring, so the runner's condition is the default. Proved both ways: with the pin and the
  old bar the spec fails locally at exactly 0.6081390380859375, the CI value to the last digit.
- 2026-09-19, step 5: the extra-pack count in the previous session's handoff was **15**;
  the shipped check reports **12** on the same bench, and 12 is right. The 15 counted
  `__pycache__` and the two `.disabled` folders, none of which is a pack — a parked pack
  loads nothing and contributes no classes. The filter also has to compare the lock's
  `filename` case-INSENSITIVELY: the bench carries `comfyui-krea2-controlnet` against the
  lock's `ComfyUI-Krea2-ControlNet`, and a case-sensitive difference would have reported
  correctly-installed packs as extras.
- 2026-09-19: planning found the card's scope items 1 and 3 rest on premises the code
  contradicts (the lockfile exists; the linter already checks classes live). Scope
  restated above rather than implemented as written. The card's `description` still
  carries the old framing and its "14 node packs" count — leave it; this plan is the
  current shape.
- 2026-09-19, during step 1: **the "publish" step turned out to need no code at all.** The
  tags already serve both pin files from the public repo, so a build change, a stamped
  copy and an `appVersion` field were all redundant — the tag is the version. Step 1
  became documentation plus the installer's `--version` flag.
  `scripts/build-portable.mjs` was therefore never touched and has been dropped from
  `files.json`.
- 2026-09-19, during step 2: the plan assumed the `.mpi_node_commit` marker was the way to
  tell a matched pack from a drifted one, because that is how the app does it. **False for
  a developer**, whose packs are git clones — the first `--check` against the MPI bench
  called all 21 correct packs drifted. Inspection now reads git first. This also changed
  the install path: a clone is moved with `fetch` + `checkout`, never deleted and
  replaced.
- 2026-09-19, during step 2: the plan said to pip-install each pack's `requirements.txt`
  when `installRequirements` is set. **Wrong on both halves** — the app installs ONE
  curated set (`python_deps.txt`, `--no-deps`, MPI-413), and that lock flag is the Pod
  image's bake/volume split, not a per-pack pip signal. Doing it as planned would have
  built an environment no user has.

## Verification

**Verify mode:** auto

No UI surface — four CLI/doc deliverables. Closing checks:

1. `node scripts/install-flow-devkit.mjs --check "G:\ComfyUi"` → zero drift against the
   bench that is already matched.
2. Same script into a scratch ComfyUI folder → all 21 packs at their pinned commits, each
   carrying `.mpi_node_commit`.
3. `node scripts/lint-flow-package.mjs` against a Cubric-Flows package, matched engine →
   clean, with the new match line; one pack rolled back → names that pack.
4. `npm test` and `npm run lint` clean.
5. `npm run build:portable:dry-run` stages the stamped lock.

## Preservation Notes

- The `.mpi_node_commit` marker is now load-bearing OUTSIDE the app. If a future change
  moves or renames it (`routes/shared.js:1032`), the devkit installer and the linter's
  match check break with it — note that at the constant.
- MPI-799's submission CI consumes step 2 and step 3; do not design them as one-offs.
- `docs/flow-packages.md` is MPI-532's doc. Step 4 extends it; it does not fork it.
- The 14-vs-21 pack count in the card description is stale. Worth a line in the card if
  this plan is approved as written.
