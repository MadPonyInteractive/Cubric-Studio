# MPI-948 - Send a gallery selection to the agent as one layered chip

Fabio, 2026-09-27, after testing MPI-945's selection bar.

## Ask

Select several gallery cards, send them to the agent in one go, then ask the agent to do
something with all of them ("make a GIF of these", "upscale these", "describe each").

## Shape

- A **Send to agent** button on the selection bar (`MpiGalleryGrid/selectionBar.js`, MPI-945),
  which holds every selection action.
- In the agent composer (`MpiAgentChat`) the selection lands as **ONE chip**, not N thumbnails:
  a `layers` icon (or similar) plus the count, reading as "N images sent".
- The agent must receive every card in the set, in click order (the selection order rule,
  `docs/gallery-selection.md`), with names it can refer to.

## Open questions (resolve before building)

- What reaches the agent: card ids / names / file paths it can act on through its tools, or
  the pixels? N images inlined into one turn can blow the model's context and cost.
- Can one message carry both this chip and ordinary numbered attachment chips
  (`_attachmentChip`, `MpiAgentChat.js`)? How is the set numbered against them?
- Can the user remove the set, or open it to see which cards it holds?
- Does a sent set persist in the chat history the way a thumbnail chip does?
