# MPI-795 validation

## Root cause

`_enqueueToolUpdate` (js/services/projectService.js) seeds `toolSettings.crop` as `{}` on the first save and writes only the keys the user touched. `getToolSettings` returned that partial entry INSTEAD of the defaults, so `_runCrop` saw `res_w`/`res_h` as `undefined` for any dimension left at the value the panel displayed. `outW > 0 && outH > 0` was then false in `services/imageCrop.js`, and the crop was written at the box's own size. Separately, Apply read the persisted copy, which trails the panel by 500ms (200ms panel debounce + 300ms queue), so Apply straight after an edit sent the previous value.

## Fix

- `getToolSettings` merges the stored keys over the defaults. Callers swept: 20 call sites in 18 files under js/ (counted at the parent commit), all compatible (the coercing panels already filled gaps; projectService/commandExecutor/MpiModelSettings pass no defaults and get a copy of the same content).
- The crop panel sends its live values on `apply { kind, settings }` (image and video-save). The block passes them to `viewer.el.runCrop(settings)` and `_handleCropSaveVideo(settings)`. Neither re-reads the project any more. The unwired `el.getDivisibleBy` hook was replaced by this.

## Evidence

- `tests/tool-settings-defaults.test.cjs`: 2/2 pass. Both assertions fail on the old one-liner (partial object returned; shared defaults ref returned).
- `tests/desktop/crop-resize-output.spec.js` crop test, real Electron (E2E profile, own port), real PNG on disk, output measured with sharp:
  - Fixed tree: PASS. Width typed 200, height untouched, box resized to 100x540, Apply -> 200x1080. Height saved 150, edited to 120, Apply straight from the field -> 200x120.
  - Pre-fix code (detached worktree at 6d0f8f0c, same spec): FAIL with `Received {width: 100, height: 540}`, the exact bug reported.
- `npm test`: 1235 pass, 0 fail (before the release-note edit; re-run at commit).
- eslint on every touched JS file: 0 errors.
- `tests/desktop/history-modes.spec.js` still passes.

## Follow-up (same session)

- User verified the crop fix manually and approved the rule-map edit. `.claude/rules/component-mounts.md` now describes the RESOLUTION type, the fill colour, the `settings` payload (on `image` and `video-save` only), and the Resize MP/SCALE types. It also corrects the resize Apply path to `enqueueGeneration`.
- The claim auditor found 17 claims proven. It flagged three: the caller count above (was "14"), `settings` on `video-snapshot` (it has none), and `startGeneration`. All three were re-checked in the code and fixed.
- User-approved doc heal: `docs/testing-desktop-specs.md` trap 6 records that PROMPT mode has no canvas, so `getSourceElement()` is `null` there (it cost this session one failed spec run). The trap count in `docs/README.md` and `docs/testing.md` was updated to six.
