# MPI-889 — The agent works INSIDE the app, not beside it

Umbrella, opened 2026-09-22 on Fabio's word, out of the MPI-877 round-3 conversation.

Today the agent is a chat that fires jobs into a void and reads the results back by
description. It cannot see which workspace the user is standing in, it cannot move the view
to where its own work will render, and it fills a Flow blind. Three cards make it stand
where the user is standing.

Carries no code of its own. Closes when its last member does.

## Members

| Card | Phase | What it is |
|---|---|---|
| MPI-890 | 1 | The agent reads the open workspace, so "this image" is the entry in front of the user — **done 2026-09-22** |
| MPI-891 | 2 | The agent moves the view to where its work will render |
| MPI-892 | 3 | The agent fills a Flow and hands it over instead of running it blind |
| MPI-950 | 4 | Agents see stacks as stacks: the in-app agent and MCP read, create and return a Gallery stack (MPI-949) as a stack, not as its loose members. Added 2026-09-29 (umbrella sweep, Fabio's yes) |

**MPI-950 and the others:** it needs neither phase 2 nor 3 - it is the same idea (the agent
sees what the user sees) applied to stacks - but it edits `services/agentLoop.mjs` and
`routes/agent.js`, the files MPI-892 touches, so it runs after 892 or in a session that claims
both. It was blocked on MPI-941's claim on those files; 941 closed 2026-09-29, and on the same
day MPI-984 (another live session) claimed them. Check `active_file_claims` before starting.

## Current State

2026-09-30 (Agent 76): CLOSED. MPI-950 (phase 4) shipped: a stack lists as one row, an open
stack names its card on screen, and a fan-out's new cards land as one stack. Every member is done.

2026-09-30 (Agent 75): phases 1-3 are done. MPI-892 (phase 3) closed on Fabio's checks 1-5:
Cosmo opens Draw It In, Scribble and Object Stamp filled in, asks before a Song, and routes round
a Flow that is not installed. MPI-950 is the last member and nothing blocks it now (MPI-941 and
MPI-984 are done; no live claim on `services/agentLoop.mjs` or `routes/agent.js`). This umbrella
closes when 950 does.

Phase 1 (MPI-890) closed 2026-09-22 on Fabio's live read 3: an agent edit of the open card's
entry lands as that card's next entry and keeps its name. MPI-888 closed with it. Next is
phase 2 (MPI-891). Carried from the closing handoff, for phases 2-3:

- **Flows with the agent** (Fabio, 2026-09-22): a Flow landing in the gallery is FINE, but
  the user must SEE the Flow run, and pressing the card the agent hands back should bring
  them to the gallery. Test agent-run Flows live.
- Settle the Duration-rule vs wake-turn contradiction (`agentLoop.mjs` Duration rule vs the
  auto-look on settle calling `_maybeDrained`) before MPI-892.
- The result-review rule stays blocked on MPI-887. MPI-886's description still needs
  widening (a card reached through `list_cards`, not only a drag); a DRAGGED card still
  lands as a new card because it is copied into attachments.
- Renaming the project FOLDER on a project rename: dropped by Fabio 2026-09-22.

## Phase order, and why it is a hard ordering

**Phase 1 → 2 → 3.** Not a preference:

- **2 needs 1.** Moving the view to a card means knowing which card, which is exactly what
  phase 1 puts on the wire.
- **3 needs both.** "Open the Flow and show the user the last stage" is a navigation
  (phase 2) to a surface whose state the agent has to know it is looking at (phase 1).

Each is still shippable and verifiable on its own — 1 is useful with no 2, and 2 is useful
with no 3.

## The one thing to settle before phase 3

`agentLoop.mjs:1166`, the Duration rule, tells the agent *"you never speak first, a
generation that finishes after your turn reaches you only when the user writes again"*.
`agentLoop.mjs:1445`, the auto-look on settle, pushes a `[You looked at it: …]` note and
then calls `_maybeDrained()`, whose comment describes a **wake turn** that reports it.

One of those is stale. Which one decides whether the agent can come back unprompted at all,
and the same answer gates the **result-review rule** that is specified and waiting in
MPI-888's `validation.md`. It is a cheap read; do it before building on either belief.

## Related, and deliberately NOT members

| Card | Why it is not folded in |
|---|---|
| MPI-886 | A dragged card should arrive as the CARD (groupId + itemId), not a copy of its picture. Already carded, `todo`, its own life |
| MPI-887 | An outside image should be able to become a history entry, so Composite can reach it. In `doing` and owned by another session |

All five are one idea — **work on an existing picture belongs to that picture's card** — and
MPI-890 is close enough to MPI-886 that whoever takes either should read both. They stay
out because a member's `description` prefix is the only place membership is recorded, and
writing that prefix means editing cards other sessions own.

## What closes this

The last member landing. Its `validation.md` records the ordering that justified the
umbrella and what it leaves behind — not fresh evidence, which belongs to the members.
