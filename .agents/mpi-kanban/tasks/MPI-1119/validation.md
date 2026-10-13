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

## Shipped

- 5f4cdbeb0 pushed; CI run 38307863162 success (unit + desktop 1-4).

## Reopened (2026-10-12): the plugins-first question

Fabio: a user has no scene until they make one; the real first question comes from the Model
Library: "what are these 3D plugins, can I make 3D characters / objects?". The guide now opens
with the two plugins by their Library titles (3D Scene ~1 GB -> Convert to 360 pano; 3D Scene
path video ~20 GB -> Render path), says neither works without a 360 panorama, and has a
"What it is NOT" section (no 3D models/meshes/export; Character Sheet Flows for a character from
several sides; nothing for an object turned round). Cosmo cannot see plugins otherwise (no plugin
data reaches the agent). agent-corpus + agent-prompt-budget tests 6/6.

## Plugin descriptions (Fabio's yes, 2026-10-12)

- js/data/pluginsRegistry.js: 3D Scene -> 'Step inside a 360 panorama and fly around it in 3D. Adds "Convert to 360 pano".'
  (79 chars); 3D Scene path video -> 'Fly a camera through a 3D scene as a 360 video, then take pictures from any angle.' (82).
  The Library row (.mpi-plugin-row__desc) is one line with an ellipsis, so both were cut to the
  existing descriptions' 79-87 chars, purpose first. Not eyeballed in the app: a fresh profile opens
  on the 18+ consent dialog, which an agent does not accept. npm test 3268 pass / 0 fail; eslint clean.
- f46a52dd0 (guide) CI 38310800774 success; 8b0be7fb9 (plugin copy) CI 38311297705 success.

## Reopened again (2026-10-13): Cosmo's 360-video explanation

Live answer to "explain how a 360 video works" (Fabio): invented 'each point is a position plus the
direction you're facing', said Render path 'stitches' the points, called Take picture 'exact', dropped
2.39:1, improvised the 360 format, missed Convert to 360 video. Cause: the guide never said what a 360
picture is or how the video is made. Added: '360 picture and 360 video' section; 'How Render path makes
the video' (points = positions only, camera level facing travel - scenePath.js:77; rough pass then Wan
repaints every frame); Take picture 'never call it exact or high resolution'; a cheat-list line for the
question. agent-corpus + budget tests 6/6. Needs Fabio's re-ask to confirm.

## Routing fix (2026-10-13)

Re-ask "how does a 360 video work?" got a generic web answer: no read_knowledge call (index title
'3d scenes' never said 360; Docs rule read entries only for questions Cosmo could not answer).
Guide renamed docs/agent/360-and-3d-scenes.md (id app:360-and-3d-scenes, refs in flows.md, agentLoop
app-state line, agent-loop test). Docs rule: 'for a question about the app or something it does, first
read the App knowledge entry that covers it; if none does, say so and link'. New test in
agent-prompt-budget pins both. SYSTEM_BUDGET 11,046 -> 11,124 (+78, ledger note). npm test 3271 pass /
0 fail; eslint clean. Systemic budget/pointer discussion spun off as a chip (task_3a911564).
