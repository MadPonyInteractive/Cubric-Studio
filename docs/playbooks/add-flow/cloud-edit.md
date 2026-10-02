# A cloud model in a Flow's edit slot (`cloudEdit`, MPI-918)

Read with [any-of-models.md](any-of-models.md) (slots) and
[../../cloud-generation.md](../../cloud-generation.md) § Inside a Flow (how the two passes run).

A Flow whose graph has ONE local edit stage (a sampler fed by one `VAEEncode`, its prompt by one
`CLIPTextEncode`, decoded by one `VAEDecode`) can offer cloud models in that stage's slot. No
graph-file change and no node: the app prunes and swaps the graph around the cloud call.

## Wiring one

1. Find the three nodes in the API graph:
   - `input`: the IMAGE the edit model receives, right before its `VAEEncode` (usually the
     `ImageScaleToTotalPixels` that brings it to 1 MP);
   - `prompt`: the final STRING its `CLIPTextEncode` reads (the joined instruction, not
     `Input_Positive`);
   - `output`: the edit sampler's `VAEDecode`.
2. Check that everything after `output` is deterministic and loads no model (stitch, colour
   match, composite): pass 2 re-runs it on the cloud picture. A second model pass after the edit
   cannot be swapped this way.
3. Declare `cloudEdit: { input, prompt, output }` on the FlowDef and append the cloud ids to the
   edit slot's `models`, AFTER the local ones (`models[0]` stays the recommendation).
   - Nano Banana only where the edit takes ONE reference, and only after a live look: it
     failed on Draw It In and Outpaint and passed on Scribble (Fabio 2026-10-01).
   - A slot with `loras: true` keeps it: a cloud pick drops the rack by itself.
4. `npm test`. `tests/flow-cloud-edit.test.cjs` checks every `cloudEdit` spec still names its
   graph's edit stage, and that no Flow lists a cloud model without one.

## What the user and the agent get, with no extra code

- Offered only with a DeepInfra key saved. An installed local candidate always wins; a cloud one
  runs unpicked only when nothing local is installed.
- The slot label shows the price per run (`cloudEditPrice`), the card carries the billed cost.
- The agent's quote prices the Flow, so the in-app Yes card and MCP's `CONFIRM_COST` ask before
  each run, and its catalogue entry says `cloud`.

## Traps

- **Never a lazy switch in the graph.** ComfyUI validates every node an output reaches, so a
  local loader behind an `MpiIfElse` refuses the whole prompt for a user without that model.
- **Size.** Pass 2 fits the cloud picture to pass 1's size; a stitch or harmoniser downstream
  that resizes plates to the IMAGE's size depends on that fit. Outpaint, the Flow that had
  one, left the cloud on 2026-10-02 (Fabio, MPI-1011).
- **The cloud call sees pictures, never latents.** If the local edit samples from something it
  is not handed as an image (Object Stamp samples from the clean crop's latent with both
  references beside it, which is its clean-up), the cloud result keeps the seam and shifts the
  crop's colour. Leave that slot local (Object Stamp, Fabio 2026-10-01) or split the graph.
- **Two references** (no shipped Flow since Object Stamp left the cloud): tap each under its own
  title and collect by title. Pass 1's `Output_Display` urls arrive in ComfyUI's execution
  order, not yours.
