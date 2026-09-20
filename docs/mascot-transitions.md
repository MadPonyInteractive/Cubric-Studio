# Transitions: overlay clips for the hover swap

> **Moved here from MadPony-Identity on 2026-09-20.** This is the record of HOW the clip was made - prompt, seed, what failed and why. To wire a clip, read `mascot-placement.md` and `mascot-gif-manifest.md` instead.

MPI-78 phase 2, fourth batch, rolled by agent 2026-09-16. Spec: `mascot-placement.md` § Transitions and rule 11 (Fabio,
2026-09-16). A transition is not a mascot clip. The app plays it on a layer above the mascot on hover or click, swaps the
mascot's clip underneath at the transition's **swap time**, and the new clip shows as the effect clears. The app picks one
of the mascot's three at random. Each clip is rendered on pure black and composited with CSS screen blending, so the black
drops out with no cut-out and soft edges survive.

## Settings

- **Plain MiniMax H3** (`minimax-h3`), **text to video** (`t2v_ms`), no start or end frame. 1:1, quality medium
  (768x768), turbo on, seed random, `Input_Duration` 1. Each card is named as it lands (`cardName` on
  `/connector/generate`). About 90s a clip on the 4060 Ti.
- **The length is 0.917s (22 frames), not exactly 1s.** H3 can only make 17k+5 frames at 24fps (`MpiH3Length` in
  `ComfyUi-MpiNodes/h3.py`): a 1s request snaps to 22 frames, and the next length up is 56 frames (2.33s). 22 frames is
  far below the 124-362 frames H3 was trained on, and it still animates cleanly: every clip below moves, peaks and breaks up
  inside its 22 frames.

## Rules every prompt follows

- **Effect only.** No character, no object, no scenery. Plain solid pure black background (measured exactly 0,0,0 on
  every empty pixel).
- **Light colours only**, outlines in a deeper shade of the same colour, never dark: screen blending turns anything dark
  into nothing, so a dark outline would leave a gap.
- **Opens on empty black, peaks mid-shot over the centre, and is meant to be gone a few frames before the end.**
- **Self-contained: nothing ever reaches the edge of the frame** (Fabio). This is the rule that drove four rounds, below.
- The tail bans text, letters and words (comic explosions invite lettering). "No flicker" is dropped for Vision's camera
  flash and Studio's TV switch, where a light is meant to flash.

| Mascot | Colours (outline) | Third transition |
|---|---|---|
| Vision | bright pink, pale pink, pinkish white (deep rose pink) | camera flash: a round flash with short points, twinkles out |
| Studio | pale beige, warm cream, light lilac mauve (soft medium mauve) | tv switch: an old TV screen of light static snaps on from a line and switches off to a dot |
| Prompt | bright yellow, pale lemon, warm white (deep golden yellow) | speech bubble pop: a pixel-outlined speech bubble inflates and pops into pixel blocks |
| Audio | bright teal, pale aqua, minty white (deep teal) | sound pulse: a speaker-thump disc with a ring and a few music notes |
| Video | bright orange, pale peach, warm white (deep orange) | film reel burst: a film strip winds into a reel and bursts into stars |

Every mascot also gets a **smoke puff** (the ninja smoke Fabio referenced) and a **cartoon explosion**.

## Rounds: getting everything inside the frame

H3 draws speed lines, long spikes and flying debris that run to the frame edge, and it ignores a sentence that bans them.

1. **Probe, `t2v_001`** (probe wording at the end of this file). The look was right first time: a flat pink cartoon puff.
   But speed-line streaks reached the corners, and the puffs, told to drift "a little outward", spread into a ring that
   was still on screen in the last frame. Fix for round 1: pieces shrink where they are, the last frames are empty, the
   effect fills the middle two thirds, and a sentence bans speed lines.
2. **Round 1, all 15** (`t2v_002`-`016`). 8 still reached the edge, and two never cleared: the sound pulse kept its disc
   and the film reel sat still for the last 10 frames. Round 2 wording: the effect is about half the frame, and those two
   are told they are gone by three quarters of the way through.
3. **Round 2, 10 rerolls** (`t2v_017`-`026`, cards "... 2"). An app reload dropped the last 4 from the queue and they were
   resubmitted. 3 came out clean, and the explosions still threw thin streaks and dashes to the edge. Round 3 wording
   stops banning things and says what IS there: solid rounded shapes, short fat triangle points, round debris, an empty
   outer frame.
4. **Round 3, 8 rerolls** (`t2v_027`-`034`, cards "... 3"). 2 clean. Round 4: the same wording at a third of the frame,
   with two tries for each explosion still missing (the second told apart only by its sound line, cards "... 4 b").
5. **Round 4, 10 rerolls** (`t2v_035`-`044`, cards "... 4" and "... 4 b"). 7 clean, which closed every explosion and
   the sound pulse. The speech bubble stayed inside the frame but never popped (seen on the frames).
6. **Round 5, 2 speech bubbles** (`t2v_045`, `t2v_046`, cards "... 5" and "... 5 b"): round 4's wording with the pop
   pinned to the middle. Both stay inside the frame and both pop, but only in the last few frames, so pixel blocks are
   still on screen at the end. That still works as a transition, since the pop is what reveals the new clip, so `t2v_045`
   is the pick. Five rolls in, H3 will not pop the bubble mid-clip in 22 frames.

The smaller the effect, the more often it stayed inside: the round 4 clips span 52-69% of the frame, where round 1's
reached 67-94%.

**Every clip that reaches the edge is archived** in the gallery (Fabio, 2026-09-16). Nothing is deleted. Clips that stay
inside the frame but fail another way (a film reel that never clears, a bubble that never pops) are not archived, and
their Result names the clip that replaces them.

## Checks

Every clip: sidecar prompt identical to the one below, `minimax-h3` `t2v_ms`, no media, 768x768 1:1 turbo,
`Input_Duration` 1, not preview-only, card named after its heading, ffprobe 22 frames. Then measured, a pixel counting as
lit above 40/255:

- **Touch:** lit pixels on the outer 3px of the frame, worst frame, at full size. **0 is the pass mark**; anything else
  reaches the edge and is archived.
- **Size:** how much of the frame the effect spans on its fullest frame (1st-99th percentile of the lit box). The later
  rounds are smaller on purpose, so the app should scale each clip's layer by this to hide the mascot equally.
- **Start / End:** lit share of the whole first and last frame. A non-zero End means small pieces are still on screen
  when the clip stops; fading the layer out over the last few frames hides that.
- **Centre:** the peak lit share of the middle 50% box.
- **Swap:** the frame where Centre peaks, the moment the mascot is most hidden, as a frame number and as seconds from the
  start (frame 1 = 0.000s). This is the time the app swaps the clip at.

## Picks: what the app plays

One clip per slot that never reaches the edge (Touch 0) and does not stay over the centre. Swap is when to swap the
mascot's clip underneath. Size is how much of its 768px frame the effect spans at its fullest, for scaling the layer.
End above 0 means small pieces are still on screen in the last frame: fade the layer out over its last few frames.
**Approved by Fabio in the app, 2026-09-16:** all 15 look good and stay inside the frame.

| Mascot | Transition | Card | Name in the gallery | Swap | Size | End |
|---|---|---|---|---|---|---|
| Vision | smoke puff | `t2v_002` | Vision transition smoke puff | frame 15, 0.583s | 78% | 20.5% |
| Vision | explosion | `t2v_035` | Vision transition explosion 4 | frame 11, 0.417s | 60% | 3.8% |
| Vision | camera flash | `t2v_028` | Vision transition camera flash 3 | frame 10, 0.375s | 69% | 0.0% |
| Studio | smoke puff | `t2v_019` | Studio transition smoke puff 2 | frame 15, 0.583s | 57% | 8.5% |
| Studio | explosion | `t2v_029` | Studio transition explosion 3 | frame 9, 0.333s | 64% | 4.0% |
| Studio | tv switch | `t2v_007` | Studio transition tv switch | frame 9, 0.333s | 82% | 0.0% |
| Prompt | smoke puff | `t2v_008` | Prompt transition smoke puff | frame 12, 0.458s | 68% | 10.4% |
| Prompt | explosion | `t2v_037`; alternate `t2v_038` | Prompt transition explosion 4 | frame 10, 0.375s | 66% | 2.7% |
| Prompt | speech bubble pop | `t2v_045`; alternate `t2v_046` | Prompt transition speech bubble pop 5 | frame 8, 0.292s | 69% | 10.5% |
| Audio | smoke puff | `t2v_011` | Audio transition smoke puff | frame 14, 0.542s | 72% | 11.3% |
| Audio | explosion | `t2v_039` | Audio transition explosion 4 | frame 10, 0.375s | 69% | 6.0% |
| Audio | sound pulse | `t2v_044` | Audio transition sound pulse 4 | frame 8, 0.292s | 64% | 0.0% |
| Video | smoke puff | `t2v_024` | Video transition smoke puff 2 | frame 15, 0.583s | 55% | 7.5% |
| Video | explosion | `t2v_042` | Video transition explosion 4 b | frame 12, 0.458s | 54% | 3.1% |
| Video | film reel burst | `t2v_026` | Video transition film reel burst 2 | frame 12, 0.458s | 48% | 0.1% |

## Rolls

| Round | Clip | Card | Seed | Time | Touch | Size | Start | End | Centre | Swap | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| probe | Vision transition smoke puff (probe) | `t2v_001` | 425884943 | 102s | 622 | 83% | 0.0% | 6.0% | 99.8% | f11 (0.417s) | Reaches the edge, **archived** |
| 1 | Vision transition smoke puff | `t2v_002` | 1712315505 | 92s | 0 | 78% | 0.0% | 20.5% | 99.8% | f15 (0.583s) | **Pick** |
| 1 | Vision transition explosion | `t2v_003` | 1936278950 | 92s | 1842 | 94% | 10.7% | 0.8% | 99.8% | f6 (0.208s) | Reaches the edge, **archived** |
| 1 | Vision transition camera flash | `t2v_004` | 1582251617 | 93s | 496 | 86% | 0.0% | 0.3% | 99.2% | f11 (0.417s) | Reaches the edge, **archived** |
| 1 | Studio transition smoke puff | `t2v_005` | 893920503 | 97s | 419 | 67% | 0.0% | 17.3% | 98.1% | f17 (0.667s) | Reaches the edge, **archived** |
| 1 | Studio transition explosion | `t2v_006` | 960441977 | 93s | 851 | 81% | 0.0% | 1.5% | 99.5% | f8 (0.292s) | Reaches the edge, **archived** |
| 1 | Studio transition tv switch | `t2v_007` | 1008778615 | 89s | 0 | 82% | 0.0% | 0.0% | 100.0% | f9 (0.333s) | **Pick** |
| 1 | Prompt transition smoke puff | `t2v_008` | 16314085 | 96s | 0 | 68% | 0.0% | 10.4% | 99.1% | f12 (0.458s) | **Pick** |
| 1 | Prompt transition explosion | `t2v_009` | 1136793659 | 92s | 271 | 82% | 0.0% | 6.2% | 97.4% | f11 (0.417s) | Reaches the edge, **archived** |
| 1 | Prompt transition speech bubble pop | `t2v_010` | 3622018495 | 97s | 85 | 75% | 0.0% | 0.0% | 92.9% | f11 (0.417s) | Reaches the edge, **archived** |
| 1 | Audio transition smoke puff | `t2v_011` | 3130763624 | 86s | 0 | 72% | 0.0% | 11.3% | 99.6% | f14 (0.542s) | **Pick** |
| 1 | Audio transition explosion | `t2v_012` | 3522047837 | 88s | 568 | 89% | 0.0% | 3.8% | 99.7% | f10 (0.375s) | Reaches the edge, **archived** |
| 1 | Audio transition sound pulse | `t2v_013` | 1543399926 | 89s | 25 | 74% | 0.5% | 20.2% | 100.0% | f6 (0.208s) | Reaches the edge, **archived** |
| 1 | Video transition smoke puff | `t2v_014` | 2140921216 | 84s | 391 | 86% | 0.0% | 7.1% | 99.6% | f9 (0.333s) | Reaches the edge, **archived** |
| 1 | Video transition explosion | `t2v_015` | 47574439 | 85s | 668 | 90% | 0.0% | 1.4% | 92.5% | f7 (0.250s) | Reaches the edge, **archived** |
| 1 | Video transition film reel burst | `t2v_016` | 3707598737 | 84s | 0 | 67% | 2.6% | 19.9% | 95.5% | f10 (0.375s) | Never clears: still over the centre on the last frame; superseded by `t2v_026` |
| 2 | Vision transition explosion 2 | `t2v_017` | 1010459615 | 88s | 243 | 82% | 0.0% | 1.1% | 77.9% | f8 (0.292s) | Reaches the edge, **archived** |
| 2 | Vision transition camera flash 2 | `t2v_018` | 950954526 | 96s | 113 | 79% | 0.0% | 0.2% | 86.1% | f11 (0.417s) | Reaches the edge, **archived** |
| 2 | Studio transition smoke puff 2 | `t2v_019` | 3705590858 | 95s | 0 | 57% | 0.0% | 8.5% | 89.7% | f15 (0.583s) | **Pick** |
| 2 | Studio transition explosion 2 | `t2v_020` | 149697900 | 96s | 29 | 72% | 0.0% | 0.9% | 67.3% | f9 (0.333s) | Reaches the edge, **archived** |
| 2 | Prompt transition explosion 2 | `t2v_021` | 2048746067 | 95s | 768 | 91% | 0.0% | 6.5% | 96.1% | f10 (0.375s) | Reaches the edge, **archived** |
| 2 | Audio transition explosion 2 | `t2v_022` | 2285770906 | 87s | 21 | 67% | 0.0% | 1.8% | 69.3% | f12 (0.458s) | Reaches the edge, **archived** |
| 2 | Audio transition sound pulse 2 | `t2v_023` | 183253055 | 53s | 12 | 59% | 0.0% | 0.0% | 96.6% | f8 (0.292s) | Reaches the edge, **archived** |
| 2 | Video transition smoke puff 2 | `t2v_024` | 3695921780 | 92s | 0 | 55% | 0.0% | 7.5% | 87.4% | f15 (0.583s) | **Pick** |
| 2 | Video transition explosion 2 | `t2v_025` | 3415685228 | 90s | 11 | 61% | 0.0% | 5.1% | 82.2% | f11 (0.417s) | Reaches the edge, **archived** |
| 2 | Video transition film reel burst 2 | `t2v_026` | 2948421922 | 93s | 0 | 48% | 0.0% | 0.1% | 64.5% | f12 (0.458s) | **Pick** |
| 3 | Vision transition explosion 3 | `t2v_027` | 1598708985 | 91s | 400 | 79% | 0.0% | 0.9% | 95.8% | f9 (0.333s) | Reaches the edge, **archived** |
| 3 | Vision transition camera flash 3 | `t2v_028` | 838281563 | 85s | 0 | 69% | 0.0% | 0.0% | 91.1% | f10 (0.375s) | **Pick** |
| 3 | Studio transition explosion 3 | `t2v_029` | 838547492 | 83s | 0 | 64% | 0.0% | 4.0% | 78.3% | f9 (0.333s) | **Pick** |
| 3 | Prompt transition explosion 3 | `t2v_030` | 1025559093 | 86s | 273 | 85% | 0.0% | 19.4% | 99.8% | f13 (0.500s) | Reaches the edge, **archived** |
| 3 | Prompt transition speech bubble pop 3 | `t2v_031` | 3645898906 | 85s | 32 | 71% | 0.0% | 9.0% | 93.6% | f7 (0.250s) | Reaches the edge, **archived** |
| 3 | Audio transition explosion 3 | `t2v_032` | 1228304122 | 83s | 125 | 73% | 0.0% | 5.5% | 95.6% | f12 (0.458s) | Reaches the edge, **archived** |
| 3 | Audio transition sound pulse 3 | `t2v_033` | 3118548835 | 84s | 23 | 79% | 0.1% | 0.0% | 92.4% | f8 (0.292s) | Reaches the edge, **archived** |
| 3 | Video transition explosion 3 | `t2v_034` | 3950696892 | 83s | 50 | 81% | 0.0% | 7.2% | 95.4% | f11 (0.417s) | Reaches the edge, **archived** |
| 4 | Vision transition explosion 4 | `t2v_035` | 221670762 | 84s | 0 | 60% | 0.0% | 3.8% | 77.8% | f11 (0.417s) | **Pick** |
| 4 | Vision transition explosion 4 b | `t2v_036` | 282180808 | 84s | 246 | 79% | 0.0% | 7.3% | 95.6% | f10 (0.375s) | Reaches the edge, **archived** |
| 4 | Prompt transition explosion 4 | `t2v_037` | 1682737031 | 81s | 0 | 66% | 0.0% | 2.7% | 76.4% | f10 (0.375s) | **Pick** |
| 4 | Prompt transition explosion 4 b | `t2v_038` | 92185000 | 81s | 0 | 52% | 0.0% | 3.5% | 64.4% | f10 (0.375s) | Clean, alternate to `t2v_037` |
| 4 | Audio transition explosion 4 | `t2v_039` | 1810328365 | 83s | 0 | 69% | 0.0% | 6.0% | 93.5% | f10 (0.375s) | **Pick** |
| 4 | Audio transition explosion 4 b | `t2v_040` | 3165756832 | 83s | 24 | 69% | 0.0% | 1.0% | 94.5% | f9 (0.333s) | Reaches the edge, **archived** |
| 4 | Video transition explosion 4 | `t2v_041` | 148996008 | 82s | 158 | 82% | 0.0% | 5.4% | 98.9% | f9 (0.333s) | Reaches the edge, **archived** |
| 4 | Video transition explosion 4 b | `t2v_042` | 2512039209 | 81s | 0 | 54% | 0.0% | 3.1% | 59.7% | f12 (0.458s) | **Pick** |
| 4 | Prompt transition speech bubble pop 4 | `t2v_043` | 2715354460 | 85s | 0 | 55% | 0.0% | 13.5% | 70.2% | f9 (0.333s) | Never pops: the bubble is still whole on the last frame; superseded by `t2v_045` |
| 4 | Audio transition sound pulse 4 | `t2v_044` | 506645744 | 96s | 0 | 64% | 0.0% | 0.0% | 59.0% | f8 (0.292s) | **Pick** |
| 5 | Prompt transition speech bubble pop 5 | `t2v_045` | 3082173931 | 94s | 0 | 69% | 0.0% | 10.5% | 79.3% | f8 (0.292s) | **Pick**; pops only in the last frames (H3 would not pop it mid-clip in 22 frames), blocks still on screen at the end |
| 5 | Prompt transition speech bubble pop 5 b | `t2v_046` | 1273906181 | 89s | 0 | 59% | 0.0% | 11.7% | 74.3% | f11 (0.417s) | Clean, alternate to `t2v_045`; pops only in the last frames (H3 would not pop it mid-clip in 22 frames), blocks still on screen at the end |

## Prompts (whole, as rolled)

### Round 1: all 15

Middle two thirds, pieces shrink in place, speed lines banned.

#### Vision transition smoke puff

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright pink, pale pink and soft pinkish white, with thick outlines in a deep rose pink, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon smoke puff bursts out of a single point in the centre of the frame, like a ninja vanishing in a puff of smoke: a tight cluster of round puffy cloud balls that swells fast. By the middle of the shot the puff is at its biggest and thickest, a solid round cloud of overlapping puffy balls that completely covers the centre of the frame. Over the rest of the shot the cloud breaks apart into smaller and smaller round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a soft cartoon poof, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Vision transition explosion

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright pink, pale pink and soft pinkish white, with thick outlines in a deep rose pink, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon explosion goes off in the centre of the frame, like a comic book blast: a jagged spiky starburst with a bright pale pink core flashes out, ringed by round puffy clouds. By the middle of the shot the explosion is at its biggest, a solid burst of short spiky star points and puffy clouds that completely covers the centre of the frame. Over the rest of the shot it breaks into small spiky sparks and little round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Vision transition camera flash

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright pink, pale pink and soft pinkish white, with thick outlines in a deep rose pink, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a camera flash goes off in the centre of the frame, like the flash of an old camera: a small bright point swells into a big round glowing burst with a star-shaped cartoon sparkle at its heart. By the middle of the shot the flash is at its biggest and brightest, a solid round burst of light with short pointed sparkle points that completely covers the centre of the frame. Over the rest of the shot the burst shrinks back towards the centre while four small four-pointed twinkle stars pop out close around it and wink out, and the flash shrinks to a single tiny twinkle that vanishes. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a bright camera shutter click and a tiny rising flash whine, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves.
```

#### Studio transition smoke puff

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in pale beige, warm cream and light lilac mauve, with thick outlines in a soft medium mauve, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon smoke puff bursts out of a single point in the centre of the frame, like a ninja vanishing in a puff of smoke: a tight cluster of round puffy cloud balls that swells fast. By the middle of the shot the puff is at its biggest and thickest, a solid round cloud of overlapping puffy balls that completely covers the centre of the frame. Over the rest of the shot the cloud breaks apart into smaller and smaller round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a soft cartoon poof, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Studio transition explosion

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in pale beige, warm cream and light lilac mauve, with thick outlines in a soft medium mauve, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon explosion goes off in the centre of the frame, like a comic book blast: a jagged spiky starburst with a bright warm cream core flashes out, ringed by round puffy clouds. By the middle of the shot the explosion is at its biggest, a solid burst of short spiky star points and puffy clouds that completely covers the centre of the frame. Over the rest of the shot it breaks into small spiky sparks and little round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Studio transition tv switch

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in pale beige, warm cream and light lilac mauve, with thick outlines in a soft medium mauve, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second an old television screen switches on in the centre of the frame: a tiny bright dot stretches sideways into a thin glowing horizontal line, and the line snaps open upward and downward into a big rounded rectangle, the shape of an old television screen, filled with fuzzy cartoon static made of cream, beige and light lilac specks. It is only the glowing screen itself, with no casing and no frame around it. By the middle of the shot the glowing screen is at its biggest, filled edge to edge with the light fuzzy static, and it completely covers the centre of the frame. Over the rest of the shot the screen switches off like an old television: it squashes down into a thin glowing horizontal line, the line shrinks into a tiny bright dot, and the dot winks out. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a quick crackle of a television switching on and a short electronic blip as it switches off, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves.
```

#### Prompt transition smoke puff

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright yellow, pale lemon yellow and soft warm white, with thick outlines in a deep golden yellow, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon smoke puff bursts out of a single point in the centre of the frame, like a ninja vanishing in a puff of smoke: a tight cluster of round puffy cloud balls that swells fast. By the middle of the shot the puff is at its biggest and thickest, a solid round cloud of overlapping puffy balls that completely covers the centre of the frame. Over the rest of the shot the cloud breaks apart into smaller and smaller round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a soft cartoon poof, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Prompt transition explosion

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright yellow, pale lemon yellow and soft warm white, with thick outlines in a deep golden yellow, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon explosion goes off in the centre of the frame, like a comic book blast: a jagged spiky starburst with a bright pale lemon yellow core flashes out, ringed by round puffy clouds. By the middle of the shot the explosion is at its biggest, a solid burst of short spiky star points and puffy clouds that completely covers the centre of the frame. Over the rest of the shot it breaks into small spiky sparks and little round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Prompt transition speech bubble pop

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright yellow, pale lemon yellow and soft warm white, with thick outlines in a deep golden yellow, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon speech bubble pops up in the centre of the frame: a chunky rounded speech bubble with a stepped pixel-art outline and a little tail at its bottom, inflating fast from a small dot like a balloon. By the middle of the shot the speech bubble is at its biggest, plain and empty inside and filled solid with bright yellow, and it completely covers the centre of the frame. Over the rest of the shot it pops like a balloon into a burst of small square yellow pixel bits and tiny sparkles that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a quick rubbery squeak as the bubble inflates and one crisp pop, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Audio transition smoke puff

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright teal, pale aqua and soft minty white, with thick outlines in a deep teal, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon smoke puff bursts out of a single point in the centre of the frame, like a ninja vanishing in a puff of smoke: a tight cluster of round puffy cloud balls that swells fast. By the middle of the shot the puff is at its biggest and thickest, a solid round cloud of overlapping puffy balls that completely covers the centre of the frame. Over the rest of the shot the cloud breaks apart into smaller and smaller round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a soft cartoon poof, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Audio transition explosion

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright teal, pale aqua and soft minty white, with thick outlines in a deep teal, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon explosion goes off in the centre of the frame, like a comic book blast: a jagged spiky starburst with a bright pale aqua core flashes out, ringed by round puffy clouds. By the middle of the shot the explosion is at its biggest, a solid burst of short spiky star points and puffy clouds that completely covers the centre of the frame. Over the rest of the shot it breaks into small spiky sparks and little round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Audio transition sound pulse

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright teal, pale aqua and soft minty white, with thick outlines in a deep teal, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a speaker thump goes off in the centre of the frame: a small bright point punches out into a solid glowing round disc, like the pulse of a loudspeaker. By the middle of the shot the disc is at its biggest, a solid round bright teal disc ringed by two thick teal rings, and together they completely cover the centre of the frame. Over the rest of the shot the disc shrinks back to the centre while the two thick rings ripple only a little further out, staying in the middle of the frame, as they thin out and vanish, and a few small cartoon music notes pop out close around it, shrink and vanish. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a deep soft speaker thump followed by a short bright musical chime, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Video transition smoke puff

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright orange, pale peach and soft warm white, with thick outlines in a deep orange, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon smoke puff bursts out of a single point in the centre of the frame, like a ninja vanishing in a puff of smoke: a tight cluster of round puffy cloud balls that swells fast. By the middle of the shot the puff is at its biggest and thickest, a solid round cloud of overlapping puffy balls that completely covers the centre of the frame. Over the rest of the shot the cloud breaks apart into smaller and smaller round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a soft cartoon poof, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Video transition explosion

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright orange, pale peach and soft warm white, with thick outlines in a deep orange, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon explosion goes off in the centre of the frame, like a comic book blast: a jagged spiky starburst with a bright pale peach core flashes out, ringed by round puffy clouds. By the middle of the shot the explosion is at its biggest, a solid burst of short spiky star points and puffy clouds that completely covers the centre of the frame. Over the rest of the shot it breaks into small spiky sparks and little round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Video transition film reel burst

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright orange, pale peach and soft warm white, with thick outlines in a deep orange, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a long strip of cartoon film with a row of square holes along each edge whips out of a single point and spins in a tight spiral around the centre of the frame. The film is bright orange and its square holes are filled with pale peach. By the middle of the shot the strip has wound itself up into a big solid round film reel, spinning fast, and it completely covers the centre of the frame. Over the rest of the shot the reel bursts apart into small spinning orange stars and short scraps of film that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills only the middle two thirds of the frame and leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame. It has no speed lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a fast whirring film reel and one light pop, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

### Round 2: 10 rerolls

About half the frame; sound pulse and film reel gone by three quarters.

#### Vision transition explosion 2

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright pink, pale pink and soft pinkish white, with thick outlines in a deep rose pink, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small compact cartoon explosion goes off in the centre of the frame, like a comic book blast: a round burst with short stubby star points and a bright pale pink core, ringed by round puffy clouds. By the middle of the shot the explosion is at its biggest, a solid burst about half as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks into small sparks and little round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide margin of pure black all round it, and no part of it ever reaches the edges of the frame. It has no speed lines, no action lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Vision transition camera flash 2

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright pink, pale pink and soft pinkish white, with thick outlines in a deep rose pink, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a camera flash goes off in the centre of the frame, like the flash of an old camera: a small bright point swells into a round glowing burst with a star-shaped cartoon sparkle at its heart. By the middle of the shot the flash is at its biggest and brightest, a solid round burst of light about half as wide as the frame, with short stubby sparkle points, covering the centre of the frame. Over the rest of the shot the burst shrinks back towards the centre while four small four-pointed twinkle stars pop out close beside it and wink out, and the flash shrinks to a single tiny twinkle that vanishes. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide margin of pure black all round it, and no part of it ever reaches the edges of the frame. It has no speed lines, no action lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a bright camera shutter click and a tiny rising flash whine, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves.
```

#### Studio transition smoke puff 2

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in pale beige, warm cream and light lilac mauve, with thick outlines in a soft medium mauve, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small cartoon smoke puff swells up out of a single point in the centre of the frame, like a ninja vanishing in a puff of smoke: a tight cluster of round puffy cloud balls. It is made only of round puffy cloud balls and nothing else. By the middle of the shot the puff is at its biggest and thickest, a solid round cloud of overlapping puffy balls about half as wide as the frame, covering the centre of the frame. Over the rest of the shot the cloud breaks apart into smaller and smaller round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide margin of pure black all round it, and no part of it ever reaches the edges of the frame. It has no speed lines, no action lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a soft cartoon poof, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Studio transition explosion 2

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in pale beige, warm cream and light lilac mauve, with thick outlines in a soft medium mauve, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small compact cartoon explosion goes off in the centre of the frame, like a comic book blast: a round burst with short stubby star points and a bright warm cream core, ringed by round puffy clouds. By the middle of the shot the explosion is at its biggest, a solid burst about half as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks into small sparks and little round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide margin of pure black all round it, and no part of it ever reaches the edges of the frame. It has no speed lines, no action lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Prompt transition explosion 2

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright yellow, pale lemon yellow and soft warm white, with thick outlines in a deep golden yellow, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small compact cartoon explosion goes off in the centre of the frame, like a comic book blast: a round burst with short stubby star points and a bright pale lemon yellow core, ringed by round puffy clouds. By the middle of the shot the explosion is at its biggest, a solid burst about half as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks into small sparks and little round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide margin of pure black all round it, and no part of it ever reaches the edges of the frame. It has no speed lines, no action lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Audio transition explosion 2

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright teal, pale aqua and soft minty white, with thick outlines in a deep teal, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small compact cartoon explosion goes off in the centre of the frame, like a comic book blast: a round burst with short stubby star points and a bright pale aqua core, ringed by round puffy clouds. By the middle of the shot the explosion is at its biggest, a solid burst about half as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks into small sparks and little round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide margin of pure black all round it, and no part of it ever reaches the edges of the frame. It has no speed lines, no action lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Audio transition sound pulse 2

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright teal, pale aqua and soft minty white, with thick outlines in a deep teal, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a speaker thump goes off in the centre of the frame: a small bright point punches out into a solid glowing round disc, like the pulse of a loudspeaker. By the middle of the shot the disc is at its biggest, a solid round bright teal disc about half as wide as the frame, ringed by one thick teal ring, covering the centre of the frame. Right after the middle the disc and its ring shrink fast back into the centre, down to a tiny dot that vanishes, while a few small cartoon music notes pop out close around it, shrink and vanish. By three quarters of the way through the shot nothing is left of it. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide margin of pure black all round it, and no part of it ever reaches the edges of the frame. It has no speed lines, no action lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a deep soft speaker thump followed by a short bright musical chime, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Video transition smoke puff 2

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright orange, pale peach and soft warm white, with thick outlines in a deep orange, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small cartoon smoke puff swells up out of a single point in the centre of the frame, like a ninja vanishing in a puff of smoke: a tight cluster of round puffy cloud balls. It is made only of round puffy cloud balls and nothing else. By the middle of the shot the puff is at its biggest and thickest, a solid round cloud of overlapping puffy balls about half as wide as the frame, covering the centre of the frame. Over the rest of the shot the cloud breaks apart into smaller and smaller round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide margin of pure black all round it, and no part of it ever reaches the edges of the frame. It has no speed lines, no action lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a soft cartoon poof, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Video transition explosion 2

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright orange, pale peach and soft warm white, with thick outlines in a deep orange, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small compact cartoon explosion goes off in the centre of the frame, like a comic book blast: a round burst with short stubby star points and a bright pale peach core, ringed by round puffy clouds. By the middle of the shot the explosion is at its biggest, a solid burst about half as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks into small sparks and little round puffs that shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide margin of pure black all round it, and no part of it ever reaches the edges of the frame. It has no speed lines, no action lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Video transition film reel burst 2

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright orange, pale peach and soft warm white, with thick outlines in a deep orange, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a strip of cartoon film with a row of square holes along each edge spins out of a single point and winds itself into a tight spiral in the centre of the frame. The film is bright orange and its square holes are filled with pale peach. By the middle of the shot the strip has wound up into a solid round film reel about half as wide as the frame, covering the centre of the frame. Right after the middle the reel bursts apart with a pop into small orange stars and short scraps of film, and the reel is gone. The stars and scraps shrink where they are without moving away from the centre, down to tiny dots that vanish one by one. By three quarters of the way through the shot nothing is left of it. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide margin of pure black all round it, and no part of it ever reaches the edges of the frame. It has no speed lines, no action lines, no streaks and no rays reaching out from it.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a fast whirring film reel and one light pop, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

### Round 3: 8 rerolls

Says what is there instead of banning: rounded shapes, short fat points, round debris.

#### Vision transition explosion 3

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright pink, pale pink and soft pinkish white, with thick outlines in a deep rose pink, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small, chunky cartoon explosion pops in the centre of the frame, like a comic book blast: a round burst with a ring of short, fat triangle points around its rim, each point much shorter than the burst is wide, a bright pale pink core, and round puffy clouds packed around it. By the middle of the shot the explosion is at its biggest, a solid burst about half as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks apart into little round puffs and small round dots that stay close to the centre and shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Vision transition camera flash 3

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright pink, pale pink and soft pinkish white, with thick outlines in a deep rose pink, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a camera flash goes off in the centre of the frame, like the flash of an old camera: a small bright point swells into a round glowing disc of light with a ring of short, fat triangle points around its rim, each point much shorter than the disc is wide. By the middle of the shot the flash is at its biggest and brightest, about half as wide as the frame, covering the centre of the frame. Over the rest of the shot the disc shrinks back into the centre while four small round twinkles pop up right beside it and wink out, and the flash shrinks to a single tiny dot that vanishes. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a bright camera shutter click and a tiny rising flash whine, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves.
```

#### Studio transition explosion 3

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in pale beige, warm cream and light lilac mauve, with thick outlines in a soft medium mauve, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small, chunky cartoon explosion pops in the centre of the frame, like a comic book blast: a round burst with a ring of short, fat triangle points around its rim, each point much shorter than the burst is wide, a bright warm cream core, and round puffy clouds packed around it. By the middle of the shot the explosion is at its biggest, a solid burst about half as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks apart into little round puffs and small round dots that stay close to the centre and shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Prompt transition explosion 3

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright yellow, pale lemon yellow and soft warm white, with thick outlines in a deep golden yellow, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small, chunky cartoon explosion pops in the centre of the frame, like a comic book blast: a round burst with a ring of short, fat triangle points around its rim, each point much shorter than the burst is wide, a bright pale lemon yellow core, and round puffy clouds packed around it. By the middle of the shot the explosion is at its biggest, a solid burst about half as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks apart into little round puffs and small round dots that stay close to the centre and shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Prompt transition speech bubble pop 3

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright yellow, pale lemon yellow and soft warm white, with thick outlines in a deep golden yellow, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon speech bubble pops up in the centre of the frame: a chunky rounded speech bubble with a stepped pixel-art outline and a little tail at its bottom, inflating fast from a small dot like a balloon. By the middle of the shot the speech bubble is at its biggest, about half as wide as the frame, plain and empty inside and filled solid with bright yellow, covering the centre of the frame. Just after the middle it pops like a balloon: the bubble breaks into a small cluster of chunky square yellow pixel blocks right where it was, and the blocks shrink where they are, down to nothing. The pop is shown only by the bubble turning into those blocks. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a quick rubbery squeak as the bubble inflates and one crisp pop, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Audio transition explosion 3

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright teal, pale aqua and soft minty white, with thick outlines in a deep teal, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small, chunky cartoon explosion pops in the centre of the frame, like a comic book blast: a round burst with a ring of short, fat triangle points around its rim, each point much shorter than the burst is wide, a bright pale aqua core, and round puffy clouds packed around it. By the middle of the shot the explosion is at its biggest, a solid burst about half as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks apart into little round puffs and small round dots that stay close to the centre and shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Audio transition sound pulse 3

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright teal, pale aqua and soft minty white, with thick outlines in a deep teal, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a speaker thump goes off in the centre of the frame: a small bright point punches out into a solid glowing round disc, like the pulse of a loudspeaker. By the middle of the shot the disc is at its biggest, a solid round bright teal disc about half as wide as the frame, ringed by one thick teal ring, covering the centre of the frame, with three small cartoon music notes resting right against its rim. Right after the middle the disc, its ring and the notes all shrink fast back into the centre, down to a tiny dot that vanishes. By three quarters of the way through the shot nothing is left of it. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a deep soft speaker thump followed by a short bright musical chime, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Video transition explosion 3

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright orange, pale peach and soft warm white, with thick outlines in a deep orange, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small, chunky cartoon explosion pops in the centre of the frame, like a comic book blast: a round burst with a ring of short, fat triangle points around its rim, each point much shorter than the burst is wide, a bright pale peach core, and round puffy clouds packed around it. By the middle of the shot the explosion is at its biggest, a solid burst about half as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks apart into little round puffs and small round dots that stay close to the centre and shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about half as wide and half as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

### Round 4: 10 rerolls

Round 3 at a third of the frame; the "4 b" tries differ only in their sound line.

#### Vision transition explosion 4

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright pink, pale pink and soft pinkish white, with thick outlines in a deep rose pink, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small, chunky cartoon explosion pops in the centre of the frame, like a comic book blast: a round burst with a ring of short, fat triangle points around its rim, each point much shorter than the burst is wide, a bright pale pink core, and round puffy clouds packed around it. By the middle of the shot the explosion is at its biggest, a solid burst about a third as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks apart into little round puffs and small round dots that stay close to the centre and shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about a third as wide and a third as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Vision transition explosion 4 b

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright pink, pale pink and soft pinkish white, with thick outlines in a deep rose pink, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small, chunky cartoon explosion pops in the centre of the frame, like a comic book blast: a round burst with a ring of short, fat triangle points around its rim, each point much shorter than the burst is wide, a bright pale pink core, and round puffy clouds packed around it. By the middle of the shot the explosion is at its biggest, a solid burst about a third as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks apart into little round puffs and small round dots that stay close to the centre and shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about a third as wide and a third as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a quick punchy cartoon pop, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Prompt transition explosion 4

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright yellow, pale lemon yellow and soft warm white, with thick outlines in a deep golden yellow, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small, chunky cartoon explosion pops in the centre of the frame, like a comic book blast: a round burst with a ring of short, fat triangle points around its rim, each point much shorter than the burst is wide, a bright pale lemon yellow core, and round puffy clouds packed around it. By the middle of the shot the explosion is at its biggest, a solid burst about a third as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks apart into little round puffs and small round dots that stay close to the centre and shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about a third as wide and a third as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Prompt transition explosion 4 b

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright yellow, pale lemon yellow and soft warm white, with thick outlines in a deep golden yellow, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small, chunky cartoon explosion pops in the centre of the frame, like a comic book blast: a round burst with a ring of short, fat triangle points around its rim, each point much shorter than the burst is wide, a bright pale lemon yellow core, and round puffy clouds packed around it. By the middle of the shot the explosion is at its biggest, a solid burst about a third as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks apart into little round puffs and small round dots that stay close to the centre and shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about a third as wide and a third as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a quick punchy cartoon pop, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Audio transition explosion 4

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright teal, pale aqua and soft minty white, with thick outlines in a deep teal, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small, chunky cartoon explosion pops in the centre of the frame, like a comic book blast: a round burst with a ring of short, fat triangle points around its rim, each point much shorter than the burst is wide, a bright pale aqua core, and round puffy clouds packed around it. By the middle of the shot the explosion is at its biggest, a solid burst about a third as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks apart into little round puffs and small round dots that stay close to the centre and shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about a third as wide and a third as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Audio transition explosion 4 b

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright teal, pale aqua and soft minty white, with thick outlines in a deep teal, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small, chunky cartoon explosion pops in the centre of the frame, like a comic book blast: a round burst with a ring of short, fat triangle points around its rim, each point much shorter than the burst is wide, a bright pale aqua core, and round puffy clouds packed around it. By the middle of the shot the explosion is at its biggest, a solid burst about a third as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks apart into little round puffs and small round dots that stay close to the centre and shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about a third as wide and a third as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a quick punchy cartoon pop, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Video transition explosion 4

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright orange, pale peach and soft warm white, with thick outlines in a deep orange, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small, chunky cartoon explosion pops in the centre of the frame, like a comic book blast: a round burst with a ring of short, fat triangle points around its rim, each point much shorter than the burst is wide, a bright pale peach core, and round puffy clouds packed around it. By the middle of the shot the explosion is at its biggest, a solid burst about a third as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks apart into little round puffs and small round dots that stay close to the centre and shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about a third as wide and a third as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a short bouncy cartoon boom, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Video transition explosion 4 b

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright orange, pale peach and soft warm white, with thick outlines in a deep orange, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a small, chunky cartoon explosion pops in the centre of the frame, like a comic book blast: a round burst with a ring of short, fat triangle points around its rim, each point much shorter than the burst is wide, a bright pale peach core, and round puffy clouds packed around it. By the middle of the shot the explosion is at its biggest, a solid burst about a third as wide as the frame, covering the centre of the frame. Over the rest of the shot it breaks apart into little round puffs and small round dots that stay close to the centre and shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about a third as wide and a third as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a quick punchy cartoon pop, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Prompt transition speech bubble pop 4

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright yellow, pale lemon yellow and soft warm white, with thick outlines in a deep golden yellow, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon speech bubble pops up in the centre of the frame: a chunky rounded speech bubble with a stepped pixel-art outline and a little tail at its bottom, inflating fast from a small dot like a balloon. By the middle of the shot the speech bubble is at its biggest, about a third as wide as the frame, plain and empty inside and filled solid with bright yellow, covering the centre of the frame. Just after the middle it pops like a balloon: the bubble breaks into a small cluster of chunky square yellow pixel blocks right where it was, and the blocks shrink where they are, down to nothing. The pop is shown only by the bubble turning into those blocks. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about a third as wide and a third as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a quick rubbery squeak as the bubble inflates and one crisp pop, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Audio transition sound pulse 4

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright teal, pale aqua and soft minty white, with thick outlines in a deep teal, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a speaker thump goes off in the centre of the frame: a small bright point punches out into a solid glowing round disc, like the pulse of a loudspeaker. By the middle of the shot the disc is at its biggest, a solid round bright teal disc about a third as wide as the frame, ringed by one thick teal ring, covering the centre of the frame, with three small cartoon music notes resting right against its rim. Right after the middle the disc, its ring and the notes all shrink fast back into the centre, down to a tiny dot that vanishes. By three quarters of the way through the shot nothing is left of it. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about a third as wide and a third as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a deep soft speaker thump followed by a short bright musical chime, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

### Round 5: 2 speech bubble rerolls

Round 4's bubble with the pop pinned to the middle and no bubble in the second half.

#### Prompt transition speech bubble pop 5

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright yellow, pale lemon yellow and soft warm white, with thick outlines in a deep golden yellow, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon speech bubble pops up in the centre of the frame: a chunky rounded speech bubble with a stepped pixel-art outline and a little tail at its bottom, inflating fast from a small dot like a balloon. By the middle of the shot the speech bubble is at its biggest, about a third as wide as the frame, plain and empty inside and filled solid with bright yellow, covering the centre of the frame. Exactly at the middle of the shot it pops like a balloon: in one frame the whole bubble bursts into a small cluster of chunky square yellow pixel blocks right where it was. For the whole second half of the shot there is no bubble any more, only the blocks, and they shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about a third as wide and a third as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a quick rubbery squeak as the bubble inflates and one crisp pop, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

#### Prompt transition speech bubble pop 5 b

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright yellow, pale lemon yellow and soft warm white, with thick outlines in a deep golden yellow, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon speech bubble pops up in the centre of the frame: a chunky rounded speech bubble with a stepped pixel-art outline and a little tail at its bottom, inflating fast from a small dot like a balloon. By the middle of the shot the speech bubble is at its biggest, about a third as wide as the frame, plain and empty inside and filled solid with bright yellow, covering the centre of the frame. Exactly at the middle of the shot it pops like a balloon: in one frame the whole bubble bursts into a small cluster of chunky square yellow pixel blocks right where it was. For the whole second half of the shot there is no bubble any more, only the blocks, and they shrink where they are, down to nothing. Everything is gone a moment before the shot ends, and the last few frames are empty pure black, the same as the first frame.

The whole effect stays small and in the centre of the frame for the entire shot. At its biggest it is only about a third as wide and a third as tall as the frame, with a wide empty margin of pure black all round it. Every shape in the shot is a solid, rounded part of the effect itself, and every one of them stays close to the centre; the outer part of the frame stays empty pure black from the first frame to the last.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a quick rubbery stretch as the bubble inflates and one loud balloon pop, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```

### Probe: Vision transition smoke puff (`t2v_001`)

Round 1's wording before the probe fixes.

```text
A 2D cartoon effect animation for a video overlay, flat vector illustration style with thick outlines and flat bright colours, a plain solid pure black background, snappy bouncy cartoon timing, one continuous shot under one second long.

The shot shows only the effect on black: there is no character, no robot, no person, no object and no scenery anywhere in the shot. The background is plain solid pure black in every frame, with no gradient, no texture, no vignette and no glow spreading across it. The effect is drawn only in bright pink, pale pink and soft pinkish white, with thick outlines in a deep rose pink, and it is bright and light all over: no part of it is dark, grey or black.

The shot begins on an empty pure black frame. In the first fifth of a second a cartoon smoke puff bursts out of a single point in the centre of the frame, like a ninja vanishing in a puff of smoke: a tight cluster of round puffy cloud balls that swells fast. By the middle of the shot the puff is at its biggest and thickest, a solid round cloud of overlapping puffy balls that completely covers the centre of the frame, with a few small puffs popping out around its rim. Over the rest of the shot the cloud breaks apart into smaller and smaller round puffs that drift a little outward, shrink to tiny dots and vanish one by one, all still well inside the frame. The shot ends on the same empty pure black frame it began on.

The whole effect stays in the middle of the frame for the entire shot. At its biggest it fills the middle of the frame and still leaves a wide margin of pure black on every side, and no part of it ever touches or crosses any edge of the frame.

The camera is locked off and completely static for the entire shot, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: a soft cartoon poof, and no speech of any kind.

non_diegetic_music: N/A

No text, no letters, no words, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no flicker.
```
