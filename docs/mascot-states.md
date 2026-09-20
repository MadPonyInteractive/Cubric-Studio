# State clips: idle, greet, happy, failed

> **Moved here from MadPony-Identity on 2026-09-20.** This is the record of HOW the clip was made - prompt, seed, what failed and why. To wire a clip, read `mascot-placement.md` and `mascot-gif-manifest.md` instead.

MPI-78 phase 2. General-purpose mascot clips the app reuses anywhere a state still is shown today (Fabio, 2026-09-15):
the landing hero crew (`Cubric-Vision/js/shell/heroCrew.js`: idle at rest, greet on hover and every 3.2s ambient, happy on click)
and the toasts (`MpiToast.js`: info idle, success happy, warning greet, danger failed). 8 clips per mascot, 40 in all,
queued together by agent 2026-09-15.

## Settings

- **Plain MiniMax H3** (`minimax-h3`, `i2v_ms`), NOT the Reference card: start frame AND end frame are the same picture,
  so every clip of a mascot opens and closes on one identical frame. That is what lets the app swap idle, greet, happy
  and failed with no jump, and what makes each clip loop. Untested before this batch (the brief flagged it may barely move).
- The frame is the mascot's `{Mascot}-Idle.png` from `C:\AI\Mpi\Cubric Studio Brand Assets\`, alpha-composited onto the
  sheets' light grey (202,202,202) on a 2000x2000 canvas, figure scaled to 60% of the frame height with feet at 90%, centred,
  so jumps, head pops and walks have room. Staged with `place-preview-asset`.
- 1:1, quality medium (768x768), turbo on, seed random. Idles 5s (`Input_Duration` 5), everything else 3s.

## Rules every prompt follows

- Opens and closes on the rest pose; timed beats that add up to the duration; the snap fix from
  `../../MadPony-Identity/production/badoxa/findings/camera-moves.md` ("moving in every single frame", no cut, no jump, no snap).
- **Props never leave the frame (Fabio):** they come out from behind his back and go back behind his back, or are tossed
  over his shoulder and drop out of sight behind his body. Every prop sentence says so, positively.
- Whole body inside the frame with a clear margin on every side (the fix that cured `ref2v_007` and `ref2v_011`).
- The constraint tail drops "no flicker" only where a light is meant to flash or stutter (Vision say cheese and failed,
  Prompt failed). Head gags: the head comes off like a toy part, never broken.
- His back is invented: no still or sheet shows it.

## Prompts

### Vision idle 1

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

In the first three quarters of a second he turns towards the left edge of the picture and takes his first small step. Over the next second he walks three small bouncy steps towards the left, staying well inside the frame. Over the following second he stops and points his big lens up, then to the left, then to the right, like a photographer looking for a good shot, and the small pink light in the top right corner of his head blinks on and off once. Over the next second and a half he turns round and walks three small bouncy steps back to the spot where he started. In the last three quarters of a second he turns to face the camera and lowers his arms to his sides. The glass of his lens stays perfectly clean, dark and glossy for the whole shot, with its two small round highlights. His whole body stays well inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft padding footsteps, a tiny lens whirr as he looks around, one tiny electronic beep as the light blinks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Vision idle 2

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

In the first second and a quarter he turns slowly round on the spot until his back is to the camera, showing his plain mauve-brown back and the plain back of his box camera head. Over the next second he stands with his back to the camera and sways his weight gently from one foot to the other. Over the following second he turns his head to look back over his shoulder at the camera, his big pink-ringed lens peeking round the side of his head, and the small pink light in the top right corner of his head blinks twice. Over the next second and a quarter he keeps turning the same way until he faces the camera again. In the last half second he settles, his arms resting at his sides. The glass of his lens stays perfectly clean, dark and glossy for the whole shot, with its two small round highlights. His feet turn on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft shuffling footsteps as he turns, two tiny electronic beeps as the light blinks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Vision idle 3

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot. The instant photo is not in the first frame; it comes from this description alone.

The character is a small robot: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

In the first second he reaches one mitten hand behind his back and brings out a small square instant photo with a thick white border and a simple little picture of a round green hill under a soft pink sky. Over the next second and a half he holds the photo up in front of his lens with both hands and looks at it, tipping his head to one side and then to the other. Over the following second he does a happy little wiggle from side to side, and the small pink light in the top right corner of his head blinks on and off once. Over the next second he tucks the photo back behind his back, where it disappears out of sight behind his body. In the last half second he brings both hands back to his sides. The instant photo only ever appears in front of his body or disappears behind his back, and it stays well inside the frame the whole time. The glass of his lens stays perfectly clean, dark and glossy for the whole shot, with its two small round highlights. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft papery rustle as the photo comes out, one tiny electronic beep as the light blinks, a soft rustle as it is tucked away, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Vision greet wave

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

In the first half second he lifts one mitten hand up high beside his head. Over the next second and a half he waves at the camera, his hand swinging from side to side in two full friendly waves, while the small pink light in the top right corner of his head blinks on and off twice. Over the following half second he gives one small happy bounce on the spot. In the last half second he lowers his hand back to his side. The glass of his lens stays perfectly clean, dark and glossy for the whole shot, with its two small round highlights. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A light cartoon whoosh with each wave, two tiny electronic beeps as the light blinks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Vision greet say cheese

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

He is a camera taking a photo of the person watching. In the first three quarters of a second he lifts both mitten hands up to either side of his box camera head and holds it steady, like a photographer framing a shot. Over the next three quarters of a second his big lens slides forward out of the front of his head, like a camera zooming in on the viewer. Over the following half second the small pink light in the top right corner of his head pops with one quick bright pink flash, like a camera flash going off, and goes back to normal. Over the next half second the lens slides smoothly back into his head. In the last half second he lowers both hands back to his sides. The glass of his lens stays perfectly clean, dark and glossy for the whole shot, with its two small round highlights. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A small motor whirr as the lens slides out, one crisp camera shutter click with the flash, a soft whirr as the lens slides back, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

### Vision happy hop

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

In the first half second he bends his knees into a little crouch. Over the next second he springs up into a happy jump with both arms thrown up high, and the glass of his lens changes to show two bright pink upturned arcs, like eyes squeezed shut with joy, while small dark motion lines pop out around him. His whole body and head stay inside the frame at the top of the jump. Over the following three quarters of a second he lands back on the same spot with a small squash and a happy wiggle, arms still up, and the motion lines fade away. In the last three quarters of a second he lowers his arms to his sides and his lens goes back to its normal dark glossy glass with its two small round highlights. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing on the jump, a soft bouncy thump on the landing, a tiny happy electronic chirp, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Vision happy head pop

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

In the first half second he bends his knees into a little crouch. Over the next three quarters of a second he springs up into a big happy jump with both arms thrown up high, jumping so hard that his box camera head pops up off his neck and floats a little above his body. Over the following three quarters of a second, at the top of the jump, his head spins round once in the air, showing its side, its plain back, its other side and its front again, while the glass of his lens shows two bright pink upturned arcs like eyes squeezed shut with joy. Over the next half second his body lands back on the same spot and his head drops back down onto his neck with a springy little bounce. In the last half second he lowers his arms to his sides and his lens goes back to its normal dark glossy glass with its two small round highlights. His head comes off like a toy part and clicks back on, and his whole body and head stay inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing as the head pops off, a quick whirring spin, a small plastic click as it lands back on its neck, a tiny happy electronic chirp, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Vision failed

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

In the first half second his box camera head pops straight up off his neck with a spring, and the small pink light in the top right corner of his head fizzles and blinks unevenly. Over the next second and a quarter his body juggles the head just above his shoulders, bouncing it from one mitten hand to the other and back, twice, scrambling to keep hold of it. Over the following half second he catches it in both hands and plonks it back onto his neck, tilted crooked to one side. In the last three quarters of a second he gives the side of his head one small tap, it straightens with a click, the pink light steadies back to normal, and he lowers his hands to his sides. His head comes off like a toy part, never broken, and it stays inside the frame the whole time, never higher than a little above his shoulders. The glass of his lens stays perfectly clean, dark and glossy for the whole shot, with its two small round highlights. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing as the head pops off, quick hollow plastic taps as he juggles it, one clunk as it goes on crooked, a small click as it straightens, a small electric fizzle from the light, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

### Studio idle 1

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

In the first half second he lifts one mitten hand to the bottom edge of his screen, like a hand on a chin, and in place of his mouth three small dark square dots start lighting up one after another from left to right and repeating, like a thinking indicator. Over the next second and a half he turns towards the left edge of the picture and paces three small steps that way, staying well inside the frame, his two antennas twitching as he thinks. Over the following half second he stops. Over the next second and a half he turns and paces three small steps back to the spot where he started, the dots still cycling. In the last second he turns to face the camera, the dots clear and his short flat mouth line is back, his pixel eyes blink once, and he lowers his hand to his side. His whole body stays well inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft padding footsteps, three tiny soft electronic blips repeating as the dots cycle, a tiny springy boing as the antennas twitch, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio idle 2

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

In the first second and a quarter he turns slowly round on the spot until his back is to the camera, showing his plain mauve-brown back and the plain rounded back of his monitor head with its two antennas. Over the next second and a half, with his back to the camera, he does a big lazy stretch, both arms pushed up high above his head, leaning a little to one side and then to the other. Over the following half second he drops his arms back to his sides. Over the next second and a quarter he keeps turning the same way until he faces the camera again. In the last half second his pixel eyes blink once. His feet turn on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft shuffling footsteps as he turns, a small creaky robot stretch, one tiny soft blip as he blinks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio idle 3

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot. The coffee mug is not in the first frame; it comes from this description alone.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

In the first second he reaches one mitten hand behind his back and brings out a small plain pale beige coffee mug with a thin curl of steam rising from it. Over the next second and a half he lifts the mug to the bottom edge of his screen and tips it, like taking a slow sip, and his two pixel eyes change into two small happy upturned arcs. Over the following three quarters of a second he lowers the mug in front of his chest, his pixel eyes change back into two small dark upright rectangles, and he gives one small contented bob. Over the next second he tucks the mug back behind his back, where it disappears out of sight behind his body. In the last three quarters of a second he brings his hand back to his side. The coffee mug only ever appears in front of his body or disappears behind his back, and it stays well inside the frame the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft ceramic clink, a small contented sip, a soft ceramic clink as it is tucked away, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio greet wave

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

In the first half second he lifts one mitten hand up high beside his head, and his short flat mouth line changes into a small open square pixel mouth, like saying oh hello. Over the next second and a half he waves at the camera, his hand swinging from side to side in two full friendly waves, while his two antennas wiggle. Over the following half second he gives one small happy bounce on the spot. In the last half second he lowers his hand back to his side and his mouth goes back to its short flat line. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A light cartoon whoosh with each wave, a tiny springy wobble from the antennas, a small cheerful electronic blip, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio greet hat tip

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

In the first half second he reaches up and takes hold of the top of his monitor head between his two antennas with one mitten hand. Over the next second he lifts his whole head a little way up off his neck and tips it towards the camera, like a gentleman tipping his hat, with a small polite bow of his body. Over the following three quarters of a second he pops his head back down onto his neck with a springy little bounce, and one of his pixel eyes winks, closing into a short flat line and opening again. In the last three quarters of a second he lowers his hand back to his side and straightens up. His head comes off like a toy part and clicks back on, and it stays inside the frame the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft plastic pop as the head lifts, a springy boing as it goes back on, a tiny electronic blip on the wink, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio happy hop

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

In the first half second he bends his knees into a little crouch. Over the next second he springs up into a happy jump with both mitten fists thrown up high, and his short flat mouth line changes into a wide pixel smile. His whole body and head stay inside the frame at the top of the jump. Over the following three quarters of a second he lands back on the same spot with a small squash and a happy wiggle, fists still up, his antennas bouncing. In the last three quarters of a second he lowers his arms to his sides and his mouth goes back to its short flat line. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing on the jump, a soft bouncy thump on the landing, a tiny happy electronic chirp, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio happy head pop

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

In the first half second he bends his knees into a little crouch. Over the next three quarters of a second he springs up into a big happy jump with both arms thrown up high, jumping so hard that his monitor head pops up off his neck and floats a little above his body. Over the following three quarters of a second, at the top of the jump, his head spins round once in the air, showing its side, its plain back, its other side and its front again, while his pixel face shows a wide pixel smile. Over the next half second his body lands back on the same spot and his head drops back down onto his neck with a springy little bounce. In the last half second he lowers his arms to his sides and his mouth goes back to its short flat line. His head comes off like a toy part and clicks back on, and his whole body and head stay inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing as the head pops off, a quick whirring spin, a small plastic click as it lands back on its neck, a tiny happy electronic chirp, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio failed

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

In the first half second his monitor head pops straight up off his neck with a spring, and his two pixel eyes change into two small dark crosses. Over the next second and a quarter his body juggles the head just above his shoulders, bouncing it from one mitten hand to the other and back, twice, scrambling to keep hold of it. Over the following half second he catches it in both hands and plonks it back onto his neck, tilted crooked to one side. In the last three quarters of a second he gives the side of his head one small tap, it straightens with a click, his pixel eyes change back into two small dark upright rectangles, and he lowers his hands to his sides. His head comes off like a toy part, never broken, and it stays inside the frame the whole time, never higher than a little above his shoulders. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing as the head pops off, quick hollow plastic taps as he juggles it, one clunk as it goes on crooked, a small click as it straightens, a small sad electronic bloop, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt idle 1

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a yellow pill-shaped light at the top of his chest, a small keyboard of mauve keys across his belly, a yellow band around each arm just above the hand, short stubby arms with round mitten hands and short stubby legs. His head sits on a short thin neck and is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor.

He walks a small slow circle around the spot where he started, typing the whole way. In the first second he steps out towards the left. Over the next second he walks round behind the spot where he started, his body half turned away from the camera. Over the following second he walks round to the right. Over the next second he walks back round to the front. All the while he types on the keyboard on his belly with both mitten hands, his keys pressing in and popping back out, and the yellow underscore cursor on his screen blinks steadily. In the last second he stops back on the spot where he started, facing the camera, and lowers both hands to his sides. His whole body stays well inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft padding footsteps and quick soft plastic key clicks the whole time, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt idle 2

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a yellow pill-shaped light at the top of his chest, a small keyboard of mauve keys across his belly, a yellow band around each arm just above the hand, short stubby arms with round mitten hands and short stubby legs. His head sits on a short thin neck and is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor.

In the first second and a quarter he turns slowly round on the spot until his back is to the camera, showing his plain mauve-brown back and the plain back of his speech-bubble head. Over the next second, with his back to the camera, he taps a few keys on his belly. Over the following second he turns his head to peek back over his shoulder at the camera, and the dark screen on his head now shows three yellow dots lighting up one after another, like someone typing a message. Over the next second and a quarter he keeps turning the same way until he faces the camera again, and the three dots change back into the yellow > arrow and the yellow underscore cursor. In the last half second the cursor blinks once and he settles, his arms resting at his sides. His feet turn on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft shuffling footsteps as he turns, a few soft key clicks, three tiny soft electronic ticks as the dots light up, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt idle 3

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot. The paper ball is not in the first frame; it comes from this description alone.

The character is a small robot: a rounded mauve-brown body with a yellow pill-shaped light at the top of his chest, a small keyboard of mauve keys across his belly, a yellow band around each arm just above the hand, short stubby arms with round mitten hands and short stubby legs. His head sits on a short thin neck and is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor.

In the first second he reaches one mitten hand behind his back and brings out a small crumpled ball of plain cream paper. Over the next second and a quarter he holds the paper ball up in front of his screen and looks at it, tipping his head to one side, while his screen shows three yellow dots lighting up one after another. Over the following second he gives a little shrug and tosses the paper ball back over his shoulder in a small low arc; it never goes higher than the top of his head, and it drops down behind his back where his body hides it completely, gone from sight. Over the next second he dusts his mitten hands off against each other and his screen changes back to the yellow > arrow and the yellow underscore cursor. In the last three quarters of a second he lowers both hands to his sides. The paper ball only ever appears in front of his body or disappears behind his back, and it stays well inside the frame the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A crinkly paper rustle, a light whoosh as it is tossed, a soft papery bump out of sight behind him, two soft pats as he dusts off his hands, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt greet wave

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a yellow pill-shaped light at the top of his chest, a small keyboard of mauve keys across his belly, a yellow band around each arm just above the hand, short stubby arms with round mitten hands and short stubby legs. His head sits on a short thin neck and is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor.

In the first half second he lifts one mitten hand up high beside his head. Over the next second and a half he waves at the camera, his hand swinging from side to side in two full friendly waves, while the yellow underscore cursor on his screen blinks quickly. Over the following half second he gives one small happy bounce on the spot. In the last half second he lowers his hand back to his side and the cursor settles back to its steady blink. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A light cartoon whoosh with each wave, tiny quick electronic ticks as the cursor blinks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt greet typing dots

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a yellow pill-shaped light at the top of his chest, a small keyboard of mauve keys across his belly, a yellow band around each arm just above the hand, short stubby arms with round mitten hands and short stubby legs. His head sits on a short thin neck and is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor.

In the first half second he leans his head a little towards the camera, and the yellow > arrow and underscore cursor on his screen disappear. Over the next second three yellow dots light up on his screen one after another from left to right, twice, like someone typing a message to the viewer. Over the following second the dots clear, the yellow > arrow and the yellow underscore cursor come back, and he waves at the camera with one mitten hand in two quick friendly waves. In the last half second he lowers his hand to his side and straightens his head. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Three tiny soft electronic ticks twice as the dots light up, a light cartoon whoosh with each wave, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt happy hop

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a yellow pill-shaped light at the top of his chest, a small keyboard of mauve keys across his belly, a yellow band around each arm just above the hand, short stubby arms with round mitten hands and short stubby legs. His head sits on a short thin neck and is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor.

In the first half second he bends his knees into a little crouch. Over the next second he springs up into a happy jump with both arms thrown up high, and his screen changes to show the yellow > arrow followed by a yellow pixel smiley face made of two dots and a small curve, while small yellow sparkles twinkle around him. His whole body and head stay inside the frame at the top of the jump. Over the following three quarters of a second he lands back on the same spot with a small squash and a happy wiggle, arms still up, and the sparkles fade away. In the last three quarters of a second he lowers his arms to his sides and his screen shows the yellow > arrow and the yellow underscore cursor again. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing on the jump, a soft bouncy thump on the landing, a tiny sparkly chime, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt happy head pop

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a yellow pill-shaped light at the top of his chest, a small keyboard of mauve keys across his belly, a yellow band around each arm just above the hand, short stubby arms with round mitten hands and short stubby legs. His head sits on a short thin neck and is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor.

In the first half second he bends his knees into a little crouch. Over the next three quarters of a second he springs up into a big happy jump with both arms thrown up high, jumping so hard that his speech-bubble head pops up off his neck and floats a little above his body. Over the following three quarters of a second, at the top of the jump, his head spins round once in the air, showing its side, its plain back, its other side and its front again, while his screen shows the yellow > arrow followed by a yellow pixel smiley face made of two dots and a small curve. Over the next half second his body lands back on the same spot and his head drops back down onto his neck with a springy little bounce. In the last half second he lowers his arms to his sides and his screen shows the yellow > arrow and the yellow underscore cursor again. His head comes off like a toy part and clicks back on, and his whole body and head stay inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing as the head pops off, a quick whirring spin, a small plastic click as it lands back on its neck, a tiny sparkly chime, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt failed

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a yellow pill-shaped light at the top of his chest, a small keyboard of mauve keys across his belly, a yellow band around each arm just above the hand, short stubby arms with round mitten hands and short stubby legs. His head sits on a short thin neck and is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor.

In the first half second his speech-bubble head pops straight up off his neck with a spring, and the yellow underscore cursor on his screen stutters, blinking unevenly. Over the next second and a quarter his body juggles the head just above his shoulders, bouncing it from one mitten hand to the other and back, twice, scrambling to keep hold of it. Over the following half second he catches it in both hands and plonks it back onto his neck, tilted crooked to one side. In the last three quarters of a second he gives the side of his head one small tap, it straightens with a click, the cursor goes back to its steady blink, and he lowers his hands to his sides. His head comes off like a toy part, never broken, and it stays inside the frame the whole time, never higher than a little above his shoulders. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing as the head pops off, quick hollow plastic taps as he juggles it, one clunk as it goes on crooked, a small click as it straightens, a few stuttering electronic ticks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

### Audio idle 1

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

He is dancing to music only he can hear in his headphones. In the first second and a quarter he takes two small bouncy steps to the left, swinging his arms. Over the next second and a quarter he takes two small bouncy steps back to the spot where he started. Over the following second and a quarter he takes two small bouncy steps to the right. Over the last second and a quarter he takes two small bouncy steps back to the spot where he started and ends facing the camera with his arms resting at his sides. With every step his head bobs so his headphones bounce, and the teal sound wave on either side of the play button on his screen pulses taller and shorter in time, settling back to exactly how it looked at the start. His whole body stays well inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft bouncy footsteps in a steady rhythm and a faint muffled beat leaking from his headphones, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio idle 2

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

In the first second and a quarter he turns slowly round on the spot until his back is to the camera, showing his plain mauve-brown back, the plain back of his box head, the grey-green headband across the top and a teal ear cup on each side. Over the next two seconds, with his back to the camera, he bobs his head and sways his shoulders to music only he can hear, four even bobs, his headphones bouncing. Over the following second and a quarter he spins the rest of the way round on the beat until he faces the camera again. In the last half second he gives one small nod and settles with his arms resting at his sides, and the teal sound wave on his screen is exactly as it was at the start. His feet turn on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft shuffling footsteps as he turns, a faint muffled beat leaking from his headphones, a light swish on the spin, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio idle 3

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot. The microphone is not in the first frame; it comes from this description alone.

The character is a small robot: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

In the first second he reaches one mitten hand behind his back and brings out a small plain dark grey handheld microphone with a round grey mesh top. Over the next second he taps the mesh top twice with his other hand, and with each tap the teal sound wave on his screen jumps up into tall spikes and settles. Over the following second and a quarter he holds the microphone up in front of his screen like a singer about to start, sways once from side to side, and the sound wave swells. Over the next second he tucks the microphone back behind his back, where it disappears out of sight behind his body. In the last three quarters of a second he brings both hands back to his sides, and the teal sound wave on his screen is exactly as it was at the start. The microphone only ever appears in front of his body or disappears behind his back, and it stays well inside the frame the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Two dull thumps on the microphone each with a soft electronic pop, a short gentle hum, a soft rustle as it is tucked away, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio greet wave

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

In the first half second he lifts one mitten hand up high beside his head. Over the next second and a half he waves at the camera, his hand swinging from side to side in two full friendly waves, while the teal sound wave on his screen bounces up and down like a voice saying hello. Over the following half second he gives one small happy bounce on the spot. In the last half second he lowers his hand back to his side, and the teal sound wave on his screen is exactly as it was at the start. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A light cartoon whoosh with each wave, a short bright electronic blip like a hello, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio greet ear cup

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

In the first half second he lifts one mitten hand and slides the teal ear cup on that side back off his ear, so it rests just behind his head. Over the next three quarters of a second he leans his head towards the camera, listening, like he is trying to hear the viewer. Over the following second he waves at the camera with his other hand in two quick friendly waves, while the teal sound wave on his screen bounces like a voice saying hello. In the last three quarters of a second he slides the ear cup back into its place over his ear, straightens his head and lowers both hands to his sides. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft cushioned slide as the ear cup moves, a light cartoon whoosh with each wave, a soft cushioned press as it goes back, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio happy hop

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

In the first half second he bends his knees into a little crouch. Over the next second he springs up into a happy jump with both mitten fists thrown up high and his body tilting a little to one side, and the teal sound wave on his screen jumps up into tall happy spikes, while small teal sparkles twinkle around him. His whole body and head stay inside the frame at the top of the jump. Over the following three quarters of a second he lands back on the same spot with a small squash and a happy wiggle, fists still up, and the sparkles fade away. In the last three quarters of a second he lowers his arms to his sides and the teal sound wave on his screen is exactly as it was at the start. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing on the jump, a soft bouncy thump on the landing, a tiny sparkly chime, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio happy head pop

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

In the first half second he bends his knees into a little crouch. Over the next three quarters of a second he springs up into a big happy jump with both arms thrown up high, jumping so hard that his box head, headphones and all, pops up off his neck and floats a little above his body. Over the following three quarters of a second, at the top of the jump, his head spins round once in the air, showing its side, its plain back, its other side and its front again, while the teal sound wave on his screen jumps up into tall happy spikes. His headphones stay on his head as it spins. Over the next half second his body lands back on the same spot and his head drops back down onto his neck with a springy little bounce. In the last half second he lowers his arms to his sides and the teal sound wave on his screen is exactly as it was at the start. His head comes off like a toy part and clicks back on, and his whole body and head stay inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing as the head pops off, a quick whirring spin, a small plastic click as it lands back on its neck, a tiny sparkly chime, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio failed

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

In the first half second his box head, headphones and all, pops straight up off his neck with a spring, and the teal sound wave on his screen drops into a flat line. Over the next second and a quarter his body juggles the head just above his shoulders, bouncing it from one mitten hand to the other and back, twice, scrambling to keep hold of it. Over the following half second he catches it in both hands and plonks it back onto his neck, tilted crooked to one side. In the last three quarters of a second he gives the side of his head one small tap, it straightens with a click, the sound wave pops back to exactly how it was at the start, and he lowers his hands to his sides. His head comes off like a toy part, never broken, and it stays inside the frame the whole time, never higher than a little above his shoulders. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing as the head pops off, quick hollow plastic taps as he juggles it, one clunk as it goes on crooked, a small click as it straightens, a short record scratch, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video idle 1

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body whose short neck goes straight into the plain mauve-brown top of his body with no collar, a dark clapperboard icon with orange stripes and an orange play triangle on his chest, a thin timeline bar with a small orange marker across his belly, orange trim down the outer edges of his body, short stubby arms with round mitten hands and short stubby legs with orange soles. His head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

In the first second and a half he turns towards the right edge of the picture and walks three small bouncy steps that way, staying well inside the frame, and with each step the orange scrubber bar on his head slides a little further right across the front of his head, like scrubbing along a timeline. Over the next half second he stops with a little hop. Over the following second and a half he turns and walks three small bouncy steps back to the spot where he started, and with each step the scrubber bar slides a little way back left until it is back in its place just right of the middle. In the last second and a half he turns to face the camera, the square sprocket holes down both sides of his head roll upward in a quick run, and he settles with his arms resting at his sides. His whole body stays well inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft padding footsteps, a quiet ticking slide as the scrubber moves, a soft clicking rattle as the sprockets roll, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video idle 2

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body whose short neck goes straight into the plain mauve-brown top of his body with no collar, a dark clapperboard icon with orange stripes and an orange play triangle on his chest, a thin timeline bar with a small orange marker across his belly, orange trim down the outer edges of his body, short stubby arms with round mitten hands and short stubby legs with orange soles. His head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

In the first second and a quarter he turns slowly round on the spot until his back is to the camera, showing his plain mauve-brown back and the plain back of his film-frame head, with the round ends of the orange scrubber bar poking out above and below it. Over the next second and a quarter, with his back to the camera, he bends forward at the waist and looks down at the floor in front of him, like a director checking his mark. Over the following half second he straightens up. Over the next second and a quarter he keeps turning the same way until he faces the camera again, and the square sprocket holes down both sides of his head roll upward in a quick run. In the last three quarters of a second he gives one small hop on the spot and settles with his arms resting at his sides. His feet turn on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft shuffling footsteps as he turns, a soft clicking rattle as the sprockets roll, a light thump on the hop, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video idle 3

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot. The clapperboard is not in the first frame; it comes from this description alone.

The character is a small robot: a rounded mauve-brown body whose short neck goes straight into the plain mauve-brown top of his body with no collar, a dark clapperboard icon with orange stripes and an orange play triangle on his chest, a thin timeline bar with a small orange marker across his belly, orange trim down the outer edges of his body, short stubby arms with round mitten hands and short stubby legs with orange soles. His head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

In the first second he reaches one mitten hand behind his back and brings out a small plain clapperboard: a dark grey board with a hinged clapper stick along its top painted with orange diagonal stripes, and nothing written on it. Over the next second he holds it up in front of his chest with both hands and swings the striped clapper stick open. Over the following half second he snaps the clapper stick shut with one sharp clap, and the square sprocket holes down both sides of his head roll upward in a quick run. Over the next second and a quarter he tucks the clapperboard back behind his back, where it disappears out of sight behind his body. In the last second and a quarter he brings both hands back to his sides and gives one small satisfied nod. The clapperboard only ever appears in front of his body or disappears behind his back, and it stays well inside the frame the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft wooden creak as the clapper opens, one crisp wooden clap, a soft clicking rattle as the sprockets roll, a soft rustle as it is tucked away, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video greet wave

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body whose short neck goes straight into the plain mauve-brown top of his body with no collar, a dark clapperboard icon with orange stripes and an orange play triangle on his chest, a thin timeline bar with a small orange marker across his belly, orange trim down the outer edges of his body, short stubby arms with round mitten hands and short stubby legs with orange soles. His head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

In the first half second he lifts one mitten hand up high beside his head. Over the next second and a half he waves at the camera, his hand swinging from side to side in two full friendly waves, while the square sprocket holes down both sides of his head roll upward in a quick run. Over the following half second he gives one small happy bounce on the spot. In the last half second he lowers his hand back to his side. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A light cartoon whoosh with each wave, a soft clicking rattle as the sprockets roll, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video greet director frame

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body whose short neck goes straight into the plain mauve-brown top of his body with no collar, a dark clapperboard icon with orange stripes and an orange play triangle on his chest, a thin timeline bar with a small orange marker across his belly, orange trim down the outer edges of his body, short stubby arms with round mitten hands and short stubby legs with orange soles. His head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

In the first three quarters of a second he raises both mitten hands in front of his chest and holds them together in the shape of a small rectangle, like a film director framing a shot, and looks at the camera through it. Over the next three quarters of a second he leans a little from side to side, lining up the shot, while the square sprocket holes down both sides of his head roll upward in a quick run. Over the following three quarters of a second he swings one arm out and points straight at the camera, like telling the viewer you are on. In the last three quarters of a second he lowers both hands back to his sides. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft clicking rattle as the sprockets roll, a light cartoon whoosh on the point, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video happy hop

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body whose short neck goes straight into the plain mauve-brown top of his body with no collar, a dark clapperboard icon with orange stripes and an orange play triangle on his chest, a thin timeline bar with a small orange marker across his belly, orange trim down the outer edges of his body, short stubby arms with round mitten hands and short stubby legs with orange soles. His head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

In the first half second he bends his knees into a little crouch. Over the next second he springs up into a happy jump with both arms up high and one finger of each mitten hand pointing up at the sky, and a small dark smile appears on the front of his head just below the play triangle. His whole body and head stay inside the frame at the top of the jump. Over the following three quarters of a second he lands back on the same spot with a small squash and a happy wiggle, fingers still up. In the last three quarters of a second he lowers his arms to his sides and the smile fades away. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing on the jump, a soft bouncy thump on the landing, a quick bright film-reel whirr, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video happy head pop

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body whose short neck goes straight into the plain mauve-brown top of his body with no collar, a dark clapperboard icon with orange stripes and an orange play triangle on his chest, a thin timeline bar with a small orange marker across his belly, orange trim down the outer edges of his body, short stubby arms with round mitten hands and short stubby legs with orange soles. His head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

In the first half second he bends his knees into a little crouch. Over the next three quarters of a second he springs up into a big happy jump with both arms thrown up high, jumping so hard that his film-frame head pops up off his neck and floats a little above his body. Over the following three quarters of a second, at the top of the jump, his head spins round once in the air, showing its side, its plain back, its other side and its front again, while a small dark smile shows on the front of his head just below the play triangle. Over the next half second his body lands back on the same spot and his head drops back down onto his neck with a springy little bounce. In the last half second he lowers his arms to his sides and the smile fades away. His head comes off like a toy part and clicks back on, and his whole body and head stay inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing as the head pops off, a quick whirring spin, a small plastic click as it lands back on its neck, a quick bright film-reel whirr, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video failed

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body whose short neck goes straight into the plain mauve-brown top of his body with no collar, a dark clapperboard icon with orange stripes and an orange play triangle on his chest, a thin timeline bar with a small orange marker across his belly, orange trim down the outer edges of his body, short stubby arms with round mitten hands and short stubby legs with orange soles. His head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

In the first half second his film-frame head pops straight up off his neck with a spring, and the orange scrubber bar on his head snaps to the left edge and the sprocket holes stop dead. Over the next second and a quarter his body juggles the head just above his shoulders, bouncing it from one mitten hand to the other and back, twice, scrambling to keep hold of it. Over the following half second he catches it in both hands and plonks it back onto his neck, tilted crooked to one side. In the last three quarters of a second he gives the side of his head one small tap, it straightens with a click, the scrubber bar glides back to its place just right of the middle, and he lowers his hands to his sides. His head comes off like a toy part, never broken, and it stays inside the frame the whole time, never higher than a little above his shoulders. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing as the head pops off, quick hollow plastic taps as he juggles it, one clunk as it goes on crooked, a small click as it straightens, a short film-jam rattle, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

## Rolls

All 40 queued in one go 2026-09-15 (~1h45m, one after another) and verified by agent: sidecar prompt identical to the
prompt above, `minimax-h3`, both frame slots = that mascot's staged rest frame, 768x768 1:1 turbo, and ffprobe 124 frames
for 5s (5.17s) and 73 for 3s. Fabio's first look at `i2v_001` and `i2v_002`: "that's what I'm talking about, some more
movement". **All 40 good (Fabio, reviewed in the app as they landed, 2026-09-15). No rerolls.** Every card renamed to
its clip heading below (e.g. `i2v_001` = "Vision idle 1").

Motion numbers (no frames looked at; grey 96x96): **move** = peak mean-abs difference of any frame against frame 0,
**loop** = last frame against frame 0, **still** = share of frames within 1.0 of frame 0. For scale, the approved
Reference clips `ref2v_004`, `ref2v_012`, `ref2v_014` read move 20.1 / 21.0 / 8.6, loop 0.6 / 0.6 / 2.6.

| Clip | Card | Seed | Time | Move | Loop | Still |
|---|---|---|---|---|---|---|
| Vision idle 1 | `i2v_001` | 4211458564 | 196s | 21.8 | 0.7 | 7% |
| Vision idle 2 | `i2v_002` | 3072333194 | 191s | 15.6 | 0.4 | 12% |
| Vision idle 3 | `i2v_003` | 3338227449 | 188s | 14.5 | 0.3 | 11% |
| Vision greet wave | `i2v_004` | 3373276213 | 139s | 13.7 | 0.4 | 15% |
| Vision greet say cheese | `i2v_005` | 2070772875 | 138s | 12.7 | 0.8 | 12% |
| Vision happy hop | `i2v_006` | 3216671903 | 138s | 22.4 | 0.5 | 34% |
| Vision happy head pop | `i2v_007` | 2873600089 | 138s | 29.3 | 0.3 | 29% |
| Vision failed | `i2v_008` | 1701835938 | 139s | 26.2 | 0.6 | 18% |
| Studio idle 1 | `i2v_009` | 3653048807 | 191s | 24.3 | 0.5 | 9% |
| Studio idle 2 | `i2v_010` | 3977342752 | 186s | 17.9 | 0.5 | 15% |
| Studio idle 3 | `i2v_011` | 2509337614 | 185s | 10.9 | 0.4 | 17% |
| Studio greet wave | `i2v_012` | 2769616681 | 134s | 17.2 | 0.7 | 18% |
| Studio greet hat tip | `i2v_013` | 3004251731 | 133s | 14.0 | 0.5 | 15% |
| Studio happy hop | `i2v_014` | 4171423263 | 136s | 26.0 | 0.3 | 34% |
| Studio happy head pop | `i2v_015` | 1256871197 | 133s | 30.0 | 0.4 | 41% |
| Studio failed | `i2v_016` | 1045541466 | 137s | 22.7 | 0.7 | 25% |
| Prompt idle 1 | `i2v_017` | 3410449379 | 187s | 37.7 | 0.4 | 8% |
| Prompt idle 2 | `i2v_018` | 591946489 | 186s | 18.2 | 0.4 | 18% |
| Prompt idle 3 | `i2v_019` | 3129782531 | 187s | 18.0 | 0.2 | 20% |
| Prompt greet wave | `i2v_020` | 3478508399 | 138s | 16.3 | 0.4 | 15% |
| Prompt greet typing dots | `i2v_021` | 950417140 | 138s | 15.5 | 0.8 | 19% |
| Prompt happy hop | `i2v_022` | 567040366 | 137s | 32.6 | 0.3 | 38% |
| Prompt happy head pop | `i2v_023` | 3402457906 | 134s | 33.7 | 0.2 | 37% |
| Prompt failed | `i2v_024` | 3736026528 | 138s | 33.1 | 0.3 | 22% |
| Audio idle 1 | `i2v_025` | 3397449833 | 188s | 25.3 | 0.4 | 21% |
| Audio idle 2 | `i2v_026` | 309171570 | 192s | 17.2 | 0.6 | 14% |
| Audio idle 3 | `i2v_027` | 2922035901 | 200s | 14.1 | 0.6 | 15% |
| Audio greet wave | `i2v_028` | 1110267908 | 140s | 15.3 | 0.9 | 10% |
| Audio greet ear cup | `i2v_029` | 1860213269 | 141s | 20.6 | 1.1 | 5% |
| Audio happy hop | `i2v_030` | 2469339239 | 140s | 24.3 | 0.6 | 40% |
| Audio happy head pop | `i2v_031` | 2661095000 | 147s | 28.7 | 0.7 | 32% |
| Audio failed | `i2v_032` | 1704791168 | 143s | 30.7 | 0.9 | 15% |
| Video idle 1 | `i2v_033` | 1070315834 | 194s | 17.4 | 0.6 | 24% |
| Video idle 2 | `i2v_034` | 137899632 | 193s | 15.8 | 0.5 | 9% |
| Video idle 3 | `i2v_035` | 2124282815 | 197s | 17.6 | 0.4 | 20% |
| Video greet wave | `i2v_036` | 2365206971 | 140s | 11.6 | 0.3 | 12% |
| Video greet director frame | `i2v_037` | 2776260054 | 139s | 11.7 | 0.4 | 21% |
| Video happy hop | `i2v_038` | 3662878688 | 142s | 27.1 | 0.5 | 23% |
| Video happy head pop | `i2v_039` | 4146472852 | 143s | 30.0 | 0.4 | 30% |
| Video failed | `i2v_040` | 3987097989 | 144s | 26.4 | 0.3 | 23% |

## Finding: the same picture as start AND end frame moves fine on plain H3

The brief's worry (same PNG at both ends "may barely move") did not happen. Every clip moved at least as much as the
approved Reference clips, every clip returned to its first frame (loop at most 1.1), and the last frames of `i2v_001`
change by 0.1 to 1.2 per step, so there is no snap onto the end frame. The snap fix (timed beats plus "moving in every
single frame") was in every prompt, so this proves the pair works together, not the frame trick alone.

Cost: plain H3 turbo at 768x768 on the 4060 Ti ran ~186-200s for 124 frames and ~133-147s for 73.
