# MPI-769 - GIF history workspace

Umbrella: MPI-757 (phase 2, parallel with MPI-770). Read `tasks/MPI-757/plan.md` first; its
decision table is settled. **Needs MPI-768** (frame store and builder).

## Scope

1. **Per-kind table.** Today the block picks its viewer with `isVideo = _group.type === 'video'`
   (`MpiGroupHistoryBlock.js:252`, also branching `entry-selected`) and its tools with
   `TOOL_LISTS = { image, video }` (`MpiHistoryTools.js`). Replace both with one table
   `{ image, video, gif }` -> viewer + tool list, so audio later is a row. A GIF card (MPI-759's kind)
   opens in `gif` mode. Keep the change surgical: image and video behave exactly as before.
2. **GIF viewer** (centre slot). Shows the FULL-COLOUR frames, decoded at the viewer's size with a
   small cache around the current frame, so a long 4K GIF never loads every frame at full size. A
   **GIF preview** toggle swaps in the built `.gif` (256 colours, edge colour) as a plain `<img>`.
3. **Control bar** under the viewer: play/pause, step, frame counter, in/out range (for Trim,
   MPI-772). Read `js/components/Organisms/MpiVideoControlBar/` first: reuse it if its API takes a
   frame count with per-frame delays; otherwise a sibling bar that looks identical.
   `#controls-mount` is shell-level, directly below `#prompt-box-mount` (docs/workspaces.md, MPI-731).
4. **Frame strip** (Fabio's design): full app width, directly above the play button and scrub bar.
   A fixed centre marker; the current frame always sits under it and the strip slides as you play
   or scrub. Click a thumbnail to jump, drag the strip to scrub. Renders only thumbnails in view.
5. **Staged strip edits.** Drag a thumbnail to reorder, select thumbnails + Delete to drop. Edits
   stage with a pill showing the change count and two buttons: **Update** rewrites the current
   entry's frame list, **Apply** saves it as a new entry. Neither writes new frames.
6. **No PromptBox** in `gif` mode (no model generates GIFs in v1).

Tool panels themselves land in MPI-771/772/773; this card ships an empty-but-routed `gif` tool list.

## Rules to read before building

Component factory + BEM (`.claude/rules/components.md`, `dos_and_donts.md`), teardown
(`destroy()` before clearing a mount), hotkeys through `Hotkeys.bind` + `hotkeyRegistry.js`
(frame step, Delete), `docs/workspaces.md`, `docs/video-player.md` for the frame-index law.

## Done when

A GIF card opens in `gif` mode; play, step and scrub keep the strip centred on the right frame;
reorder + delete stage, Update rewrites the entry and Apply adds one; image and video modes pass
their existing specs unchanged. Fabio eye-checks the strip.
