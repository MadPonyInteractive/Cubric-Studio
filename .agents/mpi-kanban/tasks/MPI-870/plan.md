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

## Folded in 2026-09-21 — three small honesty fixes from the live round

Added on Fabio's instruction after the 09:14Z restart proved the kept look works. None of them
is the wake; all three are about the agent telling the truth about what it just did.

### 1. A cache read must not say "Looking at image"

`agentLoop.mjs:1886` returns `'Looking at image'` for every `look` tool call, cache hit or not.
Live at ~09:18Z the chat printed it while making **zero** vision calls, and Fabio did not believe
the answer was real until the log was read back to him.

His wording: **"Fetching saved image description"**, or close to it.

**Why it matters beyond honesty, in his words:** users who work with LLMs and agents watch for
this. A line that says the description came from storage tells them their credits are NOT being
spent. Keeping the user's expenditure as low as possible is a product goal, and a saving the user
cannot see does not count as one. So the label is a feature, not a cosmetic fix.

### 2. One log line per look

The description of an ATTACHED photo is written nowhere. A staged attachment registers as
`kind: 'attachment'` with no `itemId` (`agentLoop.mjs:1607`) because it is a temp copy, not a
gallery card — a reset deletes it — so `_lookOnce` has no sidecar to write to. Giving it a card
id is not a one-liner and is not worth it.

One truncated log line per look is. It was the original 2026-09-20 proposal; the sidecar replaced
it for cards and attachments fell through the gap. With it, "was the description wrong?" is a
grep instead of a guess — which is exactly the question that could not be answered about the
09:14:50Z describe of Fabio's photo.

### 3. A named param should record asked vs defaulted

The agent said it used "a low denoise". The sidecar says `0.3`, which is also the i2i op default,
so nothing on disk can tell whether it chose the value or inherited it. Same for duration. A
one-word record on the injected param closes it.

## What the restyle round actually taught about descriptions (Fabio, 2026-09-21)

**Do not chase explicit vocabulary.** The prompt carried no nudity tag at all and `i2i_001` still
came back bare below the waist — an uncensored model does not add clothes that were not asked
for. So the missing nudity was NOT the cause of the drift.

**What drifted was the POSE and the FRAMING.** The tags said `upper body` for a full-body,
bent-forward, buttocks-dominant selfie, and carried no pose tag at all — no bent over, no leaning
forward, no from above. At denoise 0.3 the room held perfectly (TV, bookshelf, entertainment
centre, hardwood floor) and the pose was rewritten, because the pose was never in the words.

So the bar for a describer feeding a restyle is **pose and framing fidelity**, not explicit
vocabulary. That is also the portable bar: several hosted vision models refuse to describe
nudity, and one that describes everything present without naming it still produces a faithful
restyle. It keeps the describer swappable.

## Not in this card

Recording WHICH describer wrote a stored look (MPI-817). The held-dispatch 30-minute clock that
starts at DISPATCH rather than at RUN (`agentTools.mjs` `_post`) — same area, separate defect,
derived from code and not measured.

## Completed — 2026-09-21

All of it, code-side. `npm test` 1704/1707 pass, lint clean.

**The three honesty fixes**

- The cache-read label. `_lookOnce` records whether it read the card's kept text; the tool's
  DONE frame carries `Fetching saved image description` when it did. The started frame still
  says `Looking at image`, because nothing knows yet — `_appendTool` reuses the line by id and
  replaces its text, so the correction needs no renderer change. History keeps the corrected
  label, or a remount redraws the claim the run disproved.
- One log line per look, `_logLook`, cached vs fresh + the ref + 240 chars. `routes/logger.js`
  reached from ESM by dynamic import, category `agent`. Never throws.
- Asked vs defaulted. `resolveNamedParams` returns `provenance` — `{from, value}` per named
  param — and `agentDispatch` writes one line. **Deliberately the log, not the sidecar:** the
  sidecar route is `generationSettings.controlState`, which `promptReuse` reads back and
  applies to the user's own settings, so a provenance key there would ride into them.

**The wake.** `_maybeDrained()` emits `agent:drained` at the END of `settle` (after the
auto-look note, or the wake speaks without the description). `AgentSessions.wake(turn)` runs a
turn for the project the RENDERER names; `loop.canWake()` holds rules 1 and 5, and the
queue/carry check holds the rest. `POST /agent/wake` mirrors `/agent/message`'s body.
`agentService` posts on `agent:drained` AND on `project:changed`, always for the OPEN project —
no key comparison anywhere, because an idle conversation with nothing pending answers
`woke: false`. That no-op IS the "while you were away" report.

**The batch.** `cards: [ref...]` on `generate`; `_fanOut` loops the existing single-dispatch
path. Confirm above 5 (`BATCH_CONFIRM_ABOVE`), `agent:confirm` gains `kind: 'batch'`, and
`MpiAgentChat._appendConfirm` now takes the event object and draws either kind.

## Current State

**Done and PROVEN LIVE.** All three checks in `validation.md` passed in Fabio's own app on
2026-09-21, plus all three folded-in fixes. Code committed as `9be177b8`.

The single next action is: **push `9be177b8`, wait for CI to judge it, then close the card.**
It is held in `doing` / `validating` for that reason alone — a card does not close on its own
unjudged commit (`close-out.md`), and `.husky/pre-push` enforces it. Nothing else is owed.

Spun out of this card and NOT part of it: **MPI-876**, the spend gate — the agent must not run
a billed cloud model without a Yes, and must say roughly what it costs. Fabio's ask on
2026-09-21 after watching the agent reach for a paid model unprompted. Planned, not started,
and its `plan.md` is self-contained.

## Plan Drift — 2026-09-21

- **Rule 6 is closed by reading, not building.** `gallery.visible` already refuses with
  `GALLERY_NOT_OPEN` when `state.currentPage !== PAGE_GALLERY` (`agentDispatch._visibleCards`),
  so "everything I can see" never silently becomes the whole project while a workspace is
  mounted. Nothing to build.
- **The fan-out sits ABOVE the media gate, not below it.** Built below first, and every batch
  refused with `MEDIA_REQUIRED`: `cards` is what fills that slot, and the gate is per picture.
  Each fanned-out call re-enters and meets every gate itself. `GUIDE_NOT_READ` is the one
  answer that cannot differ per card, so the batch stops on it rather than repeating it N times.
- **A batch confirm cannot reuse the install card's resolve.** `reset()` resolved a pending
  confirm with the string `'declined'`, which is truthy — handed to a batch it reads as YES and
  queues every card the user just walked away from. Both kinds now resolve in their own
  vocabulary, and there is a test for exactly that.
- **One test's anchor moved.** `agent-sessions.test.cjs` scanned `routes/agent.js` from
  `/agent/message` to `/agent/stream`, so it read the new `/agent/wake` route as part of the
  message handler. Bounded to the next `router.` instead; the rule it guards is unchanged.

## Not done, and why

`docs/agent-chat.md` documents neither `cards` nor the wake. It is outside this card's
ownership, and message `e7c38539` has an open question about who owns it and about its 378
lines against a 200-line budget. Flagged, not edited.
