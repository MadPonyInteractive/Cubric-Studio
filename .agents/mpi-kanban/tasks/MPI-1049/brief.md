# MPI-1049 - Transparent background toggle (Qwen-Image 2.1)

Umbrella: MPI-1064. The toggle itself is the card description.

## The agent half (Fabio, 2026-10-10)

- Cosmo and MCP know the toggle exists: it is a named param they set, and the Qwen 2.1 guide
  (`docs/agent/models/qwen-image-2.1.md`) says so. Remove-background already exists as a
  separate tool; the agent only has to learn the NEW button.
- A no-background request that names no model ("a man walking his dog, no background"):
  when Qwen 2.1 is installed the agent may use it with the toggle on, or offer the choice the
  way it usually does (e.g. Qwen 2.1 native transparency vs another model + remove background).
- Stale wording to replace with the toggle (both say type "transparent background, alpha
  channel" into the prompt): the Qwen 2.1 ModelDef `description` in
  `js/data/modelConstants/models.js` and its t2i note in
  `js/data/modelConstants/modelPriority.js`. The recipe (`js/data/recipes/qwen-image-2.1.recipe.js`)
  already carries the vendor's two RGBA sentences.
