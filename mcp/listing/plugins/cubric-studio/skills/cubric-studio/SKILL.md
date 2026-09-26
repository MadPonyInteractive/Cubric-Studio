---
name: cubric-studio
description: Make, edit and look at images, video and GIFs in the Cubric Studio app on this computer - projects, models, generations, gallery cards. Use whenever the user mentions Cubric Studio or wants images or video made in it. Its tools come from the `cubric-studio` MCP server.
---

# Cubric Studio

Cubric Studio is driven ONLY through the `cubric-studio` MCP server's tools. Never open it in a
browser, and never call its HTTP API from the shell: the tools carry the price check and the
waits that the raw API does not.

The tools may be deferred, so search your tool list for `cubric`. In Codex:
`ALL_TOOLS.filter(t => /cubric/i.test(t.name))`, then call them on the global `tools` object.

Start with `status`. If it says the app is not running, ask the user to open Cubric Studio.
Then follow the tools' own descriptions. Before the first prompt for a model, read its guide
with `read_knowledge` (the ids are in `describe_model`).
