# MPI-984 validation

## Gap (Fabio, 2026-09-29)

Paused on frame 103 of 192 in `imported_002.webm`, "edit this frame" would have edited frame 0:
the App state line named the open clip, never the playhead, and a clip sent as a picture is its
first frame (MPI-980). Fabio: make the agent understand it is in the video workspace and that
"this frame" means the current frame.

## Built (cb91e95ad)

- `MpiVideoControlBar.getFrame()` -> `{ index, count, paused }`, through the counter's own
  `_formatFrame`, so the numbers are the ones on screen ("0103 / 0192").
- `js/shell/activeFrame.js`: one-slot reader, the `activeMask.js` pattern; `MpiGroupHistoryBlock`
  publishes it beside the mask reader and withdraws it in `destroy()`.
- `agentService._workspaceForTurn` sends `frame`; `routes/agent.js` keeps it only as whole
  numbers (index >= 0, count > 0).
- `agentLoop._frameOnScreen` on the App state line: frame 0 -> the clip may go as the picture;
  any other frame -> "NOT the first", do not send the clip, ask for right-click Create snapshot
  and use the newest card. Playing -> "playing, now at frame N".
- Doc: `docs/agent-chat.md` § The open workspace.

## Evidence

- `tests/agent-loop.test.cjs`: "an open video names the frame on screen; only frame 0 may go as
  the video" (mid, first, playing, a still names no frame) and "a video frame survives as whole
  numbers; anything else is dropped". 20 related files: 330 pass, 0 fail, 1 skipped. eslint
  clean (also the pre-commit run).
- LIVE, Fabio, 2026-09-29 (full restart): imported_002.webm paused at 0105 / 0192, asked "edit this
  frame as a new image and remove the glasses from the man". The agent answered that it cannot edit
  a clip's frame directly and asked him to right-click frame 105 and choose Create snapshot; no run
  started. The frame number matched the counter. Fabio: "it works".
