# MPI-1004 Validation

## Automated (2026-10-01, session 314c5ced)

- `node --test tests/agent-voice-library.test.cjs` (new): 6 pass. `slotVoices` on the real
  manifest: Text to Speech `audio1` lists every performer once (15 sections, all 56 ids), Elderly
  Male = male/elderly with its own ids; Voice Changer lists only `audio2` (its `[null,'character']`
  route), Song none, no library -> null. `resolveVoices`: a voice ref becomes the placed file
  (the voice's own sample fetched, decoded to RIFF/WAVE, placed with ext `.wav`) beside refs it
  leaves alone; no voice ref -> nothing fetched; unknown id and a slot with no library ->
  `INVALID_VOICE` by name; the `openFlow` job resolves it too (the Flow opens with it in `audio1`).
  The browser decode and FileReader are stubs; the logic around them is real.
- `node --test tests/agent-loop.test.cjs` MPI-1004 block (7): the card names the pick by
  performer and nothing runs; Use runs once with the id passed through, one model call total;
  Pick from the voice library opens with the line and NO voice, one model call; a boolean or a
  review choice is `BAD_CHOICE`, a typed reply runs nothing; an id the catalogue lacks raises no
  card; `open: true` with a voice opens with it, no card; a queued message answers the card.
  The MPI-892 refusal pin now asserts the library-voice offer. MPI-1005 block still 10/10.
- `tests/mcp.test.cjs`: 24 pass; a `{ role, voice }` ref passes through `stageMedia`, nothing copied.
- `tests/agent-prompt-budget.test.cjs`: tools budget 18,396 -> 18,490 (+94, generate's media `voice`).
- `npm test`: 2618 tests, 2616 pass, 0 fail, 2 skipped.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/agent-chat.spec.js`:
  37 passed (new "voice card": title, line, Fabio's labels, `use` posts `{confirmId, choice:'use'}`,
  an answered card redraws read-only). `npm run lint:components` and eslint on every changed file: clean.

## Folded in after the first look (2026-10-01)

- Fabio has no Text to Speech installed. A card for a Flow that is not installed would have
  asked, then the click read "not installed": both choice cards (voice, and Song's review) now
  skip an uninstalled Flow (`_flowRunnable`), and a cached "missing" is read again first, so a
  Flow added mid-chat is still asked about, never run unasked. 2 tests; the loop blocks 20/20.
- `flows.md`: a user who asks for a library voice gets one on DramaBox too (its `audio1` lists
  the voices), so the card can be tried on DramaBox.
- Live (Fabio's app, restarted 08:05Z): the voice line went to DramaBox, as the guide says. Its
  first run failed inside ComfyUI (`DramaBoxTextEncode` device mismatch, our MelodramaBox fork,
  not this card's code); the agent's retry ran. Carded as MPI-1008 (breaks users).

## Left: Fabio's look and listen (user-ux)

Needs the app restarted (server code changed) and the agent model on his DeepInfra key.
