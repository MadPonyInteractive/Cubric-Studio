# MPI-777 - Animated mascots in the app

## What this is

The five Cubric mascots (Studio, Vision, Prompt, Audio, Video) now have animated clips, rolled
and reviewed in MadPony-Identity card MPI-78. This card wires them into the app. The directions
come from Fabio (2026-09-15/16); the design work stays in MadPony-Identity, the wiring happens
here.

**Source of truth for where every clip goes:**
`../MadPony-Identity/production/cubric-mascots/animations/placement.md` (spot map, playback
rules, clip index). Prompts and roll records sit next to it (`generating-card.md`, `states.md`,
`scenarios.md`). The clips are in the Vision project
`C:\Users\Fabio\Documents\Cubric Vision\Projects\Cubric Studio Mascots\Media\`.

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
