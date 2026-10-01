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

## CI (2026-10-01)

- `7c168b195` (the code commit): tests.yml run 36835439944 green.
- MPI-1008 fixed and pinned (`bff32c628`, MelodramaBox `529c4be`), so the DramaBox look is unblocked.

## Fabio's look, round 2 (2026-10-01, after MPI-1008)

- Step 1 PASSED: a voice line with a cough went to DramaBox and played.
- Step 2 FAILED: "use DramaBox with a voice from the library" - the agent said DramaBox's media
  roles are empty in this install. Root cause: `routes/connector.js` built every Flow's `media`
  from a static server copy of the command registry, and a Flow PACKAGE registers its op in the
  renderer only (`userFlowService.registerUserFlow`). So every packaged Flow (DramaBox, Head Swap,
  user Flows) listed no media, and the voices had no row to fold onto. Same miss in
  `_firstFrames` (a video sent to a packaged Flow's picture slot). Fix: `_getCommandRegistry`
  adds each valid installed package's op under the renderer's key (`user:<id>`), re-scanned per
  call. Proof: Fabio's installed `user:drama-box` -> static registry `[]`, fixed
  `[{"role":"audio1","type":"audio","required":false}]`. `tests/connector-package-media.test.cjs`
  2/2; connector/agent/user-flows suites 428 pass / 0 fail; eslint clean.
- Folded in (Fabio asked, same panel): a speech job brings Vinyl in on his mic clip (`idle-3`),
  music keeps the decks (`working`). Speech = a Flow with a `voiceLibrary` slot (Text to Speech,
  Voice Changer, the DramaBox package). `agent-chat.spec` 37/37 incl. the new ledge step.

## Fabio's look, round 3 (2026-10-01)

- Step 2 now reaches the card (round-2 fix live): "I'd use the Villain Male voice", both buttons.
- Pick from the voice library opened DramaBox on Generate. Fabio: open on Inputs with the voice
  library already open. Built: `pickVoice: <role>` from the loop's library choice through
  `/connector/open-flow` -> `agentDispatch.openFlow` (`openAt: 'inputs'`, only for a slot with a
  library) -> `flow:open` -> MpiBaseFlow opens that slot's picker on its first `el.open` (after
  the overlay shows, so it stacks on top) -> MpiMediaPicker `openVoiceLibrary`.
  `tests/desktop/flow-pick-voice.spec.js` 1/1 (real route; Inputs tick current, library visible,
  `elementFromPoint` at its centre inside it); loop test asserts `pickVoice: 'audio1'`.
- BREAKER found + fixed: voice previews. Switching voices blanked the old clip's src, whose
  `error` handler (still live) cleared the NEW clip's playing state and logged "Audition load
  failed" for the OLD voice (Fabio's app.log 09:10). Reproduced in an isolated Electron: second
  voice played but showed stopped. `MpiVoicePicker._playAudition` handlers now act only for the
  current clip. Spec step in `media-picker-cards.spec.js` (4/4).
- `npm test` 2621 pass / 0 fail / 2 skip (flow-frame's `el.open` shape updated); flow-*.spec +
  media-picker-cards 37/37; eslint + lint:components clean.

## Left: Fabio's look and listen (user-ux)

Needs the app restarted (server code changed) and the agent model on his DeepInfra key.
