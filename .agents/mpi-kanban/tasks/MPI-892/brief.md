# MPI-892 Brief

Each Flow says how the in-app agent (Cosmo) uses it, and Cosmo can open a Flow filled in on the
user's screen instead of running it.

## Where it came from (2026-09-22, the card's original text)

UMBRELLA: MPI-889, phase 3 (after MPI-890 and MPI-891, both done). Fabio: "There are flows that
might be hard for the agent to use, and the user could change some things in what the agent
added to the flow ... if the agent is going to use a flow, it might as well open the flow and
show the user at least the last stage when the latents are coming in." It answered MPI-877's
open question (should the agent RUN `detail` and `inpaint`, or teach the user?) with a third
shape: FILL AND HAND OVER. The card also said to settle, first, the contradiction between the
Duration rule ("you never speak first") and the wake turn `_maybeDrained()` fires.

## Reshaped by Fabio, 2026-09-30

A single "Set it up / Run it / Not now" box on every Flow run was proposed and set aside. His
sort of the Flows, per Flow:

| Cosmo runs it, no questions | Cosmo opens it, the user finishes | Cosmo fills it, the user checks and presses Generate |
|---|---|---|
| Character Sheet, Outpaint, Extend Video, Add Foley, Upscale Video, Head Swap, Stems, Sound & Music, Drama Box, Text to Speech, Voice Changer | Draw It In and Scribble (the user draws), Object Stamp (Cosmo loads the pictures, the user places the object) | Song |

His words: "these three flows need user interaction. The agent is not going to draw stuff on a
canvas ... the agent would open them up at the first stage to let the user draw stuff in."
Object Stamp: "if supplied with the correct images, could add the images to it and let the user
place the object." Instructions only "if the user needs it or asks for it". Head Swap: Cosmo
runs it; "only if the result is not satisfactory, then the user can try it." Drama Box / Text to
Speech / Voice Changer: a missing voice sample means "You didn't provide the voice sample. I can
open the flow for you."

Decisions (Fabio yes to all three, 2026-09-30):
1. One optional setting per Flow says where the Flow opens; no setting = Cosmo runs it.
2. Song opens at its last step with Cosmo's lyrics and style filled in; the user presses Generate.
3. The Character Sheet head step split is a separate card: MPI-997.

## The money concern this answers

Flows never use paid cloud models (they run on the local GPU or a RunPod Pod; paid models have
their own spend card, MPI-876). A failed long Flow on a Pod wastes Pod time. Covered by: the
existing pre-flight refusals (not installed, required media, box not measured, frame), the view
moving to the run (MPI-891) so the user can stop it, and hand-over for the Flows the agent cannot
fill.

## Settled first: the Duration rule is the stale one

Wake turns shipped with MPI-870 (`agent:drained` -> `/agent/wake`, `canWake`, capped at
`MAX_WAKES_IN_A_ROW`). The Duration rule's "you never speak first, and a result reaches you only
when the user writes again" predates them. The rule's sentence goes; the wake stays.

## Noticed

- 2026-09-30, Fabio's run (Kaiju project, edit_009 -> 011): Cosmo redid a two-reference Klein
  edit twice on its own, because the describer read edit_009's lizard (rising behind the bow) as
  "sits on the bow". The Chaining rule's "look at it and redo it if it came back wrong" has no cap
  and trusts one text description; Fabio liked edit_009 best. Fabio's call whether a redo on a
  single-step ask should ask first.
