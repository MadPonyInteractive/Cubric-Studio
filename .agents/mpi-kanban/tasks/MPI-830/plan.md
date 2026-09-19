# MPI-830 — Agents can use the GIF workspace (the connector's GIF surface)

Umbrella: MPI-757. Sibling cards MPI-759 / 760 / 768 / 771 / 772 / 773 built the
workspace; none of it is reachable from outside the UI.

## Current State

Measured 2026-09-19, before any edit:

- `routes/connector.js`, `services/agentTools.mjs`, `services/agentLoop.mjs` and the
  `.claude/skills/cubric-vision*` family carry **zero** GIF surface.
- What exists is raw, undocumented HTTP: `/gif/make`, `/gif/maker`, `/gif/entry`,
  `/gif/ensure-frames`, `/gif/preview`, `/gif/crop`, `/gif/resize`, `/gif/to-video`,
  `/gif-cutout/source`, `/gif-cutout/apply`.
- **Those routes cannot land a gallery card on their own.** They write the `.gif` and
  its sidecar and stop; the GROUP is created in the renderer (`MpiGalleryBlock.js:436`
  `addGroup`, the History Block's `_postGifEntry`), and `routes/gifMake.js:23` says so.
  `routes/connector.js:40` states the rule: while a project is open the renderer owns
  `itemGroups` and writes the whole array back on every save, so a server-side
  `project.json` write is silently overwritten.
- The cut-out's masks are produced renderer-side too: `runGifCutoutTrack()`
  (`js/services/commandExecutor.js:1070`) dispatches through `getEngine()`, and
  By colour is canvas code (`js/utils/colourKeyMask.js`).

So every verb goes over the connector's existing renderer job channel
(`_dispatchToRenderer`, `routes/connector.js:321`) — the same path `generation.submit`,
`project.open` and `card.rename` already take. A server-side mask producer was
considered and rejected: it would be a second engine-dispatch path, which the
`connector.js` header forbids, and it would reopen the local/remote engine twin trap.

## Decisions (Fabio, 2026-09-19)

1. **Connector first.** The in-app agent's tools (`agentTools.mjs`, `agentLoop.mjs`)
   are the in-app agent session's job, not this card's. This card stops at the HTTP
   surface + the skill docs. The CLI is generated from the HTTP surface.
2. Verb list approved as briefed: `make`, `edit`, `cutout`, `to-video`.
3. **Out of v1:** By colour (renderer canvas, and largely redundant with
   `background`), SAM3 object chips (an agent cannot read the numbered preview
   video), the Mask Brush, and per-frame / selected-frame scope.
4. Masks handed to `/gif-cutout/apply` stay **white = keep**. Every display flip in
   the workspace is `MpiGifViewer`'s and never reaches a caller.

## The surface

`POST /connector/gif/make`      `{ itemIds: [>=2] }` or `{ videoItemId, fps, sizePreset?, loop?, trimIn?, trimOut? }`
`POST /connector/gif/edit`      `{ itemId, fps?, loop?, trim?: {in,out}, output?: {colours,edgeColour,maxEdge}, resize?: {width,height}, crop?: {x,y,width,height,fill?} }`
`POST /connector/gif/cutout`    `{ itemId, method: 'background'|'name', prompt?, adjust?, invert? }`
`POST /connector/gif/to-video`  `{ itemId, background? }`

Envelope is the connector's: `{ ok: true, ... }` / `{ ok: false, error: { code, message } }`,
HTTP 400 only for a malformed body.

## Steps

1. `routes/connectorGif.js` — new route file (precedent: `gifMake.js` / `gifMaker.js` /
   `gifCutout.js` each own one). Static validation only, then `_dispatchToRenderer`.
   Needs `_dispatchToRenderer` exported from `routes/connector.js` (a one-line export
   edit) and the router mounted in `server.js`.
   **Verify:** `tests/connector-gif.test.cjs` — a malformed body is 400 per verb, a
   well-formed one reaches a stubbed dispatcher with the payload asserted.
2. `js/shell/gifJobs.js` — new renderer module, the four handlers. Resolves
   `state.currentProject`, POSTs the existing GIF routes, lands the card through
   `addGroup` / `appendToHistory`. Registered by ONE line in
   `js/shell/agentDispatch.js`'s `_HANDLERS` (that file's header says to keep it
   dumb, so the work lives in the new module).
   **Verify:** `tests/connector-gif-jobs.test.cjs` over the handler module with a
   stubbed fetch and project state.
3. `.claude/skills/cubric-vision-gif/SKILL.md` + a line in the family list in
   `.claude/skills/cubric-vision/SKILL.md`; `resources/cubric/connector-manifest.json`
   gains the capability; `docs/gif.md` gains a short "From an agent" section.
   **Verify:** re-read, and `npm run release:check` if it covers the manifest.

## Verification

**Verify mode:** auto

`node --test tests/connector-gif.test.cjs tests/connector-gif-jobs.test.cjs`
plus the existing GIF suites (`tests/gif-frames.test.cjs`, `tests/gif-make.test.cjs`,
`tests/gif-preview.test.cjs`) to prove nothing under them moved.

A live end-to-end run against a real app instance is worth doing once the routes exist,
but it needs the user's own app (only it has an engine and an open project) — offer it,
never drive `:3000`.

## Plan Drift

(none yet)
