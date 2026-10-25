# The peeking mascot — every Flow gets one, nobody wires it

> Origin: Storyboard's Cosmo peek (MPI-1231), widened to every Flow in MPI-1292 (Fabio,
> 2026-10-25). Code: `MpiBaseFlow.js` `_peekCast` / `_syncPeek`; CSS `.mpi-base-flow__peek`.
> Clip framing and the app-wide spot map: `docs/mascot-placement.md` (the Flows row).

While a Flow works, a mascot's head pops up along the frame's bottom edge, one peek after
another at a random spot, a different clip each time. The FRAME does it, so a new Flow gets it
for free. What the Flow declares decides **who** peeks — get those declarations right and there
is nothing else to do.

## Who peeks

| The Flow is… | Mascot | Decided by |
|---|---|---|
| writing a prompt (the Enhance button, or Generate's auto-enhance step) | **Lingo** (`prompt`) | an enhance declaration (`action: 'enhance'`, [prompt-enhance.md](prompt-enhance.md)) |
| planning with the agent | **Cosmo** (`studio`) | that declaration's `runsOn: 'agent'` |
| generating a picture | **Prism** (`vision`) | FlowDef `mediaType: 'image'` |
| generating a video | **Reel** and **Vinyl** taking turns (`video`, `audio`) | `mediaType: 'video'` |
| generating audio | **Vinyl** (`audio`) | `mediaType: 'audio'` |
| idle | nobody | — |

Writing wins over generating: during Generate's enhance step Lingo peeks, then the output's
mascot takes over. A new mascot swaps in at the end of the current clip, never mid-clip.

## The rules for a new Flow

- **`mediaType` is what the Flow MAKES** — it already colours the frame (`data-accent`), and now
  it also picks the mascot. A video Flow that starts from a picture is still `'video'`, so Reel and
  Vinyl peek through its whole run, picture step included.
- **A driver Flow peeks only if its jobs reach the frame.** The peek follows `_syncRunning`, so
  a `driver` that skips `frame.onJob(tempId, done)` shows no mascot, as well as no latents and no
  Stop ([../README.md](../README.md) § Driver Flows).
- **Do not add a mascot of your own** to a Flow's fields or steps. One peek layer, owned by the
  frame; a second one would fight it for the same edge.
- **A new clip in a mascot's pool must be measured.** Standing clips hang by the head's rest row
  (187 of 620, the same for all five mascots); a clip whose hands rise far above the head shears
  in the window. The tallest kept is Cosmo's idle-3 (row 146); Lingo's idle-3 (row 32), happy-1
  and heads-up are left out. Re-measure before adding any clip to `_PEEK_CLIPS`.
- Reduced motion: no peeks. The busy labels and the sweep already show the Flow is working.

## Verify

Run the Flow live once and watch the bottom edge: Lingo while the prompt is written (if the Flow
enhances), then the output's mascot while it generates, and nobody once it ends
([../05-verify.md](../05-verify.md)).
