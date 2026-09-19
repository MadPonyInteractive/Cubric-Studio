# MPI-827 Validation

**Verify mode:** user-ux — the brief says it outright: *"Real check, not a unit
test: run a flow from the agent while standing in the Gallery and watch the latents
paint."* Nothing in bare Node can see a latent land on a card.

## Automated — RUN AND PASSING, 2026-09-19

| Check | Command | Result |
|---|---|---|
| Full unit suite | `npm test` | **1444 pass, 0 fail, 1 skipped** (1445 tests) |
| Repo lint | `npm run lint` | **clean** |
| MPI-827 contracts | `node --test tests/flow-gallery-placeholder.test.cjs` | **4/4 pass** |

Proven RED on pre-fix code: all 5 of the flowService assertions fail against
HEAD's blob — no `placeholderGroup` in opts, no placeholder built, no `id: tempId`,
no `isGenerating`, and the stale MPI-306 comment still present.

## The one invariant this could have broken, checked

`previewClipPlayer.js`: **at most ONE player per generation may set `ownsFrames`**,
or one revokes blobs another is still looping (a measured 1298 ERR_FILE_NOT_FOUND
storm). Its doc block reasoned from "a Flow run deliberately mounts NO gallery
placeholder" — exactly what this card reverses.

Swept every `ownsFrames` site in `js/`. Only two set it true — `MpiGroupHistoryBlock`
(groupHistory scope) and `MpiGalleryGrid` (the gallery placeholder). The flow pane
and the float bridge both stay false. So a flow run now has **exactly one** owner
where it previously had **none**: the invariant holds, and a flow run's frames are
now freed by a retainer instead of living until page unload. Pinned as an assertion
in `flow-gallery-placeholder.test.cjs`.

## NOT proven here, stated rather than skipped

No flow was dispatched. Unobserved: that the card appears, that the latents paint on
it, and what a two-leg flow's gallery card does when leg 1 completes mid-chain. The
leg-2 collision question was answered by reading (a committed card takes a real group
id from the media commit, never the tempId), not by running it.

## What Fabio checks in the app

Stand in the Gallery, ask the agent to run a flow, and watch: a `Generating...` card
appears and its latents paint on it. Then the same from the flow frame — the card
appears in the gallery too, and the flow's own pane still paints its copy.
