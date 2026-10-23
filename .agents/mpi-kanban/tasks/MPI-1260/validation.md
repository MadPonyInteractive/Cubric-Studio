# MPI-1260 validation

- 2026-10-23 code ec01d0167: `CHOICE_CARDS.tiles` + `_tileSizes` (agentLoop), `_CHOICES` (routes/agent.js), the chat's tiles card (MpiAgentChat), Cosmo's guide + agent-chat.md.
- tests/agent-loop.test.cjs: a new test covers the card (sizes, counts, primary = nearest 20 tiles, nothing runs before the click, a click on 256 runs at 256 and ends the turn with no model call, `replied` runs nothing, a named size raises no card, equal counts offered once), and the MPI-1237 count test now answers the card. npm test: 3556 pass, 0 fail; eslint clean; the pre-push lint and unit tests passed.
- Eye check (isolated Electron, no GPU): the card drew in Cosmo's chat for a 1024x1024 picture at 1x: 256 px · 25 tiles (primary), 512 · 9, 768 · 4, 1024 · 1 (1536 merged away). Screenshot scratchpad card3/card.png.
- Not run: a live Cosmo turn end to end (LLM + GPU); the loop path is covered by the unit test.
- CI run 40005598564 on ec01d0167: success.
