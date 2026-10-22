# MPI-1248 Brief: agent + MCP search guides

## Why

Fabio asked ChatGPT (2026-10-22) for a ComfyUI alternative, then "something with MCP", then
"an agent inside the app that can do stuff for me". It listed Locally Uncensored, Raccord, AI
Desktop Studio, Velorn, BeatDesign and ComfyUI MCP servers. Cubric Studio has all three things
asked for (no nodes, in-app agent Cosmo, MCP server) but only the homepage said so: 13 of 14
guides never mentioned MCP, none mentioned the agent. After several more turns ChatGPT did list
Cubric Studio, but with a screenshot of "Cuebric", an unrelated product with a near-identical
name. Earlier in the chat it had cited our automatic1111-alternative guide only for Forge facts.

## What shipped (draft, website branch `guides-agent-mcp-mpi-1248`, commit `ea50c09`, NOT pushed)

`c:\AI\Mpi\Cubric Studio (Website)`:

- `/ai-image-generator-agent/`: "ai image generator agent", "best ai image generator agent",
  "ai agent that generates images", "local ai agent for image generation", "comfyui agent".
  Real agent screenshot (`assets/media/agent-at-work-1280.webp`), also its og:image.
- `/mcp-image-generation/`: "mcp image generation" (+ claude, server), "claude code mcp image
  generation", "best mcp for image generation", "comfyui mcp" (+ claude, local, codex), "claude
  generate images" (+ free, mcp, and videos). Setup for Claude Code, Claude Desktop, Codex,
  Antigravity; ComfyUI MCP vs Cubric Studio table.
- Honest alternatives on both (ItemList JSON-LD). Facts in `research/competitors-2026-10-22.md`,
  from each project's GitHub, spot-checked with `gh api`.
- Links from `/guides/`, sitemap, llms.txt, comfyui-alternative, local image/video guides.
  `styles/article.css`: `.article__shot` figure, long `<code>` wraps.

App claims come from docs.cubric.studio/agent/ (`pages/agent.html` in the Docs repo),
`docs/mcp-server.md` and the cubric-studio-agents README.

## Verified (2026-10-22)

JSON-LD parses on 6 touched pages, FAQ JSON-LD count == `<details>` count, no broken internal
links, no em/en dashes, no horizontal overflow at 375px (one `<code>` overflow found and fixed).
Screenshot renders. NOT checked: CTA smooth-scroll (unchanged pattern from MPI-1124).

## Open, Fabio's call

1. Review copy, then merge to `main` and push (push = live on GitHub Pages), then an IndexNow ping.
2. Third-party listings (awesome-mcp-servers PR, Glama / PulseMCP / Smithery, awesome lists,
   Reddit answers): drafts can be written here, posting is his.
