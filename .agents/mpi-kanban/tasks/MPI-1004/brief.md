# MPI-1004 Brief

Cosmo picks a library voice itself when a voice line has no sample.

Umbrella: MPI-1000 (plan.md there holds the phase order). This card's own plan: `plan.md`.

## Why

Fabio, 2026-09-30 (MPI-892 look): a spoken line asked for with no voice sample ("an old man
saying ...") dead-ends on "You didn't give me a voice sample. I can open the Flow for you." The
app ships a voice library of 60 voices; Cosmo should be able to use it.

## Shape (Fabio)

Cosmo offers `[Pick from the voice library | You pick one]`.

- Pick from the voice library: open the voice Flow with the library in its picker (today's
  open-the-Flow offer, `open: true`).
- You pick one: Cosmo chooses a library voice to match the words ("an old man", "a documentary
  voice", "a girl"), passes it as the sample, and runs.
- Both voice Flows: Text to Speech (Chatterbox) and DramaBox. Fabio: they work the same way, so
  never judge by DramaBox alone.

## What is true today (read 2026-09-30)

- Text to Speech (`flowChatterBox`, `js/data/commandRegistry.js:1306`): `audio1` is REQUIRED.
  The graph's loader `#54` has `block_if_empty: true`, so no sample = a refusal
  (`MEDIA_REQUIRED` in `js/shell/agentDispatch.js:1057`), and the agent's early-refusal text
  offers to open the Flow (`services/agentLoop.mjs:2105`).
- DramaBox (package, `c:/AI/Mpi/Cubric-Flows/drama-box/flow.json`): `audio1` is optional
  (`required: false`), so no refusal fires; a run with no sample uses DramaBox's own voice.
- Both slots declare `voiceLibrary: ['character']` (Chatterbox `js/data/flowsRegistry.js:1623`,
  DramaBox `flow.json:49`). Voice Changer's "Target voice" slot declares it too
  (`flowsRegistry.js:1502`).
- The picker turns a library voice into a file in `MpiMediaPicker._pickVoice`: fetch
  `/voices/<sample>.opus`, decode with `toWavFile`, import. Decoded to WAV on purpose: `opus` is
  missing from the audio extension lists, so a raw `.opus` path would not classify as audio.
- The agent cannot reach the library today: `agentFieldSpecs` carries no voices, and a media ref
  is a card or disk path only.
- Voice metadata (`voices/manifest.json`): `gender`, `age`, `register` (R1-R5 pitch bands),
  `kind` (narration / character / both). Accent is null by design (`voiceLibrary.js:19`).

## Noticed

- 2026-10-01: a failed engine start (`ComfyUI Python not found`, a broken install with "skip local engine" off) leaves the "Starting ComfyUI Engine..." overlay up with the error and no way to close it (`MpiStartingComfy.setError` keeps it visible, `shell.js` comfy:error); a Resize live preview is enough to raise it. Seen on CI run 36848159783.

## Finding (2026-09-30, after Fabio asked "did it pick a library voice or the DramaBox voice?")

Cosmo's last DramaBox run (My Agent Tests, sidecar `c0fc6dff...json`, 19:44) had `mediaItems: []`: NO library voice. Cosmo wrote the voice into the prompt ("An elderly man speaks, gravelly and tired: \"...\"") and DramaBox built it from the words, which is DramaBox's own documented use (`Cubric-Flows/drama-box/flow.json:14`: describe the speaker in the line; a sample is optional). So the library pick only matters where a sample is REQUIRED: Text to Speech. The two-button offer is on hold until Fabio decides (Fabio 2026-09-30: check this first, before any decision on the buttons).
