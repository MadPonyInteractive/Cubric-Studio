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

## Brainstorm decisions (Fabio, 2026-09-29, session 726c00ac)
- **Storage: its own file per routine, two scopes, project or global** (like the agent notes' two homes, but NOT a note:
  notes are free text the agent tidies, merges and deletes under 50 / 4 KB, and a tidy could break a routine). Structured
  step list, every step validated at save.
- **Several cards run like a STACK run** (`docs/stacks.md`): each card runs the whole chain on its own; the finished cards
  land as ONE new stack (one card in -> one new card out). **Earlier steps stay as older History versions of each result
  card** (scroll back to the upscale-only version). Not one stack per step, not finals-only. The plan must prove a MODEL
  step can land as a new version of a routine-made card (stack History tools already version members).
- **Agent surface: a dedicated `routine` tool, actions `list` / `save` / `run` / `delete`.** Run goes through this tool
  too, not `generate`, so a weak model learns one rule: routine things = the `routine` tool. Fabio's reason: users will ask
  what routines exist and to delete or create one, and less capable models fail when it is not straightforward.
  - **Steps are `generate` args** (the args the agent already knows); no new step language.
  - **Tool description very short and straightforward** (Fabio). Target ~350 bytes (a 585-byte draft measured; the
    "read the guide before save" rule moves out of the description into a refusal, as model guides gate today). The
    tool budget in `tests/agent-prompt-budget.test.cjs` rises by that much (~90 tokens a turn); system prompt unchanged.
  - **Save is the only expensive action** (guide read + writing the steps). Run / list / delete are one small call each:
    "run my X routine on these" = one `routine run`, the app does the rest, like a generation.
  - Detail in an `app:routines` knowledge guide, read on demand (0 bytes on a normal turn).
- Agent suite: 4 new cases (list, save from a plain description, run on several cards as one call, delete).

## Order
Brainstorm done 2026-09-29; next is the plan.
