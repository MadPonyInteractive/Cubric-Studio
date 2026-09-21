# MPI-870 — The agent wakes when the generations drain, and one ask fans out

*Split out of MPI-817 on 2026-09-21 on Fabio's instruction. The design is his, from three
scenarios he walked through on 2026-09-20; the confirm threshold is his answer on 2026-09-21.*

## Why

A finished generation is **silent**. `settle()` pushes its note into `_notes`, which is read at
the START of the next turn, so nothing reaches the user until they type. Fabio hit it twice in
one morning:

- **07:45Z** — asked for a fox, the agent said "I'll look at it and tell you what I see", the
  image landed 33 s later, `agent.describe` ran at 07:46:41Z, and the chat sat silent for
  thirty minutes with the answer one inch away from it.
- **08:29Z** — same shape on the Kaiju bowl. He asked what was happening; the description was
  already on disk.

This is the piece he actually feels. Everything else on MPI-817 was a correctness bug; this one
is the product being rude.

## Two halves

### Wake (the ending)

`settle()` already knows when a conversation's `_inflight` hits zero. Wake = run a turn at that
moment, through `agentSessions.queue` (MPI-840, live-passed). `wait: true` stays for mid-chain
steps.

Seven rules, from Fabio's three scenarios (keep talking + add to the batch; go talk to project
B's agent; come back and work in a workspace):

1. Wake only an **IDLE** conversation. A turn running or queued for it reads the notes anyway.
2. Additions join `_inflight`, so the drain is the true end and the wake fires once. Free.
3. **NEVER wake a conversation whose project is not the open one.** The connector's generate
   route has no project targeting — a dispatch lands in whatever project is OPEN (checked
   2026-09-20) — so project A's wake would render into B. The server does not track the open
   project. Shape: the loop broadcasts `agent:drained {session}` (events are already
   session-tagged); the **RENDERER** posts the wake only if that project is open, and posts it
   again on project open, where the server no-ops without pending notes. That second post is the
   "while you were away" report. The renderer is the side that knows what is open.
4. A wake turn **must not move him**: no `open_project` / `create_project` in its tool list. He
   may be mid-edit in a workspace.
5. Runaway bound: **max 3 wakes in a row** with no message from him. A knob, not a constant.
6. **Unknown, check before building:** what `gallery.visible` answers while a workspace, not the
   gallery, is mounted.
7. `_inflight` is memory only. A restart mid-batch loses the wake; `unfinished-generations.md`
   already covers what was asked for.

### Batch (the ask)

`generate` takes ONE card per call, so "upscale all 50 visible" is 50 tool calls, 50 chat lines,
50 auto-look vision calls and ~100 notes in the next turn.

Shape: a `cards: [ref...]` list on `generate` = the same op once per card, fanned out in the loop
over the existing single-dispatch path. One call, one chat line, one `{started, refused}` result,
**no auto-look on batch items**.

**Confirm card above 5 cards** — Fabio, 2026-09-21. A yes/no before a fan-out larger than that.

## Verification

**Verify mode:** user-ux — only Fabio can judge whether the ending feels right.

- Ask for a generation, do not type again. Pass = the agent speaks when it lands, once.
- Switch to another project mid-flight. Pass = nothing renders into the wrong project, and the
  report arrives when the origin project is reopened.
- Ask for the same op over 6 cards. Pass = one confirm, one chat line, one result.

## Not in this card

Recording WHICH describer wrote a stored look (MPI-817). The held-dispatch 30-minute clock that
starts at DISPATCH rather than at RUN (`agentTools.mjs` `_post`) — same area, separate defect,
derived from code and not measured.
