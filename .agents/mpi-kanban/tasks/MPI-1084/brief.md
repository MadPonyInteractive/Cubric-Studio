# MPI-1084 brief

## Noticed

- 2026-10-12: the LTX t2v mode carries the same copyable light/texture examples r2v leaked verbatim on a beach
  ("low sun through a window", "wet pavement, rough stone, worn fabric", `ltx-2.3.recipe.js` SCENE rules). Not seen
  leaking in t2v yet; r2v fixed on this card.

- 2026-10-11: Cosmo, asked to make a Reference to Video clip from a card made on LTX 2.3 (`ref2v_004`, project
  "X2.3 references"), read `minimax-h3-ref2va`'s settings and picked MiniMax H3; Fabio had to tell it to use LTX 2.3.
  The card's own model should win unless the user asks otherwise. Agent model choice (`services/agentLoop.mjs`), not
  this card's system.
