# AUDIT follow-up: the findings PR #12 left open

## Current State

- **Where it stands (2026-10-27):** Phases 1a-1d, D1, D3 and D10's GIF card tail done and pushed.
  Next: the rest of **D10** piece by piece (scratch sweeps, ffmpeg plumbing, remote proxy, EXIF
  swap, lazy imports, `_fail`), one commit each, then P2/P14/P7/P12/P13. The route snapshot
  scripts are in this card's `research/` (`d3snap.cjs`, `d10snap.cjs`, diff with `d3diff.py`):
  `node research/d10snap.cjs <repo> <out.json>` before and after, then diff. In d10snap,
  `/gif/preview` must run before an update (`/gif/entry` update sweeps unreferenced frames).
- Backend route refactors are proven with a throwaway script that mounts the routers on a temp
  project, drives each route on real ffmpeg output and dumps sidecar + response
  (`research/d3snap.cjs`): normalise ids/dates/mtime busts, diff key-order-blind. `npm run lint` now ends with the
  type-check; a new file under `js/utils/` must start with `// @ts-check` and pass it.
- A behaviour-preserving frontend refactor is proven with a throwaway desktop spec that
  snapshots DOM + values + emitted events before and after (D1's lives in the session
  scratchpad, never committed); `tests/desktop/launch.js` runs on its own port, never :3000.
- `AUDIT.md` (repo root) is the investigation. Its **Status** section lists what PR #12
  (MadPonyInteractive/Cubric-Studio#12, merged 2026-10-26) already fixed: H1, H2, X3, B1, B5, D2,
  B2, D4, B3, D5, X1, X2. Every ID below has a detail section there; read it before the step.
- No extra investigation agents: the audit already gives locations, risk and a GPU-free check
  for each item. The audit was written by reading only, so re-check each location before editing
  (line numbers will have drifted).
- Project mode: see `.agents/mpi-kanban/project-profile.md`. Lint runs `--max-warnings=0`, and
  `mpi/no-raw-event-listener` + `mpi/no-raw-console` now fire on Windows.
- Fabio's call: done in ONE session, phase by phase, `/mpi-handoff` between phases when context
  gets high. That is why there is no `## Parallel Batch`: the steps run one after another here.
- Shared tree with live peers: claim each phase's files in `files.json` before editing; a file a
  peer holds is skipped and noted, never edited.

## Completed

- [x] Phase 1a (8c05c2c8e): B4 `js/utils/uninstallOutcome.js`, B6 History toasts via `ui:*` →
  StatusBar.notify, comfy-vanished-prompt queue assertion. H3 dropped (see Plan Drift).
- [x] D6 (90e79b465): `comfy_workflows/scripts/workflow_generation/graph_utils.py` used by 11
  handlers; all 24 workflows byte-identical (rebuilt in a throwaway worktree, `orchestrate.py --all`).
- [x] D8: `escapeHtml` (string.js), `basename` (file.js), `clamp`/`clampNumber`/`clampInt` (new
  math.js), `ORIENTATION_OPTIONS`/`ratioIcon`/`cropRatioOptions` (ratios.js), `formatClock`
  everywhere, one `hexToRgb` (colourKeyMask.js, `{r,g,b}|null`, required by gifFrames.js too).
  `tests/small-utils.test.cjs`; `docs/utils.md` lists them.
- [x] X4: 7 unused routes gone incl. the skill-listed ones (Fabio, 2026-10-26), skill docs updated,
  internal-only exports un-exported, dead functions deleted; icons seed/gallery + their stroke
  special case gone, `.claude/rules/dos_and_donts.md` line 40 edited with Fabio's OK.
- [x] T1: `npm run typecheck` (`tsconfig.typecheck.json`, typescript 6.0.3, `checkJs`/`strict` off,
  so only `// @ts-check` files are checked) runs inside `npm run lint`, so CI's unit job and the
  pre-push gate run it with no workflow edit. Marked: all `js/utils/*.js`, `commandRegistry.js`,
  `resolveModelDeps.js`. Widen by adding the pragma to more files.
- [x] T2: JSDoc on `promptReuse.js`, `projectService.js`, `routes/shared.js`.
- [x] D1: `_controlHost` + `_mountSlider` in `PromptBoxControls.js` (-262 lines); 198-case desktop
  snapshot identical before/after.
- [x] D3: `services/outputCard.js` — `outputSidecar`, `writeVideoCard` (5 video routes),
  `writeImageCard` (sheet + 4 projects.js still routes), `writeImageRenditions` moved there.
  12-case route snapshot identical bar the sheet's new `flowId`/`flowInputs: null`.
- [x] D10 GIF: `writeGifCard`/`writeGifThumb` (outputCard.js), `gifEntryFrom` (gifFrames.js);
  gif.js, gifMake, gifMaker, gifCutout, gifTransform. 9-case route snapshot identical.

## Remaining Work

## Phase 1a: small fixes (auto)

- [ ] **B4** Flow Library uninstall toast gets the MPI-1076 guard `MpiModelManager` has (no
  "uninstalled" when files were kept). **Verify:** a unit test on the counting function fails
  before, passes after.
- [ ] **B6** History toasts are destroyed like `StatusBar.notify`'s. **Verify:** read both
  paths; desktop spec or unit test proves `destroy()` runs after hide.
- [ ] **H3** `build:portable:*` scripts lose the `D:\tmp` stage dir (default inside
  `build-portable.mjs`). **Verify:** `npm run build:portable:dry-run` exits 0.
- [ ] **Missing assertions** from #12: agent-loop `generateCalledAt`/`turnReturnedAt`,
  comfy-vanished-prompt `queueCallCount`, thumb-strip `selBefore`. Add the assertion each counter
  was for, or note why none is needed. **Verify:** the three tests pass.

## Phase 1b: shared small utilities (auto)

- [ ] **D8** `escapeHtml` (string.js), `basename` (file.js), `clamp`/`clampInt` (new
  `utils/math.js`), `ORIENTATION_OPTIONS`/ratio options (ratios.js), `formatClock` everywhere,
  one `hexToRgb`. The two weaker `escapeHtml` copies (`MpiInput`, `MpiVoicePicker`) start
  escaping `'`. **Verify:** unit tests for each new helper; lint; `npm test` failing names
  unchanged.
- [ ] **D6** `graph_utils.py` beside `registry.py`; the 10 `_find_id_by_title` copies, 5
  `_prune_to_capture(s)`, 3 bake helpers use it. **Verify:** re-run `orchestrate.py`, zero byte
  diff under `comfy_workflows/` against HEAD.

## Phase 1c: dead routes and exports (auto, one question)

- [ ] **X4** un-export the internal-only exports (keep the functions), drop unused icons and the
  `seed`/`gallery` stroke special case (update `dos_and_donts.md` with permission), remove
  `/project-templates/:id`. **Ask Fabio first** about the routes the skill docs list
  (`/system/list-components`, `/logs/download`, `upload-raw`, `probe-videos`,
  `/project-data/:id/upload`, `GET /project-media/:id`). **Verify:** lint, `npm test`, grep shows
  no caller of anything removed.

## Phase 1d: types and docs (auto)

- [ ] **T1** `// @ts-check` on the pure modules listed in the audit + a scoped
  `tsc --noEmit` step in CI. **Verify:** the step passes locally and in CI.
- [ ] **T2** JSDoc on the listed central exports (`promptReuse.js`, `projectService.js`,
  `routes/shared.js` incl. the MPI-444 realpath and MPI-484 stop contracts). **Verify:** lint;
  T1 check covers the files it can.

## Phase 2: bigger de-duplication and CPU-side speed (auto)

- [ ] **D1** PromptBox slider ×17. **D3/D10** route by route, one commit each.
  **P2, P14, P7, P12, P13.** **Verify:** per item, the audit's GPU-free check.

## Phase 3: needs the desktop suite or Fabio watching (user-ux)

- [ ] **P1, P3, D7, D9.** **Verify:** desktop suite green; Fabio's eye on anything visible.

## Phase 4: needs a local profile or a Pod (user-ux)

- [ ] **P4–P6, P9–P11.** Measure before and after on this machine / a Pod. **Verify:** measured
  win recorded in `validation.md`, behaviour unchanged.

Not planned (audit marks them low value): D11, X5, T3, P8, P-misc. Pick up only if a phase
touches the same code.

## Plan Drift

- D1: only 7 of the audit's 17 copies are sliders (duration, motionIntensity, denoise,
  stylization, controlStrength, audioLength, the `_ttsKnob` pair); the other 10 share just the
  label row. So two helpers (`_controlHost`, `_mountSlider`) instead of one `_sliderControl`
  factory: each slider keeps its own initial-value and `getInjectionParams` logic, which differ.
  Noticed, not changed: duration, motionIntensity and controlStrength have no `destroy()`, and
  stylization's does not destroy its bar (the factory `destroy()` also removes the element).
- T1: no `tests.yml` step. The check is chained into `npm run lint`, which CI and the pre-push
  gate already run; a separate CI step would have let a red reach master past the local gate.
  TypeScript 6 defaults `strict` on (5,000+ implicit-any errors); the config turns it off.
- T1 found two JSDoc blocks detached from their function (llmService `describeImage`,
  commandRegistry `getAvailableCommands`): moved back.

- D3: the audit's "~15 routes" are 10 (5 video, 5 still); the GIF card routes are D10's. Noticed,
  not changed: `/project/crop-media` writes no gallery renditions (every other still route does),
  so a big crop decodes full-res in the grid; `writeImageCard({ renditions: false })` keeps it.
- D10 GIF: the frame-hash 400 checks stay in the routes (a 400 before any work; `buildGif`'s own
  check would be a 500). Two small fixes fell out: a failed GIF thumb now leaves `thumbPath`
  unset instead of naming a missing file (MPI-627), and `/gif/crop`+`/gif/resize` now remove a
  half-built `.gif` when the build throws (their outputPath was only known after success).

- H3 dropped: `build:portable:*` point at `D:\tmp` on purpose (Fabio's PC, C: short on space;
  CI passes its own `--stage-dir`).
- Of the three #12 test counters only comfy-vanished-prompt had lost a check; agent-loop and
  thumb-strip counters were never used.
- `tests/toast-truth.test.cjs` source-reads the MPI-1076 `gone` rule; it now reads
  `uninstallOutcome.js`.
- D8: also did 3 basename copies the audit missed (entryInfo, MpiPromptBox, MpiEngineInstall) and
  the phone gallery chip's 0:60 bug; skipped `js/phone/phoneMedia.js` (MPI-1300 still open).
  `hexToRgb` changed shape (array -> object|null); its only array caller, `colourKeyMaskUrl`, converts.
- X4: `GET /project-media/:id` was registered before `GET /project-media/temp` and swallowed it;
  removing it routes `projectReconciler._listMediaFiles` to the temp handler (same name/type/path).
  Icons seed/gallery wait on Fabio (their stroke rule is in `.claude/rules/dos_and_donts.md`).
- Commits go through a private-index script (HEAD + this card's files + only MPI-1302 lines of
  `board.json` / root `events.jsonl`): peers leave uncommitted board edits in the tree. Compare
  event lines with `\r` stripped, or committed lines get re-appended (happened once, fixed
  before push).

## Verification

**Verify mode:** auto (phases 1–2); user-ux for phases 3 and 4.

Each phase ends with `npm run lint` green and `npm test` failing names unchanged, committed by
pathspec and pushed. The card closes when every phase is done or explicitly dropped by Fabio,
and `AUDIT.md`'s Status section says so.

## Preservation Notes

- Update `AUDIT.md`'s Status section at the end of every phase (what is done, what moved).
- `docs/utils.md` gains each new shared helper from D8.
- When the card closes, `AUDIT.md` itself can go (Fabio's call); durable facts move to docs.
