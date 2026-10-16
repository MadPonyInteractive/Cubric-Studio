# Cosmo, MCP and the Infinite Video Flow (DESIGN)

> Part of [README.md](README.md).

## Cosmo is a helper, the Storyboard is fully editable

Everything Cosmo can do, the user can do by hand in the Storyboard, and an outside agent can do
over MCP. One Story recipe, three writers (see [data-model.md](data-model.md)).

Cosmo's director work:
- Turn an idea into story → scenes → shots → dialogue, scaled to `targetSeconds`.
- Cast from Elements; help create missing ones (via the sheet Flows) or accept the user's.
- Improve scripts and scenes on request; read Element bibles for voice and behaviour.
- Write every shot prompt **before** anything queues; the user reviews.
- Run passes (draft / upscale / detail / edit), look at takes, propose redos.
- Assemble the approved Story into a Mix recipe (MPI-917 has an agent route planned).

Existing rules that bind this: agent buttons act directly — fixed-outcome choices are app
confirm cards, never chips that cost a turn; Cosmo path of least resistance — route around a
missing paid Flow; paid cloud models need the user's price confirmation.

## MCP parity

The MCP server (`docs/mcp-server.md`) gets the same Story routes Cosmo uses: read/write the
recipe, run a shot, run a pass, assemble. An outside agent can direct a Story end to end.

## Card import for agents — MPI-1136

Series work (one project per episode) reuses a Story card or takes across episodes. Shipped:
the gallery's Add to project copy for agents ([../mcp-server.md](../mcp-server.md) § Send cards):
`send_cards` on both, by hand or as "the last two", "all the videos", "every triangle".

## Infinite Video Flow

The one-click entry, kept because people find infinite video attractive, and it stops agents
trying a 30 s or 1 min clip in one go.

- **In:** a scene description, Elements (characters, location), a target length.
- **LLM step** (app-side, like Video Edit's describe leg): split into 1-5 s beats, each ending
  on a stopping point; write each prompt from the previous `stateAfter`.
- **Run:** the same Continue step as the Storyboard (continuity.md), on H3.
- **Out:** one joined clip **plus a Story card**, so it is never a dead end — the user opens the
  sequence and redoes one shot.
- No review between beats (that is the full Story pipeline's job). Open: whether it runs the
  draft only, or draft + upscale.
- The LLM step runs on the user's prompt-enhancement backend pick (ComfyUI / Remote / Ollama,
  [../llm.md](../llm.md)) through the Flow `enhance` declaration (`js/services/flowEnhance.js`),
  never a backend of its own.

## Not doing

A ComfyUI-graph-only "Flow + LLM" that chains inside one workflow: a Flow is one job, and a
multi-shot story with review between takes needs the app driving it.
