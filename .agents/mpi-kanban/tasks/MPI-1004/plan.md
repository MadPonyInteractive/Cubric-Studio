# MPI-1004 Plan - Cosmo picks a library voice

Umbrella: MPI-1000. Runs AFTER MPI-1002 (both edit `js/shell/agentDispatch.js` and
`docs/agent/flows.md`). Read `brief.md` first: it holds what is true today, with file:line.

## Design

One generic hook, keyed on the slot's `voiceLibrary` route, never on a Flow id. Text to Speech,
DramaBox and Voice Changer's target slot all get it for free, and a future voice Flow that
declares the route does too.

1. **The agent sees the voices.** `describe_model` for a Flow whose audio slot declares
   `voiceLibrary` lists that slot's library voices (the route's filter, the same one the picker
   uses): id, name, gender, age, pitch band in words, kind. Around 60 short rows, only on voice
   Flows. No new tool.
2. **The agent passes one.** A media ref `{ role, voice: '<voice id>' }` beside the existing
   `{ role, path }`. The renderer resolves it through ONE shared helper that both the picker and
   the agent call: fetch the sample, `toWavFile`, place it in the project. Extract it out of
   `MpiMediaPicker._pickVoice` so there is one path, not a copy. An unknown id, or a voice on a
   slot with no `voiceLibrary`, refuses with an `INVALID_` code (so the existing "call
   describe_model" hint fires). Outside agents over MCP get the same ref: check the connector's
   media schema accepts it.
3. **The offer.** A voice line with no sample: Cosmo ends with
   `[options: Pick from the voice library | You pick one]` (Fabio's order). The first is today's
   `open: true`. The second picks by the words: gender and age first, then pitch band, then kind
   (narration for a narrator or documentary voice, character otherwise). It says which voice it
   picked in one line. Where it lives: the Text to Speech `MEDIA_REQUIRED` offer text
   (`services/agentLoop.mjs:2105`) and `docs/agent/flows.md` "Flows the user finishes" (DramaBox
   never refuses, so the guide has to carry it, not only the refusal).

## Files (confirm at pickup)

- `services/agentLoop.mjs` (describe_model voices, the offer text)
- `js/shell/agentDispatch.js` and whichever resolver it calls (`resolveAgentMedia`,
  `js/utils/generationControls.js`) for the `voice` ref
- `js/data/voiceLibrary.js` (the route filter the agent list reuses, the shared sample-to-file
  helper if it fits there)
- `js/components/Compounds/MpiMediaPicker/MpiMediaPicker.js` (call the shared helper)
- the MCP connector's generate media schema, if it validates ref shapes
- `docs/agent/flows.md`, `docs/agent-chat.md` (a line on the voice ref)
- `tests/agent-voice-library.test.cjs` (new)

## Verification

**Verify mode:** user-ux

- Unit: describe_model for `chatter-box` lists voices with gender/age; a `voice` ref resolves
  through the shared helper to an audio media item on `audio1`; an unknown id refuses
  `INVALID_`; a `voice` ref on a slot with no route refuses.
- `npm test` green apart from known pre-existing reds.
- Live on an isolated app (`npm run app:isolated`, tell Fabio first: it queues on his local
  ComfyUI): "make an old man say 'the storm is coming'" -> two buttons -> You pick one ->
  Text to Speech runs with an elderly male voice, card lands, Cosmo names the voice. Same ask
  with "use DramaBox". Then Pick from the voice library -> the Flow opens on its inputs with the
  library in the picker.
- Fabio listens to both results.

## Your call (defaults taken unless Fabio says otherwise)

- DramaBox runs fine with no sample (its own voice). Default: offer the library there too, as
  Fabio asked, with no third "DramaBox's own voice" button.
- Voice Changer's target slot gets the `voice` ref through the same hook. Default: yes, it costs
  nothing; the offer text stays about spoken lines.

## Current State

2026-09-30 (session 43678b37): planned from a read of the code. Not started. Next: after
MPI-1002 lands, move todo -> doing with `files.json`, then build steps 1-3.
