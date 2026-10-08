# MPI-1045 validation

## 2026-10-08 - code, tests, docs (session 9ac7a7c7)

- `npm test`: **2779 pass, 1 fail**. The one failure is `tests/remote-engine-assets.test.cjs`'s
  new MPI-1045 assertion, "qwen3vl-abliterated-clip must be an engineAsset, volume-installed on
  remote". Expected and correct: the flag goes in `js/data/modelConstants/assetDeps.js`, which
  MPI-936's live session claims (message 8a39bdab). The test turns green when that line lands.
- Re-targeted and green: `plugin-dep-gc` (runs over whichever plugins own deps; asserts no plugin
  owns `imageDescribe`), `shared-dep-uninstall-direction` (uninstall target now
  `plugin:ltx-video-upscaler`), `llm-service` (31, DESCRIBER_MISSING test removed),
  `job-display-name`, `flow-uninstall-guard`, `universal-nodes-remote`, `uw-partial-install`,
  `scene-convert` (4/4).
- `npx eslint` on every touched js/routes file: clean.
- `tests/desktop/llm-settings-remote.spec.js` updated (ComfyUI not greyed when an engine exists):
  4/4 passed on its own port alongside `no-engine-user.spec.js` (see MPI-1046 validation).
- Grep `image-describer|DESCRIBER_MISSING`: left only in history notes (MPI-310 incident comments,
  download-manager.md live incident) and the peer-held assetDeps.js / models.js comments.

- `docs/releases/UNRELEASED.md` Fixes: "Enhance and Describe work on ComfyUI without installing anything first" (Fabio asked for it as a fix). Checked against v2.0.1: both backends default to comfy, Describe returned DESCRIBER_MISSING, Enhance had no check and failed in the graph without the weight.
- Remote-only users (no engine, no Pod): removing the plugin gate un-greyed ComfyUI for them. Fixed in MPI-1046 (same file, ships in the same commit), verified there.

## 2026-10-08 19:50 - the flag landed

- Qwen 2.1 implementation 3 (MPI-936) released `assetDeps.js` (reply on message 8a39bdab) and
  rewrote the two `models.js` comments itself; they ride its MPI-936 commit.
- `qwen3vl-abliterated-clip` now carries `engineAsset: true` (+ comments).
  `node tests/remote-engine-assets.test.cjs`: exit 0.
- `npm test`: 2782 pass, 7 fail - ALL 7 in `tests/flow-describe.test.cjs`, an UNTRACKED file from
  the Video Edit session's work in progress (MPI-1036), testing code not written yet. None of mine.
- `npx eslint js/data/modelConstants/assetDeps.js`: clean.
