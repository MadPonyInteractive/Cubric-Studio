# MPI-899 validation

**Verify mode:** user-ux (Fabio saw it live; only a repro or his context closes it).

## What landed before (session 303bd49c, abandoned)

- `ac470d96` uncaught renderer errors reach app.log with their stack (error bridge).
- `5ddc62be` a throwing Events handler logs its message and stack.
- `tests/desktop/prompt-box-badge.spec.js` keeps a badge probe (single box, logs only).

## Investigation (2026-09-26, session ab9e6fd6)

A fresh `_renderBadge` can NOT print a batch on Krea 2: `krea2.capabilities.batch === false`, so
`visibleControlIds` never mounts `batch` into `_activeControls`, and the badge shows `×N` only
when that map holds a batch control. So "Krea 2 ×4" means `model` had switched to Krea 2 while
`_activeControls` still held the PREVIOUS model's controls, then something repainted the badge.

Every switch path repaints correctly, measured:
- standalone box, two boxes sharing the singleton controls (existing probe);
- real gallery + real model picker, local models: SDXL ×4 -> Krea 2 -> nav away/back -> SDXL ->
  Krea 2. Every intermediate paint recorded; no "Krea 2 ×4" ever, no page errors.
- Read, not run: History picker `select`, `s_selectedModelIdByType` sync, Reuse (`use.model`),
  `setModelList` - all call `setModel`, which runs `_refreshOpSlot` then `_renderBadge`.
- The agent cannot touch it: only `PromptBoxControls` emits `settings:shared:update`, and
  agentDispatch builds its own injection. The prompt box badge is the only UI printing `×N`.

Remaining explanation: a THROW inside `setModel` after `model = newModel` but before
`_refreshOpSlot` (the picker's emit has no try/catch), leaving stale controls for the next
repaint. On 2026-09-22 there were 14 `generation:started/complete` handler throws, logged as
`[object Object]` before the bridge. Since the bridge (2026-09-22 23:06) app.log holds NO
renderer throw at all (checked every log to 2026-09-26).

Context from app.log at the sighting (card created 21:51Z): the agent ran krea2:t2i FOUR times
(21:40:48-51) and ill-anime i2i x4 (21:45), after flux-schnell-cloud runs.

## Fabio

2026-09-26: closed as CAN'T REPRO. His recollection: a batch of four on Nano Banana, then picked
Krea 2, and the x4 stayed. Nano Banana cannot batch itself - a cloud "batch" is four requests
fired at once - and every Nano Banana model had capabilities.batch false both before and after
MPI-876, so its box never offered a batch control. The x4 came from some other route. Also noted:
MPI-876 (fcd50ffd8, 22:48 local) rewrote models.js batch capabilities three minutes before this
card was created, while the app was running.

If it bites again: app.log now carries any renderer throw with its stack (ac470d96, 5ddc62be) -
grep [uncaught] / [Events] around the time and start from the stale-controls theory above. His
waiting session "Fix stale batch xN on the model badge" is being archived.
