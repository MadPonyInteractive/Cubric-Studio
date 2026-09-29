# MPI-974 validation

## Cause (from Fabio's run, app.log 2026-09-29T09:57:39Z)

`MpiAudioSplice`: 281600-sample patch at 88267 (start -211) runs 267 samples past a 369600-sample
track. Source 90 frames, context 39, 8 s added -> H3 length 226 frames. Core
`temporal_shape` sizes audio `round(226 * 40 / 24) = 377` steps x 800 = 301600 samples at 32 kHz,
against 301333.3 for 226 picture frames: +267. #953 (`(context - 24) - length`, counted from the
END) assumed the two are equal. Frames % 3 == 1 raises; == 2 splices 267 samples early, silently.

## Fix

`comfy_workflows/raw/flow_h3_extend.json` #953: `a - 24` on `Input_Video.frame_count` (the join),
link to #974 dropped. Synced with `COMFY_URL=http://127.0.0.1:48188 node scripts/sync-raw-workflows.mjs`
(raw commit 744c58ad0; injection rules clean). Only #953 changed in the runtime graph.

## Evidence

- `splice_check.py` (here): the REAL MpiNodes `MpiH3Length` / `MpiAudioRange` / `MpiAudioSplice`
  plus core AudioConcat rate matching, on synthetic audio, 10 durations x contexts 39/90/141 x
  sources 90/97/124/226 frames x source rates 32k/44.1k, run on the engine's python:
  OLD 192/240 raise or misplace (reproduces Fabio's exact message at 90 frames / 39 / 8 s);
  NEW 0/240, every patch within 2 samples of the join.
- `tests/flow-model-choice.test.cjs` MPI-974 test: fails on the old graph (#953 reads 213:0),
  passes on the new. `npm test`: 2246 pass, 0 fail, 2 skipped.

## Open

Fabio's rerun of an 8 s H3 extend (~22 min on his GPU). Not run by the agent: his GPU, his app.
