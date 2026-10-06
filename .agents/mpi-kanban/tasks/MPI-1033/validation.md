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

### Run 4 - SPEECH, control graph (today's, nothing anchored), `bench.py speech`

Source `lipdub_input.mp4` (3.04 s, 1920x1088, a woman talking on a night rooftop; 78% voiced frames,
syllable-rate envelope share 0.50 vs the hoofbeat clip's 0.21). Duration 3, turbo, prompt: same words,
same voice, same motion and framing, dress emerald green. 610 s, GPU lease held.

- Audio vs source: waveform **0.955** at -9.3 ms, envelope **0.960**, spectrogram 0.857, RMS 0.056 vs 0.052.
  Unrelated SPEECH baselines (vs `lipdub_input_v2.mp4`, `mpi568_real_portrait.mp4`): waveform 0.080 / 0.019,
  envelope 0.075 / -0.355. The speech is kept.
- Picture: dress emerald green (the cut changed too: satin bodice for the V-neck), same woman, motion and
  framing at 0.5 / 1.5 / 2.5 s; SSIM vs source (cropped 1920x1034) Y **0.704** / All 0.744.
- LIP-SYNC NOT TESTED (Fabio caught it): this is a lip-dub INPUT, a voice laid over a woman whose mouth never
  opens; the output keeps both as they were. It proves a speech soundtrack survives, nothing about mouths.
  An on-camera talker on the bench: `mpi568_real_portrait.mp4` (2.7 s, 678x1214, 30 fps, mouth visibly moving).

### Run 5 - TALKING PORTRAIT, control graph, `bench.py portrait` (Fabio asked, 2026-10-06)

`<Picture 1>` = the sheriff close-up cropped from `cowboys/Media/detail_006.png` (`mpi1033_sheriff_portrait.png`),
`<Audio 1>` = `Boss_3s.mp3` ("You better stop right there", 3.04 s, words confirmed by Fabio on MPI-538). Prompt
quotes the line and says he speaks it "exactly as recorded". 120 s (models warm). Output `portrait_00001.mp4`.

- Audio vs the input line: envelope **0.968** at -8.5 ms, waveform 0.778, spectrogram 0.852. Other line
  (`Henchman_3s.mp3`) vs output: 0.43 envelope / 0.063 waveform, the same as Boss vs Henchman (0.43 / 0.071).
  The recorded line comes back with its timing; lower waveform than run 4 (0.955) = re-voiced more, plus wind.
- Lips (8 fps mouth strip): closed in the silence before the line, open and moving through ~0.6-2.1 s while the
  line plays, closed again after. The dark-pixel proxy is useless here (the moustache is the darkest thing).
  Lip-sync quality is Fabio's eye: preview sent as WebM. **Fabio 2026-10-06: "that's really good."**
- Agent text: `docs/agent/models/minimax-h3.md` Speech bullet said a voice reference gives only the timbre;
  corrected in place (new words: timbre; its own words quoted: the recorded line, lips moving to it).
- Product call (Fabio 2026-10-06): NO pass-through, NO graph wiring, NO toggles. Today's graph already keeps the
  sound in sync with the picture it generates; a remux would add length and lip-sync risk for byte-exact audio.
- Reopened 2026-10-06 (Fabio's yes): `docs/models/h3/ref2va.md` § "Lip-sync is NOT established either way" asked
  for exactly run 5; replaced in place with the result (same length).

## Findings

1. **Video changed, audio kept: works on TODAY's graph.** A sounded reference video's own soundtrack
   (`ref_video_audio_1`, wired automatically) comes back at ~0.97 with or without `MiniMaxH3AddGuide`; the
   audio anchor changed almost nothing (outputs 0.935 alike). The 2026-10-06 "H3 never copies input audio"
   claim is wrong for this case. Speech holds too (run 4: 0.955 / 0.960); music untested. It is
   regenerated sound, not the source bytes (codec floor 1.000).
2. **Video kept, audio changed: picture half works, audio half does not yet.** Pinning the source frames
   with `MiniMaxH3AddGuide(image)` holds the picture (SSIM 0.755 vs 0.52). But with the soundtrack still
   wired as a reference the asked-for new sound never came - the original came back (0.99 to run 1).
   Untested: the same run with `ref_video_audio_1` unwired.
3. **Vendor agrees.** MiniMax's own `skills/h3-prompt-writing/references/ref-en.txt` (read 2026-10-06) names
   `<Video N>` "an editing source" and the task types `[video editing + audio reuse]`: "When editing a source
   video, use `audio reuse` as well if its original audio remains audible." The other skills hold nothing on
   passthrough (`music-video-subtitle-generator` assembles clips onto a master track outside the model).

## Agent text corrected (2026-10-06, Fabio's yes; wrong sentences fixed in place, no new instruction lines)

- `js/data/commandRegistry.js` `ref2v_ms` help (also the Prompt Box help): "none of them appears in the output
  as-is" -> a picture never does; a clip can be edited, keeping its own soundtrack, speech included.
- `js/data/modelConstants/modelPriority.js`: shared `REF_NOTE` lost "the clip is made new around them" (it also
  reaches the cloud `ref2v` of Seedance 2.0 / Wan 3.0, unmeasured, so the edit claim is NOT there); the measured
  edit + "keep the picture, change the sound = the Add Foley Flow" went on H3's own note
  `minimax-h3-ref2va:ref2v_ms`. Composed notes read back with `opPriority()`.
- `docs/agent/models/minimax-h3.md` card line: same edit sentence + the Add Foley pointer.
- Checks: `npm test` 2727 tests, 2725 pass, 0 fail; `tests/model-priority`, `connector-agent-tools`,
  `agent-prompt-budget` 46/46 after the last edit; eslint clean on both JS files.
- Fabio 2026-10-06: "1" - the Prompt Box help text reads right.
