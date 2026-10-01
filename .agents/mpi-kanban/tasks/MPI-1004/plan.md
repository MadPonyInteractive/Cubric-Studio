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

## Plan Drift

- 2026-10-01 (session 314c5ced, Fabio's go): the offer is NOT for both Flows. A voice line with
  no sample goes to DramaBox when it is installed, and Cosmo writes the voice into the line (no
  library, no card). Only with no DramaBox does Text to Speech (Chatterbox) need a library voice,
  and then the app shows a card (MPI-1005's rule: a click acts with no agent turn, so not
  `[options]` chips). Cosmo picks the voice FIRST and sends it; the card shows the pick:
  "Pick from the voice library" (opens the Flow, no voice) / "Use <voice>" (runs). Fabio's labels.
- 2026-10-01 (Fabio): the agent must know DramaBox performs laughs, sighs, coughs and pauses
  written outside the quotes and Chatterbox does not. The catalogue's `does` carries only the
  description's FIRST sentence (`flowDoes`), so it never learned that: `docs/agent/flows.md` gets
  a spoken-lines section. A line with such a sound and no DramaBox runs on Chatterbox without
  the sounds, and Cosmo says so in one line.
- The voice list hangs off the slot in the catalogue (`media[].voices`, sections: one performer,
  its variation ids), not a new tool. The ref resolves in the renderer's `buildFlow` (shared
  with routines), through the picker's own decode (`voiceWavFile` in `toWavFile.js`).

## Current State

2026-10-01 (session 57bdb71a): look step 1 passed; step 2's card now shows (packaged Flows' media
fixed in `routes/connector.js`). Round 3: Pick opens on Inputs with the voice library open
(`pickVoice`), and voice previews fixed (`MpiVoicePicker`). Vinyl's mic clip folded in. Next:
Fabio restarts the app (server code), checks Pick + previews + Use <voice> + Vinyl; CI on the
fix commits; close in its own commit.
2026-10-01 (session 314c5ced): BUILT, all automated checks green (validation.md), committed and
pushed at handoff. Was BLOCKED on MPI-1008: Fabio has no Text to Speech, so the look runs on
DramaBox (library voice by request), and DramaBox's text encode fails with a device mismatch on
his 16 GB card, now on a fresh run too, not only the first. Fix MPI-1008 first, then the look:
(1) the cough in a DramaBox line, (2) "use DramaBox with a voice from the library: an old man
says ..." -> card -> Use Elderly Male -> listen, (3) same -> Pick from the voice library -> DramaBox
opens with the line and the voice empty. Fabio must restart the app (server code changed). Then
watch CI for the code commit and close in its own commit.
- Folded in after his first look: both choice cards skip a Flow that is not installed
  (`_flowRunnable`, a cached "missing" re-read first), and `flows.md` lets a user ask for a library
  voice on DramaBox.
- Gotchas: `CHOICE_CARDS` (agentLoop.mjs) is the one list of choice cards; the chat's twin and
  `routes/agent.js` `_CHOICES` must follow it. The voice list is per SECTION (a performer), not
  per voice. `flows.md` lost the "voice sample -> open the Flow" advice; Song moved below the
  open/scribble paragraphs MPI-1005 had split.
