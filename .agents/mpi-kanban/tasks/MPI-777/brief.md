# MPI-777 - Animated mascots in the app

## What this is

The five Cubric mascots (Studio, Vision, Prompt, Audio, Video) now have animated clips, rolled
and reviewed in MadPony-Identity card MPI-78. This card wires them into the app. The directions
come from Fabio (2026-09-15/16); the design work stays in MadPony-Identity, the wiring happens
here.

**Source of truth for where every clip goes: [`docs/mascot-placement.md`](../../../../docs/mascot-placement.md)**
(spot map, playback rules, clip index). It moved into this repo on 2026-09-20: MadPony-Identity
made the artwork, where it goes in the app is this repo's business. The prompts and roll records
stayed there (`../MadPony-Identity/production/cubric-mascots/animations/`: `generating-card.md`,
`states.md`, `scenarios.md`, `transitions.md`, `connecting.md`) and are only needed to re-roll a
clip, not to wire one.

## The assets, as actually delivered (2026-09-20)

**Read [`docs/mascot-gif-manifest.md`](../../../../docs/mascot-gif-manifest.md) before looking
for a file.** The conversion to GIF lost every name: a card is `gif_NNN` and its file on disk is
`gif_<hash>.gif`, and nothing in either says which clip it is. The manifest is the only join
between a file and its slot in the clip index.

- **103 finished GIFs**, in their own Vision project:
  `C:\Users\Fabio\Documents\Cubric Vision\Projects\Cubric Studio GIFs\Media\`. Not the
  `Cubric Studio Mascots` project, which is the working project and holds the source video cards,
  the pre-cut GIFs and the rejects.
- 10 fps, original size, loop forever. 84 are background-free (BiRefNet, 1px shrink); the
  **19 transitions are opaque on pure black and must stay that way** — they composite with CSS
  screen blending, which is what keeps their soft smoke edges. Masking them hardens them.
- Both facts were verified on the pixels, not read off a doc.

**Three Studio slots have NO finished clip** and must not be wired as if they exist:
Happy head pop (`i2v_015`), **Failed (`i2v_016`)**, landing no projects (`i2v_042`). Failed is the
one that bites: every other mascot has one and Studio does not.

**The connecting loops are mixed sizes and mixed shapes.** Three are 1536x640 (2.4:1) and
screwdriver is 1920x768 (2.5:1). Fit them on HEIGHT and accept the width difference; do not
stretch either to match.

**Format is not settled.** GIF alpha is 1-bit, which is fine on flat vector art with thick
outlines. The intended final format is VP9 alpha WebM, and **this app has no alpha WebM export
yet** — so either the GIFs ship as they are, or that export is built first. That is the open
question on this card's assets, not whether the clips exist.

## Split of work

- **MadPony-Identity:** decides where each clip goes, when it shows and how it behaves; cuts the
  clips out and converts them once this app's GIF tooling (MPI-757) can do it.
- **Here:** everything in code.

## Directions (Fabio)

1. **One shared clip queue.** Any spot that chains clips uses one utility: a pool of clips per
   state, random or in order, looping or not, swapping at the end of a clip. No per-spot timer
   code.
2. **Landing hero crew** (`js/shell/heroCrew.js`): idles in random order at rest, a random greet
   on hover (two per mascot), the ambient random greet kept, a random happy on click. Clips play
   to their end (today's timers cut greet at 1.5s and happy at 1.4s). **No walking** on the
   landing: they stand in a row and would bump into each other.
3. **The prompt box top edge is the mascots' ledge** (`MpiPromptBox`).
   - Agent mode: **Studio is there the whole time**, as the user's companion. It is the only
     mascot that never leaves. Idle x3, agent listening, agent thinking, agent answer ready.
   - Other modes: the selected model's mascot visits. Image model -> Vision, video model ->
     Video. It peeks up over the edge once on model selection, then comes back now and then at a
     random spot inside a fixed central zone, clear of the image chips and operation buttons.
   - The head peeks are head-only and cut by their own bottom edge: they need CSS to sit behind
     the prompt box edge. They play once and leave, so they do not need to loop.
4. **Flows** can show mascots too; it is Audio's only home today. Not specified yet.
5. The rest of the spot map in `placement.md` (Generating card, float latent window, toasts,
   empty states, engine starting, update ready, job cancelled) follows once the queue exists.
