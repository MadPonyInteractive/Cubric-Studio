# MPI-1071 - Speech to text on ComfyUI (local)

## Goal (Fabio, 2026-10-11)

Speech to text that runs on ComfyUI, picked in Settings > "Where each job runs" beside
Prompt enhancement and Image descriptions. Today dictation (MPI-946, `docs/dictation.md`)
only runs Whisper on the user's DeepInfra key. Possibly a Flow as well.

## Order

1. **Settings row first.** "Speech to text": Remote (DeepInfra Whisper, today's path) or
   ComfyUI (local). Same shape as the enhance backend: the ComfyUI pick runs a registered op
   (compare `promptEnhance` / `COMFY_ENHANCE_OP` in `js/services/llmService.js`), and the
   panel is `js/components/Organisms/MpiLlmSettings/MpiLlmSettings.js` (~line 164).
   Dictation (`js/services/dictation.js`) then honours the pick, so a user with no DeepInfra
   key can dictate locally (today the mic is greyed without one).
2. **Transcribe Flow second.** A sound or video card in, text + SRT out (QwenASR's
   Subtitle node). Burned-in subtitles would need our own MpiNodes node: the only pack that
   does it is non-commercial (below).

## Research (2026-10-11)

No speech-to-text node is pinned in `dev_configs/node_lock.json`, and ComfyUI core has no
native transcription node that we could find.

| Pack | Model | Licence | Verdict |
|---|---|---|---|
| 1038lab/ComfyUI-QwenASR | Qwen3-ASR 0.6B / 1.7B + 0.6B ForcedAligner (Apache-2.0) | code GPL-3.0 | **Pick.** Nodes: ASR (AUDIO -> TEXT), Subtitle (TEXT, SUBTITLES, LANGUAGE), Forced Align. Needs transformers >= 5.13; our engine pins `transformers==5.13.0` (`dev_configs/python_deps.txt`). v1.1.0 dated 2026-09-11. |
| DarioFT/ComfyUI-Qwen3-ASR | same models | not checked | Alternative. |
| yuvraj108c/ComfyUI-Whisper | Whisper, all sizes | **CC BY-NC-SA 4.0** | Cannot ship (non-commercial). Has the subtitle-burn nodes. |
| AIFSH/ComfyUI-WhisperX, obvirm/ComfyUI-WhisperCPP | Whisper | not checked | Diarization + SRT; heavier deps. |

Models: Qwen3-ASR covers 30 languages + 22 Chinese dialects (vendor claims SOTA among open
models, unverified). Parakeet TDT 0.6B v3 beats Whisper large-v3 on English but covers 25
European languages and has no ComfyUI node found.

## Open questions for the plan

- GPL-3.0 node code: check against how we bundle node packs (`installRequirements`, Pod image).
- VRAM of 0.6B vs 1.7B: not measured. Default is likely 0.6B.
- Dictation records WebM/Opus; check ComfyUI `LoadAudio` decodes it, or remux to WAV
  (`MpiAudioRecorder` already does that for saved recordings).
- Does the "Dictate in English" translate toggle have a local equivalent? Qwen3-ASR is
  recognition only; translate may stay Remote-only.
- Weights go through the normal dep path (`/mpi-add-model` playbook: R2 upload, deps entry).

## Noticed

- 2026-10-11: after the server ensure re-cloned MpiNodes and restarted ComfyUI (19:44:12), the RENDERER drift heal (js/shell.js getDriftedNodeDeps, a pre-install check) re-cloned it AGAIN 2 s later: a wasted clone and likely a second ComfyUI restart on the first generation. Two heal paths for one job; with force in the server ensure the renderer one may be redundant.
- 2026-10-12: an agent sending a .webm voice recording to a Flow's audio role is refused ("that is video", by extension); it works as video1. Transcribe takes both, so not blocking.
