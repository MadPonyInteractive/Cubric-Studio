# MPI-1005 Plan - Song's Review lyrics / Just do it as a confirm card

Drafted 2026-10-01 (session f60f51ad) from a short code trace; nothing built. Re-read the symbols
before editing; line numbers drift.

## What exists (the primitive to reuse)

- Confirm cards pause a turn mid-tool and resume on a click with NO model call: `spend`
  (`_confirmSpend`, `services/agentLoop.mjs`), `batch`, `install`. Each emits `agent:confirm`,
  writes `_historyEntry('confirm', ...)`, awaits `this._pendingConfirm = { confirmId, kind, resolve,
  turnId }`. `reset()` resolves each kind in its OWN vocabulary (a boolean kind must never get the
  string 'declined', MPI-870).
- `POST /agent/confirm` (`routes/agent.js`) takes `{ confirmId, yes: boolean }` only, and finds the
  loop via `sessions.byConfirm`. `loop.confirm(confirmId, yes)` resolves it.
- `MpiAgentChat.js` renders `agent:confirm` (`kind` branches near `isBatch` / `isSpend`).
- Per-Flow agent behaviour is DECLARED in `js/data/flowsRegistry.js` (`agentOpens`), surfaced to the
  loop through list_models (`agentDispatch.js` adds `opens`), remembered in `_rememberGuides`
  (`this._opens`). Song has no `agentOpens` (comment at its entry says the agent asks first).
- A message sent while a turn runs is QUEUED (`agentSessions.queue`, MPI-840); with a card pending
  it would wait until the click.

## Design

1. Song declares `agentReview: 'Input_Lyrics'` (the field the card shows). list_models carries it
   (`review`), `_rememberGuides` keeps it beside `_opens`.
2. In `generate`, a Flow with `review` and no `open: true` goes to `_confirmReview(turnId, args)`:
   emits `agent:confirm` `{ kind: 'review', flow: <title>, text: fields[<field>], notes:
   fields.Input_Voice_Notes }`, awaits `'review' | 'run' | 'replied'`. `review` -> `_openFlow(args)`;
   `run` -> the normal generate path (spend card, GPU wait and all); `replied` -> a tool result
   telling the model the user wrote back instead, and nothing runs.
3. `reset()` resolves a pending review as `'replied'` (its own vocabulary, never a boolean).
4. A message queued while a `review` card is pending resolves it `'replied'`, so the turn ends and
   the typed message runs next (`agentSessions.queue` or `routes/agent.js` before `queue`).
5. `POST /agent/confirm` accepts `{ confirmId, choice: 'review' | 'run' }` for a review card;
   `yes` keeps meaning what it means for the other kinds.
6. `MpiAgentChat` renders kind `review`: the text in the existing lyrics/code box, the two buttons;
   a click posts the choice, then the card shows what was picked (and redraws from history).
7. `docs/agent/flows.md` Song section shrinks to: write the song into `generate`'s fields (tags
   bare, cast in `Input_Voices`, who sings where in `Input_Voice_Notes`); the app shows it and asks.
   No options line, no lyrics in the chat (the card shows them).

## Steps

- [ ] 1. Loop + route + sessions (design 1-5). Files: `services/agentLoop.mjs`,
  `services/agentSessions.mjs`, `routes/agent.js`, `js/data/flowsRegistry.js`,
  `js/shell/agentDispatch.js` (list_models `review`), `tests/agent-loop.test.cjs`.
  **Verify:** review card emitted, no generate before the click; `review` opens (no generate),
  `run` dispatches once, `replied` runs nothing; a queued message resolves it; reset resolves it.
- [ ] 2. Chat card (design 6). Files: `js/components/Compounds/MpiAgentChat/MpiAgentChat.js` (+ its
  `.css`, BEM, components only). **Verify:** a desktop spec or harness renders the card with the
  text and both buttons and posts the right choice.
- [ ] 3. Cosmo guide (design 7). Files: `docs/agent/flows.md`. **Verify:**
  `tests/agent-prompt-budget.test.cjs` + `tests/agent-loop.test.cjs` green.
- [ ] 3b. Cut-off at max (brief § Also): Cosmo leaves `Input_Duration` alone unless the user names
  a length; default to the slider max (360) after Fabio confirms the hand default moves too. Files:
  `docs/agent/flows.md`, `js/data/flowsRegistry.js` (Song's `Input_Duration`), maybe
  `js/utils/declaredFields.js` (`agentFieldSpecs`). **Verify:** a test that Song's agent spec /
  default matches; Cosmo's generate args carry no `Input_Duration` for a plain "make a song".
- [ ] 4. Live: Fabio asks Cosmo for a duet; the card shows the lyrics, Review lyrics opens at once,
  Just do it runs at once, typing "change verse 2" closes the card. (Costs Fabio's own agent turns.)

## Verification

**Verify mode:** user-ux (the card's look and feel is Fabio's call).

## Risks

- `MpiAgentChat.js` is a hot file (peers' MPI-774 / MPI-892 work): check `state/index.json` claims
  and `git status` before editing.
- The spend card must still appear for a paid Song run after `run` (Song is local, but keep the
  path shared).

## Plan Drift

- 2026-10-01 (session 585dd02b): a click ENDS THE TURN with no model call (`_reviewEnd`, the
  carriedTo pattern), for review, run and replied alike; a run the app refuses goes back to the
  model. The plan only said "resume"; resuming would still cost a model round to narrate the click.
- `confirm()` now refuses a choice on a yes/no card too (`BAD_CHOICE`): 'run' is truthy and the
  install branch read `if (!yes)`, so a choice posted to an install card would have installed.
- `_historyEntry` lets a card's `kind` overwrite the entry kind (pre-existing: batch/spend entries
  are 'batch'/'spend'), so the review entry is kind `review`; the chat redraws it answered from that.
- Extra files: `js/services/agentService.js` (posts `choice`), `tests/desktop/agent-chat.spec.js`,
  `tests/agent-flow-handover.test.cjs`, and the docs below.

## Current State

2026-10-01: ALL STEPS DONE. Built and green (agent + connector + flow node tests, the full
agent-chat desktop spec); Fabio's look "1"; cut-off default 360 on his yes. Docs:
`docs/agent-chat.md` § Handing a Flow over, add-flow playbook 01 / 07 / README / existing-flows
song.md. Code PUSHED as `2eb6bea46` (scratch-index commit: the root `events.jsonl` carries a
peer's whole-file re-EOL/reorder, NOT committed; only MPI-1005's two lines went in). Card left in
`doing`/validating: close-out.md forbids the done move until CI judges `2eb6bea46`, and the done
move must be its OWN commit. Next: `gh run list --branch master --workflow tests.yml --limit 5`,
green -> `task_ops move MPI-1005 --to done` + commit the board/card files the same way
(`blobs1005.py done` recipe: HEAD + only this card's lines).
