# MPI-970 brief: saved operation chains ("workflows")

## The idea (Fabio, 2026-09-29)
A user wants to run the same sequence on one or more cards: upscale, then detail the face, then a style on a chosen
model, then a Flow, and so on. The in-app agent is the way in:
- The user asks the agent to save a chain, in the project or globally. The agent can also OFFER to save one after the user
  repeats the same steps.
- Asked "what is a workflow?", the agent explains: a named list of operations it applies in order.
- **Fabio's refinement:** the saved chain is a SCRIPT the app runs. The agent writes it once; after that it hands over the
  media and the chain's name in ONE call. No reading the chain and stepping through it turn by turn, paying tokens per step.

## What the first look found (session 4143bc2a, not yet a plan)
- **A script is a list of app operations, never code.** Each step: op, model, settings, and which output feeds the next step.
  Code the model writes and the app executes would let anything the model reads (a web page, a note, a file name) run on the
  user's PC. A declarative step list keeps the whole thing inside what `generate` can already do.
- **The app runs the chain, not the model.** A runner (the batch path from MPI-941 Phase 1 is the nearest code) gives each
  card step 1, feeds the result to step 2, and so on. It waits for slow steps (video, Flows) ITSELF, so a chain does not
  depend on the agent's wake turn to carry on, which was the weak point of the step-by-step version.
- **Checked when saved:** every op exists and every setting is legal (the same checks `generate` makes today), so a broken
  step fails at save time and not on image 40 of 50.
- **Agent token budget is full** (system prompt 10,084 of 10,150 bytes; tool schemas 17,158 of 17,200, 2026-09-28). A new
  tool does not fit as things stand: either the chain rides an existing tool (`generate` with a chain name, like the no-model
  tools ride it), or Fabio raises the budget. How to save and run chains goes in a knowledge guide read on demand (0 bytes on
  a normal turn).
- **Name clash:** "workflow" already means a ComfyUI graph across the app, and the paid Gumroad Flows are sold as
  "workflows". Another word for users is worth deciding (e.g. "routine").
- **Beyond the agent:** a saved script could also run from the gallery with no agent at all (select cards, run a chain).
- **Tests:** the runner is plain code, so unit tests. The agent suite gains 2 or 3 cases (save a chain from a description
  with the steps in order; "run X on these" as one call). Every new case marks all model scores "(older tests)" until re-run
  (~$0.10 a DeepSeek run).

## Decided (Fabio, 2026-09-29)
- **Name: "routine".** ("Workflow" stays the ComfyUI graph and the Gumroad Flows.)
- **A routine that needs something missing does not run.** Before any step starts, every model and Flow it names is
  checked; if one is not installed, nothing is dispatched and the agent tells the user which one ("This routine needs
  Klein 9B, which is not installed"), model or Flow alike. Checked at run time, not only at save: a model can be removed
  after the routine was saved.
- **No agent-free entry point in this card.** Running a routine from the app without the agent comes later, and NOT as
  gallery clutter: a separate overlay or similar, to be designed then.

## Order
Brainstorm with Fabio first, after MPI-941 closes. Still open: where a routine lives (a project note, a global note, or its
own file); a routine across several cards that must stay together (a set) versus one routine per card; how it rides the
full agent budget (a `generate` field, or a raised budget).
