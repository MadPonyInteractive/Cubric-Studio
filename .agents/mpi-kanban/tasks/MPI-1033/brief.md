# MPI-1033 - H3 Reference: anchor a soundtrack so the clip keeps it

Raised 2026-10-06 by Fabio, after a session (MPI-1032) where Cosmo and then I both said H3
"never copies" input audio. Fabio: H3 does music videos off an input track, so it must be able
to take audio in and keep it. He is right; our graph is the limit, not the model.

## What is true today (verified 2026-10-06 against code, not docs)

H3 takes audio two ways, both in core `comfy_extras/nodes_minimax_h3.py`:

| Path | Node | Conditioning | What happens to the audio |
|---|---|---|---|
| Reference | `MiniMaxH3ReferenceToVideo` (`ref_video_audio_N`, `ref_audio_N`) | `minimax_refs` | steers; H3 generates its own sound |
| Anchor | `MiniMaxH3AddGuide` (`audio`, `frame_idx`) | `minimax_keyframes[].audio_latent` | pinned on the timeline from `frame_idx`, cropped to the clip's remaining length; the picture is made around it |

- `comfy/model_base.py:2183` builds ONE payload from both `minimax_keyframes` and `minimax_refs`, so the engine accepts a reference run with an audio anchor. Nobody has run that on the ref2va DiT.
- Our `minimax_h3_r2va.json` has `MpiH3References` (MpiNodes) and NO `MiniMaxH3AddGuide`: audio can only enter as a reference. A sounded reference video's own soundtrack is fed automatically as a reference (`docs/models/h3/ref2va.md` § "Prompt tags are SLOT numbers").
- `minimax_h3_fl2va.json` (MiniMax H3) takes no audio at all (`models.js` comment at the minimax-h3 card).
- `flow_h3_extend.json` keeps the source clip's own audio through `MpiH3EncodeAV` + `MpiH3MaskedPrefix`.

## The job

1. Bench test first (G:/ComfyUi, ref2va weights): chain `MiniMaxH3AddGuide(audio, frame_idx 0)` after the reference conditioning. Pass = the output soundtrack matches the anchored track (compare waveforms), and references still hold. Say before using Fabio's local GPU.
2. Check whether `MpiH3References` (c:/AI/Mpi/ComfyUi-MpiNodes) already exposes an anchor, before adding a node.
3. Product shape is Fabio's call: anchor a standalone audio chip (music video), keep the reference video's own soundtrack, or both. Ask before building the control.
4. Then wire it: graph template + generator script + runtime json (the three r2va files), the app control, `docs/models/h3/ref2va.md`.

## Ordering

AFTER MPI-1029: a peer session is re-syncing the same r2va workflow from Fabio's template, and Fabio has uncommitted edits in all three r2va files (24 fps on the video loaders). Do not touch those files until both land.
