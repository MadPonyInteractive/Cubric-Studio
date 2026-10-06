# MPI-1032 validation

Shipped in `7c2add3ac`; CI "Tests" run 37438022791 green.

## Fix 1: a card's inputs are cards

- `read_card` resolves each `madeFrom` input to its own card through `_sidecarsOf` (one pass over `Media/.meta`), registers it with its item id (the sidecar FILE name) and `groupId`, and names the `groupId` in `madeFrom`. Archived cards are not named.
- Test `a card's input is that input's card` (agent-cards): `look` at an input reached through `read_card` asks `storedLook` and `storeLook` for the input's own item. Negative control: fails on HEAD's `agentCards.mjs`, passes on the fix.
- Live 2026-10-06 (before the fix): the looks at `i2v_001` and `imageUpscale_005` were described fresh and nothing was saved on either sidecar.
- NOT observed live after the fix: Fabio's next run looked only at the attached clip (a card, cached before this change too), so no input look has run on the new code yet.

## Fix 2: a held message says it was typed mid-turn

- `AgentSessions.queue` marks a turn `held` when its own conversation is mid-turn (not when it answers a review card); `runTurn` opens a held turn with a line saying it was typed before the last reply.
- Test `a message held behind its own conversation's turn` (agent-sessions): held line present for the same conversation, absent for a turn that ran at once and for one queued behind another conversation. Negative control: fails on HEAD's `agentSessions.mjs`.
- Live 2026-10-06 after Fabio restarted on the new code: "use the original audio" was typed while Cosmo worked; it answered beside the running clip and did NOT cancel it (no `generation.cancel` in app.log after the 08:39:14 submit). Before the fix the same shape cancelled a correct run "as you asked".

## Suite

`npm test` 2725/2727 pass, 0 fail; eslint clean on the changed files.

## Dropped follow-ups (Fabio, 2026-10-06: "let's not confuse Cosmo anymore")

A read_card "redo = same inputs" line and an H3-guide soundtrack line were proposed and declined.
