# MPI-829 - validation

## What shipped

A video's audio, baked once as `<id>.wave.webp` and painted inside the trim track, so an
in/out point is cut against a word or a beat instead of guessed. Every surface that mounts
`MpiTrimBar` for video. The GIF bar is out of scope (no audio) but shares the component, so
it inherits the taller track.

Commits: `dce8c096` (the feature), `d5ab374b` (board), plus the height change below.

## Evidence

**Tests** - `tests/video-waveform-derivative.test.cjs`, 7/7 green:

| Case | What it defends |
|---|---|
| wave layer spans the handles cap to cap | the `-8px` inset and the handles' `±8px` are ONE measurement; if a later edit moves one, the look regresses silently |
| video wave baked SHORTER than the audio card's | a regression to 540 is a real loss of legibility, not a nicety |
| lands at `<id>.wave.webp`, never the poster name | a collision would overwrite the poster with a waveform |
| both sweeps match and capture the id | delete + orphan sweep; a miss leaks a file per video forever |
| a clip WITH audio bakes a real MASK | asserts on decoded ALPHA - an opaque rectangle paints a solid block and passes any file-exists check |
| a SILENT clip is never baked one | every text-to-video op emits silence; an ungated bake costs an ffmpeg run per generation |
| cleanup drops the file AND nulls `wavePath` | the backfill gates on the sidecar, so a nulled file with a live URL 404s the mask forever |

Neighbours re-run green (34/34): `cleanup-derivatives`, `gallery-renditions`,
`gif-transform`, `reuse-snapshot-defaults`, `audio-waveform-alpha`, `image-thumb-alpha`,
`reuse-video-audio-gate`. eslint clean on every changed file.

**Live** - baked a real wave from a real clip, served it over the app's own `/project-file`
route (200, `image/webp`) into a real `MpiTrimBar` inside an isolated instance, and
screenshotted it. Also rendered Fabio's OWN `i2v_006` wave. The user's `:3000` was never
touched; the instance was stopped via the listener's PARENT so no modal error box reached
his screen.

**Geometry, measured in the real `MpiVideoControlBar`** after the height change:

```
trackH 44   waveH 58   handleH 58
waveTop - handleTop = 0      waveBot - handleBot = 0
control bar row 61px -> 77px
```

The wave and the handles are the same height with their tops and bottoms aligned - the
literal "same size as the handles" Fabio asked for. Silent-clip bar and GIF bar both
re-checked at 44px: mount clean, no layout break.

## Two defects found and fixed during the card

1. **The bake silently ignored its size.** The box constants are `{w,h}` while
   `extractAudioWaveform` destructures `{width,height}`, so passing the constant straight
   through matched NEITHER key, fell back to both audio-card defaults and baked the blurry
   540 anyway - exit 0, valid decodable file, no warning. Only the pixel assertion caught
   it. `extractVideoWaveform` now owns the name and the size together so the write path and
   the backfill cannot drift apart.
2. **The first height was wrong, and the obvious diagnosis was also wrong.** At 28px the
   wave read as a thin smear. The tempting fix was normalising the audio; measuring killed
   it - the clip peaks at **-0.5 dBFS**, a hot master, so normalisation would have changed
   nothing. It was purely the box. Track 28px -> 44px (the mockup's own `.tl-track` height)
   and the wave layer overruns by the handles' `±8px`.

## Not done, deliberately

`js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js` needs ONE line - `wavePath` in its
`loadVideo` meta - for the Flow-result player. A live peer session held that file under
MPI-822 with uncommitted work for the whole of this card, so it was never claimed and never
touched. Owner messaged (`state/messages/cc5c4578-28de-4bfc-ab10-19426c5dbe2c.json`).
Nothing breaks meanwhile: the proxy call is optional-chained, so that one surface shows a
plain trim bar until the line lands.
