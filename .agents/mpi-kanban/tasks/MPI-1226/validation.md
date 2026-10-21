# MPI-1226 validation

## What Fabio saw (2026-10-21, "Flux 3 tests")

edit_045 landed at 09:58:37. The auto-look described it as "Seven human figures" (there are six).
His message ("Nice one... add a dog... use turbo") then opened on that note plus its advice to
check a doubted point with a question look, so the turn made two more describer calls
(09:59:05, 09:59:13) and a paragraph confirming the ridge landed before the dog edit was
submitted at 09:59:28. The log shows two describer calls in that turn; the third chat line made
no describer call (no history on disk to say which look it was).

## Fix

`services/agentLoop.mjs` `runTurn`: a real turn (not a wake, not a held message) whose notes
hold a `[Generation|Batch|Routine finished` line gets one more line AFTER the notes: the user saw
these results before typing, their message is the verdict, do not look or report unless asked.

## Evidence

- `node --test tests/agent-wake.test.cjs`: 9/9, incl. the new case (line present after a landing,
  read after the auto-look note; absent on the next quiet turn; absent on a wake).
- `npm run lint` exit 0; `npm test` 3493 pass, 0 fail.

## Second half (Fabio, live 2026-10-21, project "test")

Fabio's live check of the first half: "Yeah I like this" got no extra looks (one auto-look only, log 11:36:47).
But he typed it over the latents while edit_006 was still rendering: his turn answered, then the
landing woke the chat and reported the same result again. Fix: a real turn marks every job in
`_inflight` as `_watched`; a watched job that lands OK puts its notes in `_seenNotes` (read by
the next real turn with the seen line, never by a wake, never counted by `canWake`). A failure
still goes to `_notes` and wakes. Test: `a result the user typed over while it ran never wakes`
(10/10 in agent-wake). `npm run lint` 0, `npm test` 3495 pass / 0 fail.

## Third part + live pass (2026-10-21)

Live, "I like it" typed while Chroma rendered still ran Prism's auto-look (~12 s, the local agent
waited on it). A job is now watched from the START of `runTurn` (before the GPU wait), and a
watched result gets no auto-look. CI run 39596841039 green on `0cb720b8e`. Fabio's live test
after restart: Krea 2 run, "Whoa this one looks really good" typed while it rendered: no
describe in the queue, one reply, no report. PASS.

## Not done

- The auto-look itself still runs at landing (it feeds the wake report and the next edit).
- A WAKE turn may still check a doubted point with question looks (edit_046 did two): that
  turn is the report, so it was left alone.
