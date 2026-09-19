# MPI-827 — A flow run is invisible in the Gallery

Fabio, 2026-09-19: *"when I'm talking to the agent and the agent runs a flow, and I'm in the
gallery, I can't see what's happening. I'd like, in that case, to have the latents come into
the gallery because I'm not looking at the flow."*

Split out of [MPI-822](../MPI-822/brief.md) (Generate → Queue), same conversation.

## Root cause — deliberate, and its premise has expired

`submitFlowGeneration` passes **no `placeholderGroup`** (`js/services/flowService.js:182-199`).
The comment says why (MPI-306): *"the flow's own result pane shows the run, so a second
in-progress card in the gallery behind the overlay is noise."*

Everything else is already wired:

| Step | Where | Result today |
|---|---|---|
| Flow gen registers as `scope: 'gallery'` | `flowService.js:201` | ✅ it IS a gallery gen |
| `generation:started` adds it to `_myGenIds` | `MpiGalleryBlock.js:1650` | ✅ owned by the gallery |
| `preview:frame` resolves it by promptId | `MpiGalleryBlock.js:1678` | ✅ the frame arrives |
| `_firstRunningEntry()` finds it | `:1633` | ✅ it is the first running gallery entry |
| `_placeholdersForFirst()` → `[first.placeholderGroup]` | `:1636` | ❌ **undefined → `[]`, nothing mounted** |
| `_paintPreviewInto` → `grid.el.updatePreview(tempId, …)` | `:1669` | ❌ no card with that tempId — the latent lands nowhere |

So the latent already reaches the Gallery and is dropped for want of a card.

**The premise has expired twice over:**

1. An **agent-dispatched** flow has no overlay open at all — `agentDispatch.js` `_submitFlow`
   (`:313`) calls the same `submitFlowGeneration` with no frame mounted. There is no result
   pane, so "the flow's own result pane shows the run" is false and the run is invisible
   everywhere except the status bar.
2. After MPI-822 the user queues flow runs and walks back to the Gallery — same hole, reached
   from the UI instead of the agent.

Also worth noting: MPI-306's Phase 3 "Apply" step was removed, so a flow result now **commits
to the gallery on completion anyway**. The in-progress card is no longer a card for something
that might not land.

## Likely fix

Give a flow run its gallery placeholder like every other gen — build one in
`submitFlowGeneration` and pass it as `opts.placeholderGroup`. The flow pane keeps painting
its own latents by `tempId` (`MpiBaseFlow.js` `preview:frame`), and the Gallery paints the
placeholder; both surfaces can paint the same frame, neither is keyed on the other.

Decide (small, but decide deliberately rather than by accident):

- **Always, or only when no flow overlay is live for that run?** "Always" is one line and makes
  MPI-822's queued runs visible too; "only when hidden" preserves MPI-306's no-noise intent for
  the user standing in the flow. Recommend ALWAYS — the card lands in the gallery on completion
  regardless, so the placeholder is simply where that card is going to be.
- **Two-leg flows** reuse leg 1's tempId (`flowService.js:186-190`); one placeholder across both
  legs is probably right, but check what the gallery does when leg 1 completes mid-chain.

## Verify

Real check, not a unit test: run a flow from the **agent** while standing in the Gallery and
watch the latents paint on the placeholder card. `docs/testing-harnesses.md` and the
`cubric-vision` skill (`POST /connector/generate` with a `flowId`) cover driving it.

## Files (expected)

`js/services/flowService.js` — and only `MpiGalleryBlock.js` if the placeholder shape needs it.
**Overlaps MPI-822 on `flowService.js`** — the two are not parallel-safe with each other.
