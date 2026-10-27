# Cleanup & optimisation audit

**Date:** 2026-10-26 · **Scope:** `js/`, `routes/`, `services/`, `main*.js`, `server.js`, `scripts/`,
`comfy_workflows/scripts/`, `package.json`, `eslint.config.js`, `styles/01_base.css`.
**Out of scope:** `node_modules/`, `docs/`, `.agents/` (except one repo-hygiene note), the
ComfyUI workflow JSON, the Pod runtime (`wrapper.py`).

**No files other than this one were edited.**

## Status (updated 2026-10-26, after PR #12)

**Done in MadPonyInteractive/Cubric-Studio#12:** H1, H2, X3, B1, B5, D2, B2, D4, B3, D5, X1, X2.
That PR also fixed the smoke script's fallback-GPU record, made the Stop hooks find the repo from
their own path, and made `mpi/no-raw-event-listener` + `mpi/no-raw-console` work on Windows (with
the 142 violations they had let through). The finding sections below are left as written.

**Left alone on purpose in #12:**
- `MpiProjectName` / `MpiQueuePanel` keep local byte formatters (already decimal; merging them
  changes spacing and precision on screen — a visual call for Fabio).
- `connector.js`, `mcp.js`, `agentLoop.mjs` already decode `/project-file` URLs once; ~30 plain
  inline URL builders in `projects.js` / `ffmpegThumb.js` are correct as written.
- Three tests filled counters they never asserted (agent-loop `generateCalledAt`/`turnReturnedAt`,
  comfy-vanished-prompt `queueCallCount`, thumb-strip `selBefore`); the counters were removed.
  MPI-1302 checked them: only comfy-vanished-prompt had lost a check (it now asserts the queue
  was read); the other two counters were never used.

**Done in MPI-1302 (tracked on that card, phase by phase):**
- Phase 1a: **B4** (one `js/utils/uninstallOutcome.js` count for both uninstall toasts),
  **B6** (History toasts go through `StatusBar.notify`). **H3 dropped:** the `D:\tmp` stage dir
  is deliberate (Fabio's PC, C: is short on space); CI passes its own `--stage-dir`.
- Phase 1b: **D6** (`graph_utils.py`: one title lookup, prune and switch bake for every
  handler; all 24 generated workflows byte-identical before and after).
- Phase 1b: **D8** (one `escapeHtml` in `utils/string.js`, `basename` in `utils/file.js`,
  `clamp`/`clampNumber`/`clampInt` in a new `utils/math.js`, `ORIENTATION_OPTIONS` /
  `ratioIcon` / `cropRatioOptions` in `utils/ratios.js`, `formatClock` for every `m:ss`, one
  `hexToRgb` in `colourKeyMask.js` that `services/gifFrames.js` requires too). `MpiInput` and
  `MpiVoicePicker` now escape `'`; Step Crop and Image Sheet orientation tooltips read
  "Portrait/Landscape orientation" like the crop bar. Also fixed: the phone gallery's video
  chip had the same "0:60" bug as B3. Left: `js/phone/phoneMedia.js` `fileNameOf` (MPI-1300's
  file, card still open), PromptBox clamps (D1).
- Phase 1c: **X4** (Fabio: remove the unused skill-listed routes). Gone: `/project-templates/*`,
  `GET /project-media/:id`, `upload-raw`, `probe-videos`, `/project-data/:id/upload`,
  `/system/list-components`, `/logs/download` (skill docs updated). `GET /project-media/:id` had
  been shadowing `/project-media/temp`, so the project reconciler now reaches its own cheap
  handler instead of one that read every PNG. Internal-only exports un-exported; never-used
  `truncate`/`capitalize`/`slugify`, `getVideoBounds`/`handleSnapshot`,
  `getPortableResourcesPath` deleted; icons `translate`/`volumeLow` deleted, then (Fabio's OK
  for the rule edit) `seed`/`gallery` and their stroke special case in `renderIcon`;
  `.claude/rules/dos_and_donts.md` now names only the `ratio_` / `_stroke` rules.
- Phase 1d: **T1** (`typescript` dev dependency, `tsconfig.typecheck.json`, `npm run typecheck`
  run by `npm run lint`, so by CI and the pre-push gate too). `checkJs` and `strict` stay off:
  only files with `// @ts-check` are checked, i.e. all 57 `js/utils/*.js`, `commandRegistry.js`
  and `resolveModelDeps.js`. Fixed to pass: JSDoc that no longer matched the code
  (`CommandDef` gained `sizeOptIn`/`isMultiStage`/`allowsBranchingContinue`/`injector`/
  `outputVersions`, `CommandContext` `audioCount`/`installedOps`, flow slot shapes, etc.), and
  two doc blocks that had come loose from their function (`describeImage` in llmService.js had
  been documenting `enlargedCrop`; `getAvailableCommands`' sat above `_maxMediaSlots`). Three
  required-options functions lost a `= {}` default every caller already overrode.
  `routes/` is not covered (Node side, needs its own config).
- Phase 1d: **T2** JSDoc on the undocumented exports of `promptReuse.js` (a
  `PromptReusePayload` typedef, the strict Current vs Original contract), `projectService.js`
  (the 8 lifecycle functions) and `routes/shared.js` (`stopComfyUI` states the MPI-484
  owner-only stop, `_normalizeExtraFolderPath` the MPI-444 `realpath.native` rule, plus
  `ensureCuratedPythonDeps`, `getDefaultModelsRoot` and the extra-folders cluster). Left: the
  audit's "smaller gaps" (projectStatsService, devUpdatesService, commandExecutor).

- Phase 2: **D1** (`PromptBoxControls.js`: `_controlHost` lays out the label row all 17 controls
  shared, `_mountSlider` the track + input/change/persist the 7 real sliders shared; only 7 of
  the 17 were sliders, the rest are radio rows, a dropdown and the style picker). 262 lines
  fewer. Proof: 198 control x model cases (DOM, value, injection params, a drag and its
  settings event) identical before and after in the desktop app.
- Phase 2: **D3** (`services/outputCard.js`: `writeVideoCard` for combine, video crop, reverse,
  video extract, GIF-to-video; `writeImageCard` for sheets, crop-media, composite, apply-paint,
  extract-media; `writeImageRenditions` moved there from `projects.js`). Proof: all 12 route
  cases driven on real ffmpeg output, sidecar + response identical before and after except the
  sheet card now carries `flowId`/`flowInputs: null` like the other stills. crop-media still
  writes no renditions (unchanged, noted on the card).
- Phase 2: **D10, GIF card tail + `gifEntry` normalisation** (`writeGifCard` / `writeGifThumb` in
  `services/outputCard.js`, `gifEntryFrom` in `services/gifFrames.js`; gif.js new/update/preview,
  gifMake, gifMaker, gifCutout, gifTransform). Every GIF thumb now uses the path
  `extractImageThumb` returns (MPI-627). Proof: 9 GIF route cases identical before and after.
  Frame-hash 400 check left in the routes on purpose: it answers 400 before any work, `buildGif`'s
  own check would surface as a 500.
- Phase 2: **D10, scratch sweeps** (`services/scratchSweep.js` `sweepOlderThan`): all nine copies
  (deepinfra, toolResize, gifCutout, imageImport, llm zoom, projects engine scratch,
  videoExtract, seamlessOps, tileOutlines), each keeping its age and file/dir rule. Proof: unit
  test + the MPI-919 retention test.
- Phase 2: **D10, ffmpeg plumbing** (`services/ffmpegBinary.js`): `runFfmpeg`/`runFfprobe` force
  `windowsHide` for the 17 files that each promisified `execFile` (comment kept once there);
  `trimArgs` replaces the four `-ss/-to` copies; `muxAudioIntoVideo` uses `ffmpegMux`'s own
  `_spawnFfmpeg`. `videoConcat`'s runner stays: it feeds stdin and parses progress.

**Still open, suggested batches:**
- Next: rest of **D10** ( remote proxy, EXIF swap, lazy imports,
  `_fail`), **P2/P14/P7/P12/P13**.
- Needs the desktop suite or Fabio watching: **P1**, **P3**, **D7**, **D9**.
- Needs a local profile or a Pod: **P4–P6**, **P9–P11**.

**Notes for whoever picks it up:** lint now runs with `--max-warnings=0` and the two path rules
fire on Windows CI, so any new warning fails it. In a Linux cloud container `npm test` has ~16
environmental failures (RunPod, agent installers, `sh` scripts, `wmic`): compare failing test
NAMES before and after, not the exit code. Cloud setup: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`.

## How this was produced, and what it cannot claim

- **Nothing was executed.** Every shell call in this container is refused by the repo's own
  `PreToolUse` hooks (see H1), so no `npm run lint`, `npm test`, eslint, knip, depcheck or
  benchmark was run. Every finding was established by reading code and by repo-wide grep
  (Grep/Glob/Read only). Use counts are grep counts.
- **No GPU, no engine, no Pod.** Nothing in §3 is measured. Each performance item says *why*
  it should cost and *when* it runs; the size of the win is unknown until measured locally.
  Items marked **CPU-verifiable** can be benchmarked in plain Node (a temp project with N
  sidecars, a synthetic `ImageData`, a mocked `fetch`). Items marked **local** need the
  Electron app, a real GPU-backed canvas, ComfyUI or a Pod.
- **Language mapping.** This is a JavaScript/Node codebase (Python only in workflow-generation
  and maintenance scripts). "Type hints" → JSDoc + `checkJs`; "host/device transfers" →
  GPU-canvas readbacks (`getImageData`/`toDataURL`), base64 round trips, and file uploads to a
  remote GPU Pod; "non-vectorised loops" → per-pixel JS loops over `ImageData`.
- **Dead-code claims** were grepped across `js/ routes/ services/ main/ scripts/ tests/
  *.html server.js main.js`. Dynamic access (`_methods` allowlists, registry maps, route
  strings fetched by the frontend, skill docs listing HTTP routes) was checked before calling
  anything dead; the ones where a non-code consumer exists are flagged as such.

Risk scale: **low** = local, mechanical, covered or easily covered by a node unit test;
**medium** = touches shared behaviour or several call sites, needs the desktop suite;
**high** = touches persistence, concurrency, or engine/Pod paths with a history of regressions.

---

## Ranked summary (value vs risk)

Highest value-for-risk first. IDs link to the detail sections.

| # | ID | Finding | Value | Risk | GPU-free check? |
|---|----|---------|-------|------|-----------------|
| 1 | [H2](#h2) | ESLint has no `no-unused-vars` (and `@eslint/js` is imported but unused) — turning it on finds every unused import mechanically | High | Low | Yes |
| 2 | [B1](#b1) | `/project-file?path=` decoded **twice** in ~8 routes — a `%` in a filename breaks crop/reverse/extract/trim/GIF | High (bug) | Low | Yes |
| 3 | [B2](#b2) | 8 tool-option panels **drop** the last setting edited <200 ms before the tool closes | High (bug) | Low | Yes (desktop spec) |
| 4 | [X1](#x1) | Whole dead files: `js/utils/async.js`, `js/utils/images.js`, `js/components/shaderBackground.js` (~350 lines) | Med | Low | Yes |
| 5 | [X2](#x2) | Unused dependency `electron-context-menu`; unused devDeps `firacode`, `jetbrains-mono`; two dead `@font-face` rules | Med | Low | Yes |
| 6 | [X3](#x3) | Confirmed unused imports in GalleryBlock (6), GroupHistoryBlock, BaseFlow, `routes/comfy.js` (2), `routes/projects.js` | Low-Med | Low | Yes |
| 7 | [D5](#d5) | Six byte/speed formatters, three unit systems (decimal vs 1024 vs KiB); one is a dead duplicate in `utils/file.js` | Med | Low | Yes |
| 8 | [B3](#b3) | Audio card duration can render `0:60` (`MpiGalleryGrid.js:1521`) | Low (bug) | Low | Yes |
| 9 | [D1](#d1) | `PromptBoxControls.js`: the slider control block copy-pasted 17× (~450 lines); a factory already exists in the same file | High | Low-Med | Yes (desktop) |
| 10 | [D2](#d2) | ~16 hand-written `/project-file?path=` → disk-path resolvers and ~25 URL builders; correct helpers exist in `projects.js` but are not exported | High | Low-Med | Yes |
| 11 | [P1](#p1) | Every `save-generation` re-reads **every** sidecar in the project serially (orphan GC) | High | Medium | CPU-verifiable |
| 12 | [P2](#p2) | `list-projects` ships every project's full `project.json`; `/update-project` echoes the whole project back | Med-High | Low-Med | CPU-verifiable |
| 13 | [D3](#d3) | Sidecar-and-card writer copied in ~15 backend routes (~40 lines each) | High | Medium | Yes |
| 14 | [D8](#d8) | `escapeHtml` ×7, `basename` ×12, `clamp`/`clampInt` ×6, `ORIENTATIONS` ×4 — no shared util | Med | Low | Yes |
| 15 | [D6](#d6) | Python workflow generators: `_find_id_by_title` ×10, `_prune_to_captures` ×5 identical | Med | Low | Yes (re-run + byte-compare) |
| 16 | [T1](#t1) | `checkJs: false` — 1,951 JSDoc `@param` tags are never type-checked | Med | Low | Yes |
| 17 | [P3](#p3) | Bulk delete is O(items × sidecars) with sync fs in handlers | Med | Medium | CPU-verifiable |
| 18 | [P4](#p4) | Mask emptiness scanned up to 3× per stroke end (64 MB `getImageData` each at 4096²) | Med | Medium | Partly; real cost local |
| 19 | [D4](#d4) | Tool-options "persist" boilerplate ×8 (+18 settings reads) — also the home of B2 | Med | Low | Yes |
| 20 | [D7](#d7) | Mask/Paint/Composite managers share ~120 lines of identical adjust/undo/stroke-box code | Med | Medium | Partly (unit), local for feel |
| 21 | [P7](#p7) | One ffmpeg process per GIF frame thumb, serially (200 frames = 200 spawns) | Med | Low-Med | CPU-verifiable |
| 22 | [P9](#p9) | Remote engine re-uploads every input file on every run | Med-High on Pod | Medium | Logic unit-testable; benefit needs Pod |
| 23 | [D9](#d9) | Prompt-reuse flow duplicated between Gallery and History Blocks (~150 lines) | Med | Medium | Desktop suite |
| 24 | [X4](#x4) | Uncalled `/project-templates/:id` routes (~60 lines) | Low | Low | Yes |
| 25 | [H1](#h1) | Repo hooks hard-code `c:/AI/Mpi/Cubric-Vision/...` → Bash dead in every non-Windows checkout | Process | Low | Yes |

Everything below the table is grouped by the four requested categories, then bugs found in
passing (B*) and tooling (H*).

---

## 0. Tooling and process (fix these first; they make the rest cheaper)

### H1 — Claude Code hooks hard-code a Windows path that no longer exists <a id="h1"></a>
- **Location:** `.claude/settings.json:17-49` — every hook runs `python c:/AI/Mpi/Cubric-Vision/.claude/hooks/*.py`.
- **Why it matters:** the repo is now `Cubric-Studio`, and on Linux/macOS/cloud checkouts the
  path resolves relative to the repo root and does not exist. The `PreToolUse` hooks therefore
  **fail closed on every Bash call**: no lint, test or git command can run. This audit had to
  be done without executing anything because of it.
- **Fix:** reference the hooks relative to the project (`"$CLAUDE_PROJECT_DIR"/.claude/hooks/...`)
  and commit the hook scripts, or make them no-op when the file is absent. Use `python3` on
  POSIX.
- **Risk:** low. **GPU-free:** yes. (Settings are not edited here; CLAUDE.md requires your
  permission for config changes.)

### H2 — ESLint never checks unused variables or imports <a id="h2"></a>
- **Location:** `eslint.config.js:1` imports `@eslint/js` as `js` and never uses it; the config
  enables only `no-undef` plus the custom `mpi/*` rules (lines 57-83). `js.configs.recommended`
  is not spread, so `no-unused-vars` is off repo-wide.
- **Why it matters:** this is why the unused imports in [X3](#x3) exist. One rule finds all of
  them mechanically, in every file, which the sampled audit here could not.
- **Fix:** add `'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', ignoreRestSiblings: true }]`.
  Run `npx eslint . --rule ...` once to size the backlog, fix it, then raise the rule to
  `error`. Either spread `js.configs.recommended` or delete line 1.
- **Risk:** low (lint-only). **GPU-free:** yes.

### H3 — Machine-specific paths in npm scripts
- **Location:** `package.json:14-16` — `build:portable:{win,linux,mac}` pass `--stage-dir D:\\tmp\\cubric-portable`.
- **Why:** these only work on one Windows box, and the Linux and macOS variants also point at a
  `D:` drive.
- **Fix:** default the stage dir inside `build-portable.mjs` (e.g. `os.tmpdir()`) and drop the
  flag, or read it from an env var.
- **Risk:** low. **GPU-free:** yes (`build:portable:dry-run`).

---

## 1. Duplicated or near-duplicated code

### D1 — `PromptBoxControls.js` slider control ×17 <a id="d1"></a>
- **Location:** `js/components/Organisms/MpiPromptBox/PromptBoxControls.js`.
  - The block starts at lines 428, 635, 711, 825, 950, 1056, 1148, 1219, 1286, 1680, 1746,
    1855, 1929, 1996, 2050, 2109 and 2166.
  - Each copy builds a `hostEl.className = 'mpi-prompt-box__slider-control'` label row,
    `MpiProgressBar.mount({interactive, wheel, handle, variant:'primary'})`, `_fmt`/`_clamp`,
    input and change handlers, `getValue` and `destroy`.
  - `motionIntensity` (705-748) and `denoise` (1045-1093) differ only in label, info and initial value.
- **Why:** about 450 lines. A fix to slider behaviour (clamp, wheel, persistence) must be made 17 times.
- **Fix:** generalise the existing `_ttsKnob(key, label, info)` (2153-2213) into
  `_sliderControl({ key, label, min, max, step, info, fmt, resolveInitial })` and convert the
  controls one at a time. `scope` stays on each registry entry, per `dos_and_donts.md` § PromptBox controls.
- **Risk:** low-medium (persistence and Reuse are `scope`-driven, so the shape must not change).
- **GPU-free:** yes. The PromptBox desktop specs plus a node test asserting each control's
  `getInjectionParams()` before and after.

### D2 — `/project-file?path=` URL ↔ path conversion, ~40 copies <a id="d2"></a>
- **Parsing a URL back to a disk path (~16 copies):**
  - `_resolveInput` in `routes/videoCrop.js:45`, `videoReverse.js:44`, `videoExtract.js:58`,
    `videoTrimInput.js:31` and `videoGif.js:53`.
  - `gifMaker.js:97`, `gifMake.js:61`, `videoConcat.js:53`.
  - Inline at `projects.js:1864`, `2401` and `3258`.
  - A regex variant at `gif.js:53`, `multiAngle.js:32`, `llm.js:588` and `llm.js:663`.
- **Building the URL (~25 copies):**
  - `projectFileUrl` and the cache-busted twin at `projects.js:454/463`, `gif.js:43/47`,
    `gifTransform.js:79`, `gifCutout.js:188`, `gifToVideo.js:74`, `services/agentLoop.mjs:3730`
    and `seamless.js:32`.
  - Inline mtime-busted copies in `videoCrop.js:143`, `videoReverse.js:132`,
    `videoExtract.js:235`, `videoConcat.js:100`, `gifMake.js:151`, `gifMaker.js:236`,
    `imageSheet.js:175` and `gifToVideo.js:201`.
- **Why:**
  - The copies have already diverged into a real bug ([B1](#b1)).
  - Two GIF routes (`gifTransform.js:155`, `gifCutout.js:394`) use the *non*-busted URL for
    fresh output, against the stated rule at `projects.js:458`.
  - `llm.js:661` already notes "one shared helper if a fifth appears".
- **Fix:** export `pathFromProjectFileUrl`, `decodeProjectFilePath` (it decodes once, which is
  correct), `projectFileUrl`, `projectFileUrlBusted` and `safeJoinInside` from a small
  `services/projectFileUrl.js`, and replace the copies.
- **Risk:** low-medium (many call sites, each a one-liner).
- **GPU-free:** yes. A node test table of tricky filenames (`%`, `&`, `#`, spaces, unicode,
  `&v=` suffix) run against the helper.

### D3 — "write the output sidecar + card" in ~15 backend routes <a id="d3"></a>
- **Locations:**
  - **Video:** `routes/videoCrop.js:139-186`, `videoReverse.js:128-174`,
    `videoExtract.js:232-269`, `gifToVideo.js:197-245`, `videoConcat.js:94-132`.
  - **Image:** `imageSheet.js:174-193`, and `projects.js:3289-3309` plus ~3396, ~3504 and ~3591.
- **What repeats:** the same sidecar literal (`id, type, filePath, displayName, prompt:'', seed:-1, …`),
  then derivatives, `fs.writeJson(.meta/<id>.json)`, a `{item, group}` payload and catch-path cleanup.
- **Why:** sidecar shape changes (e.g. a new field the reconciler needs) must be made in 15
  places, and omissions are silent until a card misbehaves.
- **Fix:** promote the local, already-complete `videoConcat._writeOutputSidecar`
  (`videoConcat.js:94`) to a shared `writeOutputCard({ folderPath, outPath, type, operation, extra })`.
  The GIF routes have their own variant ([D10](#d10)).
- **Risk:** medium (project data shape; the reconciler and Reuse read these fields).
- **GPU-free:** yes. A node test that snapshots the sidecar each route writes before and after.

### D4 — Tool-options "persist" boilerplate ×8 <a id="d4"></a>
- **Locations:** `_persistTimers = new Map()` + a 200 ms `persist(key, value)` + cleanup in
  `destroy`, in the `MpiToolOptions*` panels:
  - Interpolate 60-67 / 93
  - GifTransform 93-99 / 158
  - Gif 120-126 / 215
  - GifTiming 126-132 / 359
  - Upscale 108-115 / 261
  - Crop 177-184 / 405
  - RemoveBg 73-80 / 118
  - Resize 273-279 / 752
  - Plus `getToolSettings(state.currentProject || {}, key, DEFAULTS)` in 18 files.
- **Why:** this boilerplate is where bug [B2](#b2) lives, eight times over.
- **Fix:** `createToolSettings(toolKey, DEFAULTS, { delayMs })` → `{ initial, persist, dispose }`,
  where `dispose` **flushes** pending writes. Put it in `js/data/projectModel.js` or a new
  `js/utils/toolSettings.js`.
- **Risk:** low. **GPU-free:** yes.

### D5 — Byte and speed formatting: six implementations, three unit systems <a id="d5"></a>
- **Locations:**
  - `js/utils/formatBytes.js:9`: decimal, as MPI-763 chose; 9 importers.
  - `js/utils/file.js:25`: `formatBytes` again, **1024-based with "KB" labels; 0 importers**.
  - `MpiToolOptionsGif.js:62` and `MpiToolOptionsGifTiming.js:70`: identical KiB/MiB copies.
  - `MpiProjectName.js:189`: a decimal local copy.
  - `MpiQueuePanel.js:456`.
  - Speed: `_formatSpeed` ×3, all 1024-based, at `js/services/downloadService.js:989`,
    `routes/downloadManager.js:1496` and `routes/shared.js:532`. The last formats differently.
- **Why:** download *sizes* are shown decimal while download *speeds* are binary, so the two
  numbers do not agree on screen. The dead `file.js` copy is a trap for the next importer.
- **Fix:** delete `file.js:formatBytes`. Add `formatSpeed` beside `formatBytes` (decimal) and
  import it everywhere. The backend needs a CommonJS twin, or move the formatting to the client.
- **Risk:** low (the visible change is in labels only). **GPU-free:** yes.

### D6 — Python workflow generators repeat the same helpers <a id="d6"></a>
- **Locations:** `comfy_workflows/scripts/workflow_generation/`:
  - `_find_id_by_title`/`_find_by_title` is defined 10× (`generate_chroma.py:71`,
    `generate_klein.py:176`, `generate_h3.py:220`, `generate_qwen.py:47`,
    `generate_boogu.py:51/58`, `generate_wan5b.py:35`, `generate_sdxl.py:41`,
    `generate_krea2.py:117`, `generate_ltx.py:64`, `generate_wan.py:65`).
  - `_prune_to_capture(s)` is defined 5× and is byte-identical in chroma/klein (verified: 78-108 vs 183-212).
  - `_bake_wf_type`/`_assert_and_bake_wf_type` ×3 and `_assert_and_bake_int` ×2.
- **Why:** these guards protect against silent wrong-branch output (their own docstrings say
  so). A fix to one copy does not reach the other nine.
- **Fix:** a `graph_utils.py` beside `registry.py` exposing
  `find_id_by_title(wf, title)`, `prune_to_captures(wf, capture_titles)` (take the tuple as a
  parameter rather than a module global) and `assert_and_bake_int(wf, title, value, label)`.
- **Risk:** low.
- **GPU-free:** yes. Re-run `orchestrate.py` and byte-compare every output file under
  `comfy_workflows/` against HEAD; zero diff = safe.

### D7 — Canvas layer managers share identical code <a id="d7"></a>
- **Locations:** `js/components/Primitives/MpiCanvas/managers/`.
  - `_ensureAdjustField`: MaskManager 749-764 = PaintManager 329-344.
  - `endAdjust`: Mask 894-908 = Paint 523-537. `beginAdjust`: Mask 707-730 ≈ Paint 278-300.
  - `takeStrokeBox` + `_growStrokeBox`: identical in Mask 231-255, Paint 169-191 and Composite 157-175.
  - `_recordUndo`/`_commitUndo`: identical in Mask 212-221 and Paint 153-162.
  - `fillHoles` setup: identical in Mask 852-863 and Paint 478-489.
- **Why:** about 120 lines. Undo correctness is a stated project invariant
  (`docs/masking-undo.md`), and three copies make a hole in Ctrl+Z more likely.
- **Fix:** a `layerBase.js` (or `adjustSession.js` + `strokeBox.js`) mixin used by all three.
- **Risk:** medium (undo and adjust paths).
- **GPU-free:** partly. The stroke-box and adjust logic run in node against a fake 2D context.
  Brush feel and undo should be checked locally.

### D8 — Small utilities re-implemented locally <a id="d8"></a>
- **`escapeHtml`, 7 copies:**
  - Identical in `MpiTreePicker.js:7`, `MpiDropdown.js:6`, `MpiFilterBar.js:5`,
    `MpiFileTree.js:6` and `MpiStylePicker.js:5`.
  - `MpiInput.js:49` and `MpiVoicePicker.js:248` do **not** escape `'`, so those two are weaker.
- **Basename, ~12 copies:**
  - `loraSlotParts.js:127` exports `baseName`, and `commandExecutor.js:473` is an exact copy.
  - More copies in `MpiTreePicker.js:18`, `MpiGalleryBlock.js:1535`, `MpiMediaPicker.js:150`,
    `MpiModelUploader.js:18`, `comfyValidationError.js:57`, `flowService.js:56`,
    `comfyController.js:2221/2285/2292`, `agentDispatch.js:1759`, `MpiCanvasViewer.js:334`
    and `MpiCompareView.js:87`.
- **`clamp`/`clampInt`, 6 copies:**
  - `clampInt`: `MpiToolOptionsCrop.js:68` = `MpiToolOptionsResize.js:113`, and
    `MpiToolOptionsGif.js:48` duplicates the unexported `gifTiming.js:41`.
  - `clamp`: `MpiTrimBar.js:51`, `MpiBoxesPanel.js:43` and `deepinfraSizing.js:212`.
- **`ORIENTATIONS` and ratio options:**
  - `ORIENTATIONS` ×4 in `MpiToolOptionsCrop.js:96`, `MpiToolOptionsResize.js:101`,
    `MpiStepCrop.js:70` and `MpiImageSheet.js:14`.
  - `_ratioOptionsFor` ×3, and the `icon.replace('rect_','ratio_')` mapping at 8 sites.
- **`m:ss` time formatting:**
  - `statusBar.js:77` equals `formatClock` (`elapsedTicker.js:15`).
  - Inline copies in `MpiAudioRecorder.js:377`, `MpiAgentChat.js:524`, `declaredFields.js:341`
    and `MpiGalleryGrid.js:1031/1521`. The last one is buggy ([B3](#b3)).
- **`hexToRgb`:** the exported `colourKeyMask.js` version is shadowed by local copies in
  MpiColorPicker and `services/gifFrames.js`.
- **Fix:** add `escapeHtml` to `utils/string.js`, `basename` to `utils/file.js`,
  `clamp`/`clampInt` to a new `utils/math.js`, `ORIENTATION_OPTIONS`/`cropRatioOptions()` to
  `utils/ratios.js`, and use `formatClock` everywhere.
- **Risk:** low. **GPU-free:** yes. The escapeHtml change is also a small XSS-hardening win for
  the two weaker copies.

### D9 — Gallery vs History Block: prompt reuse, drag-drop, model picker, generation ownership <a id="d9"></a>
- **Prompt reuse (~150 lines):** `MpiGalleryBlock.js:1396-1582` vs `MpiGroupHistoryBlock.js:2419-2568`.
  - `_reuseIncludes` is identical.
  - `_handlePromptReuse`/`_applyPromptReuse` share the flow early-return, model fallback,
    media resolution, the "missing media" warning and the settings apply.
- **File-drop overlay wiring ×4:** `MpiGalleryBlock.js:241-270`, `MpiGroupHistoryBlock.js:2103-2136`,
  `shell/projectUI.js:160-179` and `MpiFlowLibrary.js:1207-1220`. Each carries a "same fix as"
  comment for MPI-532.
- **Model-picker wiring:** Gallery 2014-2034 and History 2228-2242.
- **The `_myGenIds`/`_stoppedPendingComplete` ownership state machine:** Gallery 121-129 +
  1931-2004 and History 1344-1351 + 1559-1634.
- **Toasts:** History uses its own `_showToast` (480-486, 72 call sites), which never destroys
  its toast instance, while Gallery uses `StatusBar.notify`.
- **Fix:**
  - Move the reuse sequence into `utils/promptReuse.js` as
    `applyReuseToPromptBox(pb, payload, use, hooks)`.
  - Add `wireFileDragOverlay(target, overlay, opts)` to `utils/dom.js`.
  - Add a `createGenOwnership()` tracker.
  - Replace `_showToast` with `StatusBar.notify`.
- **Risk:** medium (the two Blocks are the app's core workspaces). **GPU-free:** yes, with the
  desktop suite (reuse, drop and generation-lifecycle specs).

### D10 — Backend: GIF card pipeline, scratch sweeps, ffmpeg boilerplate, remote proxy <a id="d10"></a>
- **GIF card tail ×5:** `nextSequence('gif')` → `buildGif` → sidecar → `extractImageThumb` → `imageThumbPath`.
  - Copies: `gif.js:208-244`, `gifMake.js:146-172`, `gifMaker.js:231-257`,
    `gifCutout.js:386-422` and `gifTransform.js:136` (`_writeNewGifCard`, which says it
    "mirrors gifCutout exactly").
  - All five recompute the thumb path instead of using the path `extractImageThumb` returns,
    against `projects.js:144` (MPI-627). `writeImageRenditions` is exported and unused here.
- **`gifEntry` normalisation ×4:** `gif.js:165/291`, `gifCutout.js:373` and `gifTransform.js:137`.
- **Frame-hash 400 check ×7:** `buildGif` already performs it (`services/gifFrames.js:362`).
- **Frames → concat list → ffmpeg ×2:** `gifCutout.js:139-176` and `gifToVideo.js:163-195`.
- **Age-based scratch sweeps ×9:**
  - Identical pairs: `videoExtract.js:78`/`gifCutout.js:117`,
    `services/tileOutlines.js:29`/`services/seamlessOps.js:82` and `toolResize.js:36`/`deepinfra.js:93`.
  - Same intent: `imageImport.js:88`, `llm.js:594` and `projects.js:2274`.
- **`toolResize.js` vs `deepinfra.js` scratch-output dir + serving route:** `toolResize.js:7`
  says it copies "the same shape as the cloud route".
- **ffmpeg plumbing:**
  - `promisify(execFile)` is redefined in 13 files, inline in 3 more, and the 4-line
    `windowsHide` comment is copied into 6.
  - The `-ss/-to` trim logic appears ×4, while `videoExtract.js:70 _trimArgs` exists.
  - Three hand-rolled spawn+stderr wrappers: `services/ffmpegMux.js:47` and `:148`, and
    `services/videoConcat.js:67`.
- **Remote proxy forwarding ×7:** `routes/remoteProxyForward.js` (four POSTs at 45-181 plus
  three GETs) are identical apart from the path. `remoteModels.js:51 _authHeaders` re-implements
  the exported `remotePodState._authHeaders`.
- **ffprobe bypass:** `projects.js:2413` and `deepinfra.js:355` call `ffprobePath` directly
  instead of `services/ffprobeVideo.js`.
- **EXIF swap ×8:** `orientation >= 5 ? swap(w,h)` in `projects.js:245`,
  `ingredientsSheet.js:227`, `deepinfraCollage.js:60`, `imageImport.js:46`,
  `deepinfra.js:281/293`, `services/tileOutlines.js:51` and `services/engineMask.js:56`.
  Three other files use sharp's `autoOrient`, which `dos_and_donts.md` names as the rule.
- **Lazy-import caches:** the `engines()` loader ×3, the trash loader ×2, `_getSharp` ×2, and
  `connector.js` loads `_corpusMod` twice (114, 118).
- **`_fail(res, code, msg)` envelope ×5:** `multiAngle.js:29`, `toolResize.js:44`,
  `deepinfra.js:102`, `tiles.js:19` and `seamless.js:34`. The pattern is written inline ~190×.
- **Fix:**
  - A `services/media/` set of helpers (`runFfmpeg`, `trimArgs`, `sweepOlderThan`,
    `uprightSize`, `writeGifCard`, `lazyImport`) plus `forward(method, path)` for the proxy.
  - Migrate route by route; each migration is independent.
- **Risk:** low per helper, medium in aggregate. Trash, mux and remote-proxy are engine/Pod paths.
- **GPU-free:** yes for all but the remote proxy (a mocked `fetch` covers the shape).

### D11 — Other frontend duplication (lower value)
- **Preview-store POST + `FileReader.readAsDataURL`:**
  - The preview-store POST is written 5×: `agentDispatch.js:1127`, `MpiBaseFlow.js:1043`,
    `generationService.js:849`, `flowEnhance.js:490` and `scene/scenePicture.js:180`.
  - The `readAsDataURL` promise is hand-written 8×.
  - `agentDispatch.js:1123` says to lift both "the day a third caller appears".
  - Fix: `blobToDataUrl` in `utils/file.js` and `placePreviewAsset` in `mediaUploadService.js`.
- **JSON fetch:**
  - `'Content-Type': 'application/json'` is written inline 128×.
  - There are 7 local `post`/`postJson` wrappers with different error handling.
  - Fix: a new `utils/http.js`.
- **`media:imported` payload:** built by hand 4× with 13, 7, 7 and spread fields respectively.
  The PromptBox copy (872-880) omits `proxyPath`, `wavePath`, `fps` and `duration`.
  `agentDispatch.js:1759` also re-implements `uploadMediaFile`.
- **Model Library vs Flow Library:**
  - The confirm-dialog plumbing is duplicated: `MpiModelManager.js:265` and `MpiFlowLibrary.js:496`.
  - The uninstall "already absent" accounting has drifted ([B4](#b4)).
- **Risk:** low-medium. **GPU-free:** yes.

---

## 2. Dead code, unused imports, unused dependencies

### X1 — Whole files with no importer <a id="x1"></a>
- **`js/utils/async.js`** (41 lines: `debounce`, `throttle`, `sleep`) and **`js/utils/images.js`**
  (84 lines: `resizeImageIfNeeded`, `createThumbnail`) are never imported. I re-verified this
  with a repo-wide grep. Both are still *recommended* in `.claude/rules/dos_and_donts.md` and
  `docs/utils.md`, so delete or update those docs in the same change.
- **`js/components/shaderBackground.js`** (~230 lines) is never imported or called anywhere,
  including HTML.
- **`js/core/appName.js`** has no importer; its twin `appName.cjs` is used by `main.js:468`.
  Its header calls it the source of truth, so this one is a judgement call.
- **Not dead:** `js/data/mixRecipe.js` and `js/data/mixMath.js` are used only by tests, because
  they are Phase 1 of the planned Mix feature (MPI-917). Keep them.
- **Probably one-off scripts:** `scripts/convert-images.cjs` and `scripts/overtaken-cards.py`
  are referenced nowhere live. Ask before removing.
- **Risk:** low. **GPU-free:** yes (lint + `npm test` + app boot; ES module imports fail loudly).

### X2 — Unused dependencies and font faces <a id="x2"></a>
- **`electron-context-menu`** (`package.json:38`) has no `require`/`import` anywhere.
  `main.js:670` wires the context menu by hand.
- **`firacode`, `jetbrains-mono`** (devDeps, `package.json:58/61`) are unused because the fonts
  are vendored under `assets/fonts/`. No script copies from `node_modules/`.
- **Dead `@font-face` rules** in `styles/01_base.css`:
  - `Fira Code` (19-30) is declared and referenced by no `font-family` anywhere.
  - `VT323` (31-34) is the same; `DESIGN.md:168` already says so.
  - The browser never downloads an unused face, so the cost is the shipped `.woff2` files and
    the noise in the file.
- **Checked and used:** `axios` (`server.js:167`, dynamic import), `trash`
  (`projects.js:854`, `downloadManager.js:30`), `body-parser` and the rest.
- **Optional:** `body-parser` could be replaced by `express.json()` (Express ≥4.16), which
  would remove one direct dependency. Low value.
- **Fix:** `npm uninstall electron-context-menu firacode jetbrains-mono`, and remove the two
  `@font-face` blocks and their `.woff2` files once confirmed unused by the portable build.
- **Risk:** low. Check `scripts/build-portable.mjs` does not whitelist the packages; it did not
  appear in the grep.
- **GPU-free:** yes (`npm ci`, `npm test`, `build:portable:dry-run`).

### X3 — Confirmed unused imports (sampled; [H2](#h2) will find the rest) <a id="x3"></a>
- `MpiGalleryBlock.js`: `Hotkeys` (L33), `ce` (L34), `getModelsByType` (L40),
  `getAvailableCommands` (L42), `startGeneration` (L47) and `persistGroups` (L54). I re-verified
  these: each name appears only on its import line.
- `MpiGroupHistoryBlock.js`: `loadAll as loadAssets` (L62).
- `MpiBaseFlow.js`: `MpiRadioGroup` (L4).
- `routes/comfy.js`: `exec` (L24; other matches are regex `.exec(`) and `cleanEmptyDirs` (L33).
- `routes/projects.js`: `COMFYUI_PORT` (L42).
- **Not sampled:** the rest of `js/shell/*.js`, `routes/connector.js` and `routes/mcp.js`.
- **Risk:** low. **GPU-free:** yes.

### X4 — Routes and exports nothing calls <a id="x4"></a>
- **`/project-templates/:id`** (GET, POST, DELETE) in `routes/projects.js:3851-3910`, ~60
  lines: no caller anywhere, including tests and skills. `templateManager.js` is unrelated.
  It is also the route [P-misc](#p-misc) flags for reading every `project.json` per request.
- **No in-repo caller, but listed in the agent skill docs as public HTTP API**, so keep them
  unless the API is being trimmed:
  - `/system/list-components`, `/logs/download`
  - `/project-media/:id/upload-raw`, `/project-media/:id/probe-videos`
  - `/project-data/:id/upload`
- **`GET /project-media/:id`** (`projects.js:1289-1312`) reads every PNG fully into memory. No
  frontend caller was found. Check the skills before deleting.
- **Exports with no consumer outside their own file:**
  - `js/utils/string.js`: `truncate`, `capitalize`, `slugify`.
  - `js/utils/video.js`: `getVideoBounds` (L93), and `handleSnapshot` (L138), a gutted stub
    whose `frameUrl` is unused.
  - `js/utils/mediaDimensions.js`: `measureImageDimensions`, `measureVideoDimensions`
    (internal helpers only).
  - `routes/gitProvision.js:182`: `findGit`, `detectPackageManager`, `manualInstallHint`,
    `installGit` (only `ensureGit` is used).
  - `routes/ingredientsSheet.js`: `sheetPrompt`, `sheetRoles`, `GUT`.
  - `services/engineMask.js`: `maskBox`, `BLEND_BAND`.
  - `services/resizeOps.js`: `videoFilter`.
  - `services/imageComposite.js`: `defaultFeather`.
  - Further constants are listed in the agent notes.
  - Fix: un-export these (keep the functions) rather than delete them.
- **`getPortableResourcesPath`** (`routes/platformEngine.js:88`) is exported
  and unused; the same ladder is re-implemented in `main.js:762` and `services/ffmpegBinary.js:23`.
- **Icons never used as icons** in `js/utils/icons.js`: `seed` (L61), `translate` (L90),
  `volumeLow` (L111) and `gallery` (L176). The `['seed','gallery']` stroke special case in
  `renderIcon` (L188/202) is then dead too. `dos_and_donts.md` mentions that special case, so
  update the doc in the same change.
- **Risk:** low (routes: medium if an external agent uses them). **GPU-free:** yes.

### X5 — Style and registration consistency
- `js/components/Compounds/MpiLoraRack/MpiLoraRack.css` is the only component CSS not in
  `js/shell/preloadStyles.js`. It loads lazily via `css:[...]`, so it is not dead, but it breaks
  the "register in preloadStyles" rule.
- I found no large commented-out code blocks; there are only 14 single lines.
- **Repo hygiene (process call, not a code change):** `.agents/` tracks ~414 Python research
  scripts and bench tools in the public repo. They are excluded from lint and CI, so nothing
  checks them. Archiving finished cards' `research/` trees, or moving them to
  `.agents/mpi-kanban/private/`, would shrink clones. That is the board owner's decision.

---

## 3. Inefficiencies (none measured; all need local confirmation of the win)

### P1 — Orphan-sidecar GC on every save-generation <a id="p1"></a>
- **Location:** `routes/projects.js:2805-2847` (re-verified).
- **What happens:** every save does `readdir(.meta)`, then for **each** sidecar a serial
  `readJson`, then `pathExists`, and for orphans `removeItemThumbs`. That last call uses
  `readdirSync`/`removeSync` (124-132) and blocks the event loop.
- **Why:** the cost is O(sidecars) on every image or video landed. A 2,000-card project means
  ~4,000 serial I/O calls per save, and a stack batch of N saves pays it N times.
- **Fix:** move the sweep to project open or Manual Cleanup (both already sweep), or gate it on
  the `.meta` dir mtime as `projectListCache.js` does. Make `removeItemThumbs` async and pass it
  the listing.
- **Risk: medium.** This exact loop has had three race fixes (MPI-975/976/977: `itemsInFlight`,
  read-then-check ordering, unreadable ≠ orphan). Moving it must keep those guards.
- **Verification:** CPU-verifiable. Time `save-generation` against a temp project with
  100/1,000/5,000 sidecars, plus the existing race tests.

### P2 — Landing and update endpoints send whole projects <a id="p2"></a>
- **Locations:**
  - `routes/projects.js:958-968`: `list-projects` returns `{ ...p, ...summary }`, i.e. every
    project's full `project.json` (all `itemGroups`), re-read and re-serialised each Landing visit.
  - `/update-project` (1066-1071) returns the full project on every `persistGroups`; the client
    reads only `updatedAt` (`projectService.js:416-420`).
- **Fix:** project only the fields the Landing renders, cached by `project.json` mtime, and
  return `{ updatedAt }` from update-project.
- **Risk:** low-medium (check every reader of `listProjects()`; MpiAddToProject and the agent
  routes also call it). **Verification:** CPU-verifiable (payload size and handler time).

### P3 — Bulk delete is O(items × sidecars), with sync fs in handlers <a id="p3"></a>
- **Locations:**
  - `js/utils/mediaActions.js:156-167` sends one DELETE per item, serially.
  - Each DELETE runs `sweepGifFrames`, which reads every sidecar
    (`services/gifFrames.js:479-498`), and the sync `removeItemThumbs`.
  - `/delete-meta` (3785), `/load-meta` and `/file-exists` (3635-3660) use
    `existsSync`/`readFileSync`/`removeSync` in request handlers.
- **Fix:** a batch-delete route with one sweep at the end; async fs throughout.
- **Risk:** medium (delete path). **Verification:** CPU-verifiable.

### P4 — Mask emptiness scanned repeatedly (GPU canvas readback) <a id="p4"></a>
- **Locations:**
  - On stroke end: `MpiCanvasViewer.js:1702-1706` (`_publishMaskState` → `hasMaskContent`),
    then `evaluateMask` scans again (1682-1687), then `_opOptions` → `viewer.el.hasMask()`
    (`MpiGroupHistoryBlock.js:396-399`) scans a third time.
  - On Run (`MpiGroupHistoryBlock.js:2376-2378`): `hasMask()`, then
    `getCurrentMaskDataURL()`, then `getFlat`.
- **Why:** each scan is a `getImageData` of a layer up to 4096² (a ~64 MB copy out of a canvas
  that may be GPU-backed), plus a 16.7M-iteration loop when the layer is empty. It runs on every
  pointerup in a mask tool.
- **Fix:** keep a per-layer `nonEmpty`/`dirty` flag. A non-eraser stroke that drew is non-empty
  without scanning; rescan only after erase, undo or clear, and only within the stroke box.
  Memoise until the next mutation.
- **Risk:** medium (the op strip gates on this; MPI-372 history).
- **Verification:** the scan loop is node-benchable on a synthetic `Uint8ClampedArray`. The
  readback cost on a GPU canvas needs **local** measurement (DevTools performance trace).

### P5 — Colour-key and auto-pick masks take several PNG encode/decode round trips
- **Locations:**
  - `js/utils/colourKeyMask.js:93-133` decodes the **original** file at full size, then
    `getImageData`, then `toDataURL`.
  - `MpiCanvasViewer.js:721-735` then does fetch(dataURL), bitmap, canvas, `getImageData`,
    threshold and `toDataURL` again.
  - `_applyPicksFromCache` (503-506) decodes once more. Every SAM pick goes through
    `_maskUrlToTransparentDataUrl` (520-548), which has the same shape.
- **Why:** three synchronous PNG encodes per pick. At 16K the RGBA buffer alone is ~1 GB.
- **Fix:** produce alpha directly into one `ImageData` at the mask working size and pass a
  canvas or bitmap, which MaskManager already accepts, instead of a data URL.
- **Risk:** medium. **Verification:** `colourKeyMask` is pure and node-benchable; encode and
  decode savings need **local**.

### P6 — GIF cut-out tint re-encodes on every playback frame
- **Location:** `MpiToolOptionsGifCutout.js:906-944`, driven by `MpiGifViewer.js:338`. The
  per-pixel `_alphaBitmap` (877-891), `putImageData` and a synchronous `toDataURL` run on each
  frame tick, twice when there is a proposal.
- **Fix:** memoise per (mask URL, grow), use `toBlob` with object URLs, and skip the tint while
  playing.
- **Risk:** low-medium. **Verification:** **local**.

### P7 — One ffmpeg spawn per GIF frame thumbnail, serially <a id="p7"></a>
- **Location:** `services/gifFrames.js:152-168` calls `extractImageThumb` per new frame hash.
  That is a sharp `metadata()` plus one ffmpeg process each (`services/ffmpegThumb.js:126-151`),
  called in a serial loop (199-204; `gifCutout.js:357-371`).
- **Fix:** thumb frames in-process with sharp (frames are small), or one ffmpeg call, with
  bounded parallelism.
- **Risk:** low-medium. **Note:** the ffmpeg path exists for 16K stills and Windows `windowsHide`
  reasons (`dos_and_donts.md` § Decoding a user image). GIF frames are capped at 4096, so sharp
  is safe here, but keep `limitInputPixels: false` and `autoOrient`.
- **Verification:** CPU-verifiable (time a 200-frame GIF import).

### P8 — Same GIF frames decoded several times
- **Locations:**
  - `applyMaskAlpha` decodes each frame 3× (`gifCutout.js:219-289`), and so does
    `blendEdgeColour` (`gifFrames.js:240-254`).
  - `buildGif` re-encodes every frame to PNG before ffmpeg and does not dedupe repeated hashes
    (373-383).
  - The client inverts and PNG-encodes every mask serially (`MpiGifViewer.js:710-734`) before
    posting them all as base64 JSON, although the server already has an invert step.
- **Fix:** decode once (`ensureAlpha().raw()`), cache per hash, and send masks un-inverted with a flag.
- **Risk:** medium (the mask polarity contract, MPI-859). **Verification:** CPU-verifiable server-side.

### P9 — Remote engine re-uploads every input on every run <a id="p9"></a>
- **Location:** `js/services/comfyController.js:1731-1733` → `/remote/upload/media` →
  `routes/remoteModels.js:595-647` `_uploadInSlices`. Models have a presence check; inputs do
  not, so re-running an i2v or v2v job re-sends the whole source video to the Pod.
- **Fix:** key uploads by `path|size|mtime` (or content hash, as local `stageMediaFile` does at
  `comfy.js:378-382`). Keep a podId+key → podPath map, or check presence first.
- **Risk:** medium (dual-engine; also check whether local static-filename caching relies on
  overwriting).
- **Verification:** the logic is unit-testable with a mocked `wrapperFetch`; the actual saving
  needs a **Pod**.

### P10 — Mask export: byte loop, sync PNG, base64 round trip
- **Locations:**
  - `MaskManager.js:1006-1028` `getFlat` writes 16.7M px byte by byte, then `toDataURL` encodes
    on the main thread.
  - `/comfy/stage-media-data-url` (`comfy.js:437-451`) base64-decodes, hashes the base64
    string, and writes the file even when the content-hashed target already exists.
- **Fix:** composite with the canvas or a `Uint32Array`, use `toBlob` with a binary POST, and
  skip the write when the target exists.
- **Risk:** low (server part), medium (client). **Verification:** server CPU-verifiable; client **local**.

### P11 — UndoStack snapshots whole layers per stroke start
- **Location:** `UndoStack.js:100-117`, a full-layer `drawImage` copy per layer per pointerdown
  (≈128 MB for the two 4096² mask layers). `_diffBox` (51-71) does two full `getImageData`.
- **Fix:** tile-level copy-on-write.
- **Risk:** high (undo correctness is load-bearing; `docs/masking-undo.md`).
- **Verification:** **local**. Only pursue if a profile shows pointerdown jank.

### P12 — Two renditions per image save = two decodes + two ffmpeg spawns
- **Location:** `projects.js:146-155` `writeImageRenditions` calls `extractImageThumb` twice.
- **Fix:** one ffmpeg call with `split` and two outputs (keeps the 16K-safe path), or one sharp
  pipeline with `.clone()` where the input is within sharp's safe range.
- **Risk:** low-medium. **Verification:** CPU-verifiable.

### P13 — `/system/stats` spawns `nvidia-smi` every 2 s, even on non-NVIDIA machines
- **Location:** `routes/system.js:25-33, 117-125`, polled every 2000 ms by `MpiMemoryMonitor`.
- **Fix:** skip it when `resolveDownloadConfig().gpu.vendor !== 'nvidia'` (already cached),
  and cache the result for the poll interval.
- **Risk:** low. **Verification:** the non-NVIDIA skip is unit-testable; the spawn overhead is **local**.

### P14 — `models/check` resolves dependencies serially
- **Location:** `routes/comfy.js:1074-1109` `_localModelsCheck` awaits three filesystem probes
  per dependency, one at a time.
- **Fix:** bounded `Promise.all`.
- **Risk:** low. **Verification:** CPU-verifiable.

### P-misc — Smaller items <a id="p-misc"></a>
- `nextSequence` re-reads the `Media` dir even when the counter is seeded (`projects.js:427-452`),
  despite its own comment.
- `backfill-media-derivatives` re-reads every sidecar on project open (1930-1941), right after
  `load-meta-batch` has read them.
- `migrate-project` always rewrites `project.json` (3805).
- `findProjectFolder` reads every `project.json` per `/project-templates` request (3831-3849).
  Delete it with [X4](#x4).
- `_sidecarIdFor` scans sidecars with no negative cache (212-227).
- All CPU-verifiable, low risk.

**Already efficient (no action):**
- Brush dabs recomposite only their box.
- The overlay is clip-rendered.
- Hot contexts set `willReadFrequently`.
- `stripImageMetadata` does not re-encode.
- Local staging hard-links.
- The stats poll has an in-flight guard.
- `/project-file` uses `sendFile`.

---

## 4. Type hints and docstrings on public functions

### T1 — JSDoc is written but never checked <a id="t1"></a>
- **Location:** `jsconfig.json:5` sets `"checkJs": false`. `// @ts-check` appears only in 11
  Playwright specs, never in app code.
- **Why:** the codebase carries 1,951 `@param {…}` tags across 260 files under `js/`. These are
  documentation only; a wrong type or a renamed parameter is never caught.
- **Fix:** adopt incrementally.
  1. Add `// @ts-check` to pure modules first: `js/utils/*`,
     `js/data/modelConstants/resolveModelDeps.js`, `js/data/commandRegistry.js`,
     `js/utils/promptReuse.js`.
  2. Add a CI step `npx -p typescript tsc --noEmit -p jsconfig.json` scoped to those files.
  3. Widen as files go green.
  4. Avoid enabling `checkJs` globally in one go; the component factory's dynamic `el.*`
     methods will produce hundreds of errors.
- **Risk:** low (type-check only). **GPU-free:** yes.

### T2 — Coverage: high overall, with specific gaps on central APIs
- **Overall:** 804 of 865 exported functions in `js/` (≈93%) are directly preceded by a block
  comment. This is a grep approximation: it counts any `*/`, and `//`-only comments count as
  undocumented.
- **Gaps that matter, because they are central and called from many places:**
  - **`js/utils/promptReuse.js`:** 6 of 11 exports have no block doc, including
    `buildPromptReusePayload` (117), `resolvePromptReuseMediaItems` (203),
    `buildGalleryPromptReusePayloads` (284) and `buildPromptReuseSettings` (392). These carry
    the strict "Current vs Original" contract from `state.md`.
  - **`js/services/projectService.js`:** 8 of 26 have no block doc: `chooseFolder`,
    `createProject`, `listProjects`, `openProject`, `updateProject`, `saveProjectSettings`,
    `applyPromptReuseSettings` and `deleteProject`. These are the project lifecycle and the
    sole-writer entry points.
  - **`routes/shared.js`:** undocumented exports include `stopComfyUI` (391),
    `ensureCuratedPythonDeps` (686), `getDefaultModelsRoot` (936) and the whole extra-folders
    cluster (982-1050: `normalizeExtraModelFolders`, `getExtraModelFolders`,
    `setExtraModelFolders`, `writeExtraModelPathsYaml`, `_normalizeExtraFolderPath`).
    - `_normalizeExtraFolderPath` must use `fs.realpath.native`, not `fs.realpath` (MPI-444).
      That fact lives only in `.claude/rules/comfy_engine.md`, where an editor of this
      function will not see it. It belongs in a docstring on the function.
    - `stopComfyUI` deliberately only kills a handle it owns (MPI-484). That is equally a
      contract worth stating at the definition.
  - **Smaller gaps:** `js/services/projectStatsService.js` (3 of 4 undocumented),
    `js/services/devUpdatesService.js` (3 of 5), `js/services/commandExecutor.js` (2 of 5).
- **Python:** the workflow generators and `registry.py` are fully annotated (`-> None`,
  `str | None`, `list[Path]`), and their docstrings are thorough. Nothing to add beyond [D6](#d6).
- **Fix:** add JSDoc with `@param`/`@returns` to the listed functions. Pair it with T1 so the
  new types are checked.
- **Risk:** low. **GPU-free:** yes.

### T3 — `routes/shared.js` is a grab-bag module
- **Location:** 1,293 lines exporting 46 symbols across five concerns: the project registry,
  the ComfyUI process, pip/curated deps, model roots and extra folders, node commit markers.
- **Why:** it makes ownership and docs hard and is the reason helpers like the media utilities
  in [D10](#d10) have no obvious home.
- **Fix:** split it into `projectRegistry.js`, `comfyProcess.js`, `pythonDeps.js`,
  `modelRoots.js` (`routes/modelRoots.js` already exists; check overlap) and `nodeMarkers.js`.
  Keep `shared.js` as a re-export barrel so no caller changes.
- **Risk:** medium (many requires; barrel keeps it mechanical). **GPU-free:** yes.

---

## Bugs found in passing

These are not cleanup, but they surfaced during the audit and are cheap to fix.

### B1 — Double URL-decoding of `/project-file?path=` <a id="b1"></a>
- **Location:** `routes/videoCrop.js:50` (verified):
  `decodeURIComponent(u.searchParams.get('path'))`. `URLSearchParams.get` already decodes, so
  this decodes twice. The same code is in `videoReverse.js:44`, `videoExtract.js:58`,
  `videoTrimInput.js:31`, `videoGif.js:53`, `gifMaker.js:97`, `gifMake.js:61` and `videoConcat.js:53`.
- **Effect:** a file named e.g. `100%.mp4` or `a%20b.png` either throws (caught → `''` →
  "not found") or resolves to the wrong path.
- **Fix:** the shared helper from [D2](#d2), which decodes once (`decodeProjectFilePath`).
- **Risk:** low. **GPU-free:** yes, with a node test using a `%` filename.

### B2 — Tool-option panels lose the last edit on close <a id="b2"></a>
- **Location:** e.g. `MpiToolOptionsUpscale.js:108-115` and `261-262` (verified). `destroy`
  calls `clearTimeout` on pending 200 ms persist timers instead of flushing them. Same in all 8
  panels listed under [D4](#d4).
- **Effect:** changing a setting and switching tool within 200 ms silently discards it.
- **Fix:** flush on dispose ([D4](#d4)).
- **Risk:** low. **GPU-free:** yes (desktop spec: change, then immediately switch rail, then reopen).

### B3 — Audio card duration can show `0:60` <a id="b3"></a>
- **Location:** `MpiGalleryGrid.js:1521` (verified):
  `` `${Math.floor(d/60)}:${String(Math.round(d % 60)).padStart(2,'0')}` ``. For d = 59.6 this
  gives `0:60`.
- **Fix:** round the total first, or use `formatClock`.
- **Risk:** low. **GPU-free:** yes.

### B4 — Flow Library uninstall toast lacks the MPI-1076 guard <a id="b4"></a>
- **Location:** `MpiFlowLibrary.js:1135-1137` vs `MpiModelManager.js:1678-1685`. The Flow
  version can report "uninstalled" when nothing was removed but files were kept.
- **Risk:** low. **GPU-free:** yes (unit test on the counting function).

### B5 — Non-cache-busted URL for fresh GIF output
- **Location:** `gifTransform.js:155` and `gifCutout.js:394` (see [D2](#d2)). A re-applied
  transform can show the previous render from cache.
- **Risk:** low. **GPU-free:** yes.

### B6 — History toasts are never destroyed
- **Location:** `MpiGroupHistoryBlock.js:480-486` `_showToast` mounts `MpiToast` but never calls
  `destroy()`, unlike `StatusBar.notify` (`statusBar.js:550-555`). That is 72 call sites. This
  is a small leak per toast; fixed by [D9](#d9).

---

## Suggested order of work

1. **H1, H2** (tooling) → then X2, X3 (the H2 output), X1. These are mechanical, low risk and
   unblock checks.
2. **B1–B6** with their tests. B1 and B2 are best done *as* D2 and D4.
3. **D5, D8, D6** (small shared utilities), then **D1**, then **D2/D3/D10** route by route.
4. **T1/T2** alongside each util touched (add `// @ts-check` as files are cleaned).
5. **P2, P14, P-misc, P7, P12, P13** (CPU-verifiable, low-medium risk), each with a before/after
   node benchmark.
6. **P1, P3** with the race-condition tests, then **D7, D9**.
7. **P4–P6, P9–P11** only after a **local** profile on your machine (and a Pod for P9) shows
   they matter.

Per `CLAUDE.md`, code changes need a kanban card moved to `doing` with `files.json` first. This
report is the input for those cards, not a substitute for them.
