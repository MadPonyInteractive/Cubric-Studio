# MPI-1119 validation

## Built (2026-10-12, session "3D Scene 43")

- `docs/agent/3d-scenes.md` (new): what a 3D scene is for, the pieces in order (360 Panorama ->
  Convert to 360 pano -> workspace -> path -> 360 player), fly controls, laying and rendering a
  path (Steer the video, the long-path warning, ~half an hour on a mid-range card), the two
  plugins (Model Library, Plugins), Take picture, Convert to 360 video, and which section answers
  which user question. Labels checked against `MpiSceneBlock.js` / `MpiPanoVideoBlock.js` /
  `pluginsRegistry.js` (minus + bin buttons are icon-only; the card badge is a cube).
- `listCorpus()` lists it: `app:3d-scenes = 3d scenes`, 4,400 chars, read lazily.
- `docs/agent/flows.md` § 360 Panorama: one sentence pointing at app:3d-scenes.
- `services/agentLoop.mjs` `_appStateLine`: on `workspace.page === 'scene'` the line says "3D Scene
  workspace, inside the scene" (an image card) or "360 player, on the video" (a video card), keeps
  the entry path, tells Cosmo to read app:3d-scenes first, and drops the history view's Mask-tool
  sentence (the Scene page has none). The client already sent `page`; the server ignored it.
- Stale labels: `docs/README.md` 3D Scenes row "dev_mode" -> "ungated in 2.1"; `docs/scenes.md`
  "the dev-only 3D Scene plugin" -> "the 3D Scene plugin" (code: no dev gate on any scene path;
  only `flux-schnell-cloud` is devOnly).

## Checks

- New test `tests/agent-loop.test.cjs` "the Scene page names the workspace and its guide, never the
  Mask tool": failed before the change, passes after.
- `tests/agent-prompt-budget.test.cjs`: system prompt 10,984 -> 11,011 bytes (+27 = the new index
  line); SYSTEM_BUDGET raised with a ledger note, as the file asks.
- `npx eslint services/agentLoop.mjs` clean. `npm test`: 3270 tests, 3268 pass, 0 fail, 2 skipped.
- Not run: a live Cosmo turn (costs a DeepInfra call); the routing is proven at the prompt level.
