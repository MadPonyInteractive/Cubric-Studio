# MPI-980 validation

## Asked (Fabio, 2026-09-29)

"Edit the first frame of this video" should work: use the start frame the clip's sidecar records
when it has one (full resolution, already in the gallery), else take the first frame itself. A
frame from the middle of a clip stays the user's job (Create snapshot). Searching the gallery for
a matching picture when the sidecar has none was rejected as overkill.

## Built (5e6b33d40)

- No new tool and no extra agent turn. `routes/connector.js` `_firstFrames` swaps a video ref in a
  picture slot before the job reaches the renderer, on `/connector/generate` (model ops and tools)
  and `/connector/quote` (so a paid edit is priced with the reference it will send). The in-app
  agent, MCP and the HTTP connector all pass through there.
- Start frame: `services/agentCards.mjs` `startFrameOf` finds the clip's sidecar in `Media/.meta`
  by the file it names and returns its `generationSettings.mediaItems` `startFrame`, only when the
  project still has that file.
- Else frame 0: ffmpeg writes one full-size PNG to a temp file, staged through
  `place-preview-asset` into the same project's content-addressed `.preview-assets` store.
- Agent text: in-app `list_cards` description and the MCP `media[].path` description say a video
  in a picture slot is its first frame and any other frame is the user's right-click Create
  snapshot. Tool schemas 17,249 bytes; `TOOLS_BUDGET` 17,200 -> 17,300.
- Flows are not swapped; the MPI-979 refusal still catches a video in a Flow's picture slot, with
  its "no tool exists" line removed.
- Docs: `docs/agent-chat.md`, `docs/mcp-server.md`, `.claude/skills/cubric-vision-generate/SKILL.md`.

## Evidence

- `tests/agent-generation-relay.test.cjs`, real router over a socket with a fake renderer:
  - "a clip whose sidecar names a start frame goes as that picture": the job the renderer receives
    carries the sidecar's picture url.
  - "a clip with no start frame goes as frame 0, full size, staged in its own project": a real
    64x48 mp4 from ffmpeg; the store is called once with the project folder, `.png`, and bytes
    that decode as a 64x48 PNG; the job carries the staged url.
- 35 test files touching connector, agentCards, agentLoop, mcp, generationControls, agentDispatch
  and the windowsHide spawn check: 512 pass, 0 fail, 1 skipped. eslint clean.
- The REAL store (stubbed in the unit test): a scratch script mounted `routes/projects.js` +
  `routes/connector.js` with a fake renderer and sent a 320x180 ffmpeg clip as Nano Banana 2 Lite's
  `inputImage`. The job carried `Media/.preview-assets/a99284a7...e2e3f.png`, a 320x180 PNG.
- LIVE, Fabio, 2026-09-29 (app restarted 12:55 on this code): asked the in-app agent for a video
  from the first frame of i2v_002.mp4 (H3 i2v_ms, made from edit_001.jpg). The new i2v_003.mp4
  sidecar names edit_001.jpg as its startFrame: the full-size original, not a frame grab. The agent
  had also read the card, so whether it sent the video (swapped) or madeFrom's ref is not visible;
  both land on the same file. The frame-0 path is covered by the tests and the real-store check.

## Decided (Fabio, 2026-09-29)

Frame 0 stays HIDDEN in `Media/.preview-assets`: no gallery card of its own. The result card's
history already shows what it was made from.
