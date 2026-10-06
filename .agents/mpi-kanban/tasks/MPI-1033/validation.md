# MPI-1033 validation

## Bench test (2026-10-06, G:/ComfyUi :8188, GPU lease held)

Graph: runtime `comfy_workflows/minimax_h3_r2va.json` @ 3e7ae7dad (one-clear, 24 fps), turbo on, 5 s
(snaps to 124 frames = 5.17 s), 864x480 asked, 832x448 out. Source: `mpi568_ai_cowboys_hi.mp4`
(5.17 s, 1344x768, aac, rhythmic peaks). `MiniMaxH3AddGuide` added after BOTH `MpiH3References`
(#330 stage 1, #688 refine), feeding the packer #873. Builder: session scratchpad `bench.py`.

Scorer `compare.py` (16 kHz mono): self = 1.000 on every metric; an UNRELATED soundtrack
(`mpi568_ai_cowboys.mp4`) = waveform 0.063, loudness envelope -0.095, log-spectrogram 0.625
(spectrogram has a high floor; envelope is the discriminator).

### Run 1 - audio PASSTHROUGH, video as REFERENCE (anchor audio = loader `331` out 1, frame_idx 0)

Prompt: recolour (jet black horse, red wagon cover), same scene/motion/sound. 1140 s on the 4060 Ti.

- Audio vs source: waveform xcorr **0.971** at -4.5 ms, loudness envelope **0.974**, spectrogram 0.858,
  RMS 0.167 vs 0.133. The soundtrack is kept.
- Picture: horse jet black (change applied), wagon cover stayed beige (half the ask), motion and framing
  track the source closely; SSIM vs source (centre-cropped 1344x724 to match the output aspect)
  Y 0.521 / All 0.643, PSNR 20.0.
- Attribution: see Run 3 - the anchor is NOT what kept the sound.

### Run 2 - video PASSTHROUGH, audio as REFERENCE (anchor frames = loader `331` out 0, frame_idx 0)

Prompt: same picture, sound changes to a harmonica over the hoofbeats. All 124 source frames pinned
(fits: 124 = 17*7+5). 1320 s; no OOM at 832x448 with the doubled sequence.

- Picture vs source: SSIM Y **0.755** / All 0.821, PSNR 23.8 (run 1's recolour: 0.521 / 20.0). Visually the
  source clip; regenerated, so not pixel-identical.
- Audio vs source: waveform 0.963, envelope 0.970 - and vs run 1's audio 0.988 / 0.997. The harmonica
  never came: with the soundtrack wired as `ref_video_audio_1` the output reproduced the ORIGINAL sound.
- Codec floor (source re-encoded aac 32 kHz): waveform 1.000, spectrogram 0.991.

### Run 3 - CONTROL: today's graph unchanged, run 1's prompt and seed, nothing anchored

1080 s.
- Audio vs source: waveform **0.964**, envelope **0.970** - the same as the anchored run 1 (0.971 / 0.974);
  vs run 1's audio 0.989 / 0.997.
- Picture vs source SSIM Y 0.522 (run 1: 0.521); control vs run 1 picture SSIM Y 0.935.

## Findings

1. **Video changed, audio kept: works on TODAY's graph.** A sounded reference video's own soundtrack
   (`ref_video_audio_1`, wired automatically) comes back at ~0.97 with or without `MiniMaxH3AddGuide`; the
   audio anchor changed almost nothing (outputs 0.935 alike). The 2026-10-06 "H3 never copies input audio"
   claim is wrong for this case. One clip only (rhythmic hoofbeat-style track; speech/music untested), and
   0.97 is regenerated sound, not the source bytes (codec floor 1.000).
2. **Video kept, audio changed: picture half works, audio half does not yet.** Pinning the source frames
   with `MiniMaxH3AddGuide(image)` holds the picture (SSIM 0.755 vs 0.52). But with the soundtrack still
   wired as a reference the asked-for new sound never came - the original came back (0.99 to run 1).
   Untested: the same run with `ref_video_audio_1` unwired.
