# MPI-757 - GIF workspace: frames, cut-out, Make GIF, GIF Maker

Umbrella created 2026-09-14, redesigned in a brainstorm with Fabio on 2026-09-14/15. Every
decision below is his and is not re-opened in the member cards.

**The member cards stay on the board.** This card carries no code. Each member closes when its
phase lands; this umbrella closes when the last one does, and its `validation.md` then records
the ordering and anything left behind.

## Current State

**2026-09-15:** brainstorm DONE, board restructured, no code written. Every member card has a
`brief.md`; all sit in `todo` (MPI-768 `planned`, the rest `blocked` on their phase). **Next:** run
`mpi-create-large-plan` for MPI-757 covering all eight members. Build on this file: the decision
table and phase order below are settled, so the large plan adds investigation, ownership and
parallel batches rather than re-opening decisions. The member briefs name the files and checks to
verify first (MPI-771's two engine checks especially).

## What we are building

GIF becomes its own kind with its own history workspace, the way image and video have theirs
(audio and other kinds will follow the same shape later). A GIF entry is full-colour frames plus
a frame list; the `.gif` is BUILT from them, so nothing downstream (video, saved frames, the
cut-out) ever passes through 256 colours.

## Decisions (Fabio)

| # | Decision |
|---|---|
| 1 | No background removal on video. GIF only. (MPI-758 closed as rejected; its `validation.md` keeps what it found.) |
| 2 | GIFs open in a dedicated GIF history workspace, a third mode beside image and video. Viewer and tool list come from one per-kind table so audio is a row later. |
| 3 | V1 tools: Crop, Resize, Trim, Speed, Reverse, Loop count, GIF output, Save frame as image, GIF to Video, and the cut-out. Reorder and delete frames happen on the strip. |
| 4 | Transparent output: on/off GIF alpha plus an **edge colour** that soft edges blend into before the cut. Edge colour lives in GIF output, not in the cut-out. |
| 5 | Gallery: still until hover, hover plays. GIF gets its own icon in the card chip and the filter panel. |
| 6 | Make GIF from a gallery selection: one click, click order, defaults, opens in the workspace. Plus a reorder capability (now the strip). |
| 7 | Frames are the source of truth, full-colour, content-addressed. Deleting frees frames nothing else uses. |
| 8 | Make GIF keeps full resolution with no prompt. The built `.gif` defaults to 1024 on the longest edge. |
| 9 | Frame strip: full app width, above the play button and scrub bar, current frame at the centre marker; it moves as you play or scrub. |
| 10 | Strip edits stage; **Update** rewrites the current entry, **Apply** saves a new one. |
| 11 | Cut-out = SAM3 by name with video tracking, Mask Adjust across frames, Invert, cut into alpha. No BiRefNet. No batching in v1: Fabio masks 15 s 24 fps videos with SAM3 with no memory issue. |
| 12 | The agent authors the SAM3 GIF graph itself, modelled on the existing SAM3 graph (explicit permission, 2026-09-15). |
| 13 | GIF Maker (video workspace) creates a new GIF card, not a history entry in the video card. |

## Members

| Card | What it is | Phase | Depends on |
|---|---|---|---|
| MPI-768 | GIF frames store and builder (server foundation) | 1 | nothing |
| MPI-759 | GIF as its own gallery asset kind | 1 | MPI-749 landing |
| MPI-769 | GIF history workspace (viewer, control bar, frame strip) | 2 | MPI-768 |
| MPI-770 | Make GIF from selected images | 2 | MPI-768 |
| MPI-771 | GIF cut-out with SAM3 by name | 3 | MPI-769 |
| MPI-772 | GIF timing tools and output | 4 | MPI-769 |
| MPI-773 | GIF transform and export tools | 4 | MPI-769, after MPI-772 |
| MPI-760 | Export GIF becomes GIF Maker | 5 | MPI-768, MPI-769 |
| ~~MPI-758~~ | Remove Background on video | closed | rejected 2026-09-15 |

## Phase order and why

1. **MPI-768 + MPI-759 in parallel.** Disjoint files: 768 is server routes and utils, 759 is the
   gallery grid and kind table. 759 waits for MPI-749 (in `doing`), which owns
   `js/utils/assetKinds.js`, `MpiGalleryGrid.{js,css}`, `js/utils/icons.js` and `docs/gallery.md`.
   759 matches legacy `.gif` items by extension, so it does not need 768 to show the kind.
2. **MPI-769 + MPI-770 in parallel.** Both need 768's frame store and builder. 770 lives in the
   gallery (context menu, `MpiGalleryBlock`), 769 in the history block, so they do not collide.
   770 can land before 769 and simply open its card later.
3. **MPI-771 first of the tool cards**: Fabio rates the cut-out the most valuable v1 tool.
4. **MPI-772, then MPI-773.** Both add panels to `MpiHistoryTools.js` and handlers to
   `MpiGroupHistoryBlock.js`, as does 771. Run them one after another, or claim and stage by hunk.
5. **MPI-760 last.** It touches the same two files for the video mode, and its new card opens in
   769's workspace.

## Later, not carded

- Animated WebP output for soft transparency (in-app mascots with soft shadows, for example).
- SAM3 masks for anything beyond the cut-out (for example per-frame regeneration).
- Background removal on video (see MPI-758 `validation.md`).
