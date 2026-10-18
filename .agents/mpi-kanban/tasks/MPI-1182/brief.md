# MPI-1182 brief - Fish Audio Drama 3

Umbrella: MPI-1179 (New Models to Test), phase 3. Researched 2026-10-18 from
<https://fish.audio/drama-3/>, the Hugging Face card and LICENSE, and the ComfyUI-Drama3 README
(Fabio's saved copy, `~/Downloads/github.com_PedroMarinhoDev_ComfyUI-Drama3.html`, pack as of
2026-10-17).

**Bench only. Fabio's preference is int8** (2026-10-18).

## What it is

- Fish Audio Drama 3, open weights released 2026-10-13: <https://huggingface.co/fishaudio/drama-3>.
  35B Qwen3.5-style mixture of experts, ~3B active per token (40 layers, 256 routed experts, 8 per
  frame). Code: fish-speech repo; technical report (tag syntax = its Appendix C):
  <https://github.com/fishaudio/fish-speech/blob/main/docs/assets/Fish_Audio_Drama_3_Technical_Report.pdf>
- Directed TTS: voice cloning from a few seconds of audio plus its transcript, up to 16 speakers
  in one text (`<|speaker:N|>`), inline cues (`[laughs]`, `[whispers]`, `[sighs]`) and plain-language
  directions, singing, many languages. 44.1 kHz out.
- Official serving wants one >= 48 GB NVIDIA GPU in FP8. The community pack below is what makes it
  a local candidate.
- Overlaps the DramaBox Flow (speech you direct in words). The bench must say which is better, and
  whether Drama 3 replaces, joins or loses to it.

## Two ComfyUI routes

1. **Official partner node** (Fish Audio Text to Speech, `model = drama-3`, ComfyUI >= 0.39.3):
   Fish Audio's paid API, nothing local. Out of scope: a cloud TTS is a new outbound service and a
   new provider (DeepInfra-only rule).
2. **Community pack ComfyUI-Drama3** <https://github.com/PedroMarinhoDev/ComfyUI-Drama3> (GPL-3.0
   code, Fish Audio Community parts, Apache-2.0 ASR port; 11 forks). **This is the one to bench.**
   No pip install: its CUDA kernels compile at run time through PyTorch NVRTC. Clone into
   `custom_nodes`, restart.

## ComfyUI version - the blocker

README Requirements table: **minimum v0.40**, tested on **v0.41.0 and master after v0.41.2**
("after v0.41.2 decodes about 2% faster"). Performance table ran on ComfyUI v0.41.

The shipped engine pins **v0.39.0** (`dev_configs/node_lock.json`), and the G:\ComfyUi bench is on
0.39.0 too. The v0.42.0 bump planned for MOSS-Image (MPI-1180, covering FLUX.3 Klein MPI-1181)
covers this card as well. v0.42.0 is newer than anything the pack lists as tested: confirm the pack
still loads there.

## Files - int8 is the pick

Converted weights: <https://huggingface.co/PedroMarinhoDev/Drama-3-ComfyUI> (third-party
conversions; `tools/convert.py` rebuilds them from the official checkpoint).

| File | Folder | Size | RAM (experts in RAM) | Note |
|---|---|---|---|---|
| `drama3_fp8experts_bf16` | diffusion_models | 38.6 GB | ~48 GB | Fish Audio's own expert bytes |
| **`drama3_int8experts_bf16`** | diffusion_models | **38.7 GB** | **~48 GB** | int8 ConvRot. Fastest under 24 GB; 0 silent takes in 12 |
| `drama3_w6a8experts_bf16` | diffusion_models | 32.7 GB | ~40 GB | 0 silent takes in 16 |
| `drama3_w4a8experts_bf16` | diffusion_models | 24.6 GB | ~32 GB | falls silent more often on real clips |
| `drama3_codec` | vae | 1.6 GB | - | required; never in VRAM beside the model |
| `qwen3_forced_aligner_0.6b_bf16` | asr | 1.8 GB | - | optional: per-word timing in Drama 3 Editor |

Why int8 (README): same size as FP8, measured as close to the original, and only int8 experts get
CPU help when the VRAM cache misses, so it runs ~2x FP8 on a 4 GB cache. On a 24 GB card the
smaller files are fastest. W6A8 is the fallback if 48 GB RAM proves too much.

**RAM is the real gate, not VRAM:** the int8 file needs ~48 GB of system RAM. The photographer
tester (16 GB RAM) cannot run any build; even W4A8 needs ~32 GB.

## Qwen3-ASR - reuse ours, skip the pack's

The pack's `Load Qwen3-ASR` reads its OWN single-file conversion from `models/asr`
(`qwen3_asr_0.6b_bf16` 1.6 GB / `1.7b` 4.1 GB). We already ship Qwen3-ASR 0.6B as the
`speech_to_text/qwen3-asr-0.6b/` Hugging Face folder for the MpiSpeechToText node (MPI-1071,
`js/data/modelConstants/assetDeps.js`). `Drama 3 Encode Voice` takes the transcript as text, so feed
it from our node and add no ASR dep. The README found 0.6B and 1.7B give nearly the same transcripts
of clean speech, with 0.6B twice as fast. Confirm that on the bench.

## Speed claims to reproduce (pack's table, int8, 9 s line, i9-14900K)

21.5 frames per second of speech, so 46 ms/frame = real time.

| GPU | Expert cache | ms/frame | 9 s line | Peak VRAM |
|---|---|---|---|---|
| RTX 3090 | 16 GB | 23.2 | 6.7 s | 21.8 GB |
| RTX 3090 | 4 GB | 34.4 | 8.0 s | 10.6 GB |
| RTX 3090 held to 12 GB | automatic | 37.5 | 8.4 s | 9.6 GB |
| RTX 3090 held to 8 GB | automatic | 45.8 | 9.9 s | 6.7 GB |
| RTX 4090 | 16 GB | 20.2 | 6.1 s | 21.8 GB |

The "held" rows SIMULATE a small card by filling the 3090's memory from another process; nobody
measured a real 8 GB card. int8 offloads part of the expert compute to the CPU, so a weaker CPU than
the 14900K gets less help: measure on a real 8 or 12 GB card and a mid CPU.

## Pack traps to carry into any wiring

- Sampler: keep `top_k 0`, temperature 1.0, top_p 0.9 (the Space's defaults). Fish Audio's
  server sends top_k 30, which silenced 11 of 40 takes at pauses.
- The voice transcript must cover every word of the clip, cut between sentences, or takes go silent.
- Dialogue: give EVERY speaker a voice or later chunks swap voices (6 of 16 lines without, 1 of 18 with).
- First run reads the whole 38 GB file from disk (minutes); later runs start in seconds. Users need
  the "every action shows itself" progress for that load.
- Save/Load Drama 3 Voice keeps a cloned voice as a few-KB `.safetensors`: a natural fit for our
  voice library.

## Licence - Fish Audio Community License v1.0 (read 2026-10-18)

LICENSE file: <https://huggingface.co/fishaudio/drama-3/blob/main/LICENSE>. The HF metadata tag says
"fish-audio-research-license" but the file is the Community License.

- Commercial use only while annual revenue < US$500k (notify within 30 days of passing it).
- A **Hosted Service** (a TTS or voice-cloning API or app) needs a separate licence at any revenue.
  Check that a user's own RunPod Pod run from our app is not that.
- Distribution: ship the Agreement + a NOTICE file, and **prominently display "Built with Fish
  Audio"** in a product that uses it.
- Outputs: no cloning an identifiable person without consent, no fraud, no sexual content with
  minors, no removing watermarks, no training speech models on outputs.
- Gate it like the other licensed models (`js/data/modelConstants/licences.js`): a NEW licence entry.
- The pack's code is GPL-3.0. It runs as a separate custom node in the user's ComfyUI; confirm that
  keeps our app clear before shipping it.

## Done when

A verdict in `validation.md`: wire it (an `/mpi-add-model` or `/mpi-add-flow` card) or drop it. It
needs:
- int8 speed, VRAM and RAM measured on a real 8-12 GB card;
- a side-by-side against DramaBox on the same lines (cues, cloning, two-speaker dialogue);
- a take with our Qwen3-ASR 0.6B feeding the transcript;
- the pack loading on the engine version we bump to;
- the Hosted Service and GPL answers.
