# Scenario clips: app spots and the Studio agent

> **Moved here from MadPony-Identity on 2026-09-20.** This is the record of HOW the clip was made - prompt, seed, what failed and why. To wire a clip, read `mascot-placement.md` and `mascot-gif-manifest.md` instead.

MPI-78 phase 2, third batch. Agreed with Fabio 2026-09-15 from the brief's app-spot and scenario tables. Where every clip
lands in the app: `mascot-placement.md`. 26 clips, queued together by agent 2026-09-15.

- **Studio only (6):** engine starting, landing with no projects, update ready, and the agent chat's thinking, listening
  and answer ready.
- **Every mascot (20):** job cancelled, warning toast heads up, search with no results, empty gallery head peek.

Dropped in the same conversation, do not re-propose: a waiting clip (the user waits, the mascot works: that is the
Generating card's working clip), long idle (3 idles plus the app playing a random next one covers it), a mode-switch
head swap (Tab snaps straight into the next mode, there is no moment to animate), a happy clip on the float latent
window (the media lands at the same moment, so it could never play). The landing crew passing a high five down the line
is liked but parked: it needs sequencing code in the app and an 8:5 frame, not 1:1.

## Settings

- Same route as `mascot-states.md`: **plain MiniMax H3** (`minimax-h3`, `i2v_ms`), the SAME picture as start and end frame,
  1:1, quality medium (768x768), turbo on, seed random. 5s for job cancelled, search no results, engine starting and
  landing; 3s for the rest.
- Full-body clips reuse the state batch's staged rest frames (the same files), so they open and close on exactly the
  frame all 40 state clips share and swap with them with no jump.
- **Gallery peek frame (new):** `{Mascot}-Logo.png` (the head) cropped to its alpha box, scaled to 1100px wide, alpha-
  composited onto the same grey (202,202,202) 2000x2000 canvas, centred, with its lower 30% below the bottom edge.

## Rules

The state batch's rules all hold (timed beats, snap fix, props out from and back behind his back, whole body in frame,
head comes off like a toy part). The prompts share its wording block for block. "No flicker" is dropped only where a
light is meant to flash: Studio engine starting (television static) and Vision heads up (warning light).

## Prompts

### Studio engine starting

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

He is powering himself up, and he boots up by putting himself together. In the first three quarters of a second his screen goes plain pale beige with no face on it, and his monitor head pops straight up off his neck with a spring and drops down onto the ground beside his right foot, its screen facing the camera. Over the next second his headless body pats the empty top of his neck twice with both mitten hands, puzzled. Over the following second he bends down, picks his head up off the ground in both hands and straightens up again. Over the next three quarters of a second he lifts his head up and pushes it down onto his neck, where it clicks into place with a small springy bounce. In the last second and a half his screen fills with fuzzy grey television static, the static clears, his two pixel eyes and his short flat mouth line switch back on with one quick blink, his two antennas spring back straight up, and he lowers his hands to his sides. His head comes off like a toy part, never broken, and it stays inside the frame the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A small electronic power-down blip, a springy boing as the head pops off, a soft plastic bump as it lands, two soft pats, a small plastic click as it goes back on, a short burst of crackling television static, a cheerful little start-up chime, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

### Studio landing no projects

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

His head is so eager to say hello that it runs off without him. In the first three quarters of a second his monitor head pops up off his neck and hops away on its own towards the left edge of the picture in two small bouncy hops, landing on the ground, while his body stands there with no head. Over the next second his headless body waddles after it with both arms stretched out in front of him, three small hurried steps, staying well inside the frame. Over the following three quarters of a second he scoops the head up in both mitten hands and pushes it back onto his neck with a springy little click. Over the next second and a quarter he walks three small bouncy steps back to the spot where he started. In the last second and a quarter he turns to face the camera, his short flat mouth line changes into a wide pixel smile, he waves one mitten hand in two quick friendly waves, and he lowers his hand to his side as his mouth goes back to its short flat line. His head comes off like a toy part and clicks back on, and it stays inside the frame the whole time. His whole body stays well inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A springy boing as the head pops off, two soft bouncy plastic hops, quick padding footsteps, a small plastic click as it goes back on, a light cartoon whoosh with each wave, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio update ready

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

Something new has arrived, and he pops up with the news like a jack-in-the-box. In the first half second he bends his knees into a little crouch and his monitor head sinks down into the top of his body until only his antennas and the top of his screen show above his collar. Over the next half second his head springs high up out of his body on a coiled silver metal spring, like a jack-in-the-box, and his two pixel eyes change into two big happy upturned arcs. Over the following second his head bobs and wobbles on top of the spring from side to side, twice, while his arms fly up in surprise. Over the next half second the spring squashes back down out of sight inside his body and his head settles back onto his neck. In the last half second he straightens his knees, his pixel eyes change back into two small dark upright rectangles, and he lowers his arms to his sides. The spring and his head stay inside the frame with light grey space above them the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft squashing creak, a big springy boing as the head shoots up, two wobbly spring boings, a soft click as it settles back, a tiny cheerful electronic chime, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio agent thinking

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

He is thinking hard, and his head turns like a loading spinner. In the first half second he lifts one mitten hand up to the bottom edge of his screen, like a hand on his chin, and in place of his mouth three small dark square dots start lighting up one after another from left to right. Over the next two seconds his whole monitor head turns round on his neck in one full smooth circle at an even steady speed, like a loading spinner, showing its side, its plain rounded back with its two antennas, its other side and its front again. In the last half second the dots clear, his short flat mouth line is back, his pixel eyes blink once, and he lowers his hand to his side. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft steady mechanical whirr as his head turns, three tiny soft electronic blips repeating as the dots light up, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio agent listening

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

He is listening closely to the person typing to him. In the first half second he leans his whole body a little towards the camera and cups one mitten hand beside the side of his head, like listening carefully, and his two antennas perk up straight and quiver. Over the next second and a half he gives two slow thoughtful nods, and his two pixel eyes blink once between the nods. Over the following half second he tilts his head a little to one side, curious. In the last half second he straightens up, lowers his hand to his side, and his antennas settle. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A tiny springy quiver from the antennas, two soft creaks as he nods, one tiny soft blip as he blinks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio agent answer ready

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

He has the answer ready and presents it proudly. In the first half second he lifts both mitten hands up in front of his chest. Over the next second he flings both arms out wide to the sides with his palms up, like a magician saying ta-da, his short flat mouth line changes into a wide pixel smile, and small bright sparkles twinkle around him. Over the following three quarters of a second he holds the pose and gives one small proud bounce on the spot, and his two antennas wiggle. In the last three quarters of a second he lowers his arms to his sides, the sparkles fade away and his mouth goes back to its short flat line. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A light cartoon whoosh as his arms fly out, a bright little sparkle chime, a tiny springy wobble from the antennas, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Vision job cancelled

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

He gives up on a job halfway and wanders off, forgetting his own head. In the first second he lifts his box camera head off his neck with both mitten hands, like taking off a hat, and sets it down on the ground beside his right foot, facing the camera. Over the next second, with no head on his neck, he turns towards the left edge of the picture and walks three small bouncy steps away, staying well inside the frame, while his head waits on the ground. Over the following three quarters of a second the small pink light in the top right corner of the head blinks on and off twice, calling him back, and he stops and pats the empty top of his neck twice with one mitten hand. Over the next second and a quarter he hurries three quick steps back to the spot where he started, picks his head up off the ground in both hands and pushes it back onto his neck with a springy little click. In the last second he turns to face the camera, gives one small sheepish shrug and lowers his arms to his sides. His head comes off like a toy part, never broken, and it stays inside the frame the whole time. The glass of his lens stays perfectly clean, dark and glossy for the whole shot, with its two small round highlights. His whole body stays well inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft plastic pop as the head comes off, soft padding footsteps, two tiny electronic beeps from the head, quick hurried footsteps, a small plastic click as the head goes back on, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio job cancelled

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

He gives up on a job halfway and wanders off, forgetting his own head. In the first second he lifts his monitor head off his neck with both mitten hands, like taking off a hat, and sets it down on the ground beside his right foot, facing the camera. Over the next second, with no head on his neck, he turns towards the left edge of the picture and walks three small bouncy steps away, staying well inside the frame, while his head waits on the ground. Over the following three quarters of a second the two pixel eyes on the head's screen blink twice, calling him back, and he stops and pats the empty top of his neck twice with one mitten hand. Over the next second and a quarter he hurries three quick steps back to the spot where he started, picks his head up off the ground in both hands and pushes it back onto his neck with a springy little click. In the last second he turns to face the camera, gives one small sheepish shrug and lowers his arms to his sides. His head comes off like a toy part, never broken, and it stays inside the frame the whole time. His whole body stays well inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft plastic pop as the head comes off, soft padding footsteps, two tiny electronic beeps from the head, quick hurried footsteps, a small plastic click as the head goes back on, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt job cancelled

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a yellow pill-shaped light at the top of his chest, a small keyboard of mauve keys across his belly, a yellow band around each arm just above the hand, short stubby arms with round mitten hands and short stubby legs. His head sits on a short thin neck and is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor.

He gives up on a job halfway and wanders off, forgetting his own head. In the first second he lifts his speech-bubble head off his neck with both mitten hands, like taking off a hat, and sets it down on the ground beside his right foot, facing the camera. Over the next second, with no head on his neck, he turns towards the left edge of the picture and walks three small bouncy steps away, staying well inside the frame, while his head waits on the ground. Over the following three quarters of a second the yellow underscore cursor on the head's screen blinks quickly twice, calling him back, and he stops and pats the empty top of his neck twice with one mitten hand. Over the next second and a quarter he hurries three quick steps back to the spot where he started, picks his head up off the ground in both hands and pushes it back onto his neck with a springy little click. In the last second he turns to face the camera, gives one small sheepish shrug and lowers his arms to his sides. His head comes off like a toy part, never broken, and it stays inside the frame the whole time. His whole body stays well inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft plastic pop as the head comes off, soft padding footsteps, two tiny electronic beeps from the head, quick hurried footsteps, a small plastic click as the head goes back on, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio job cancelled

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

He gives up on a job halfway and wanders off, forgetting his own head. In the first second he lifts his box head, headphones and all, off his neck with both mitten hands, like taking off a hat, and sets it down on the ground beside his right foot, facing the camera. Over the next second, with no head on his neck, he turns towards the left edge of the picture and walks three small bouncy steps away, staying well inside the frame, while his head waits on the ground. Over the following three quarters of a second the teal sound wave on the head's screen jumps up in two quick spikes, calling him back, and he stops and pats the empty top of his neck twice with one mitten hand. Over the next second and a quarter he hurries three quick steps back to the spot where he started, picks his head up off the ground in both hands and pushes it back onto his neck with a springy little click. In the last second he turns to face the camera, gives one small sheepish shrug and lowers his arms to his sides. His head comes off like a toy part, never broken, and it stays inside the frame the whole time. His whole body stays well inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft plastic pop as the head comes off, soft padding footsteps, two tiny electronic beeps from the head, quick hurried footsteps, a small plastic click as the head goes back on, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video job cancelled

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body whose short neck goes straight into the plain mauve-brown top of his body with no collar, a dark clapperboard icon with orange stripes and an orange play triangle on his chest, a thin timeline bar with a small orange marker across his belly, orange trim down the outer edges of his body, short stubby arms with round mitten hands and short stubby legs with orange soles. His head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

He gives up on a job halfway and wanders off, forgetting his own head. In the first second he lifts his film-frame head off his neck with both mitten hands, like taking off a hat, and sets it down on the ground beside his right foot, facing the camera. Over the next second, with no head on his neck, he turns towards the left edge of the picture and walks three small bouncy steps away, staying well inside the frame, while his head waits on the ground. Over the following three quarters of a second the orange scrubber bar on the head gives two quick little jumps, calling him back, and he stops and pats the empty top of his neck twice with one mitten hand. Over the next second and a quarter he hurries three quick steps back to the spot where he started, picks his head up off the ground in both hands and pushes it back onto his neck with a springy little click. In the last second he turns to face the camera, gives one small sheepish shrug and lowers his arms to his sides. His head comes off like a toy part, never broken, and it stays inside the frame the whole time. His whole body stays well inside the frame the whole time. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft plastic pop as the head comes off, soft padding footsteps, two tiny electronic beeps from the head, quick hurried footsteps, a small plastic click as the head goes back on, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Vision heads up

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

He is warning the person watching: heads up. In the first half second he takes hold of his box camera head with both mitten hands. Over the next three quarters of a second he lifts it straight up off his neck and raises it high above his body at arm's length, holding it up like a sign for everyone to see. Over the following three quarters of a second he waggles it gently from side to side twice while the small pink light in the top right corner of his head flashes on and off quickly, like a warning light. Over the next half second he brings it back down and clicks it onto his neck. In the last half second he lowers his arms to his sides and the pink light steadies back to normal. His head comes off like a toy part and clicks back on, and his raised head stays inside the frame with light grey space above it the whole time. The glass of his lens stays perfectly clean, dark and glossy for the whole shot, with its two small round highlights. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft plastic pop as the head lifts off, two quick urgent electronic beeps, a small plastic click as it goes back on, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

### Studio heads up

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

He is warning the person watching: heads up. In the first half second he takes hold of his monitor head with both mitten hands. Over the next three quarters of a second he lifts it straight up off his neck and raises it high above his body at arm's length, holding it up like a sign for everyone to see. Over the following three quarters of a second he waggles it gently from side to side twice while his two pixel eyes change into two big round alert circles. Over the next half second he brings it back down and clicks it onto his neck. In the last half second he lowers his arms to his sides and his pixel eyes change back into two small dark upright rectangles. His head comes off like a toy part and clicks back on, and his raised head stays inside the frame with light grey space above it the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft plastic pop as the head lifts off, two quick urgent electronic beeps, a small plastic click as it goes back on, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt heads up

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a yellow pill-shaped light at the top of his chest, a small keyboard of mauve keys across his belly, a yellow band around each arm just above the hand, short stubby arms with round mitten hands and short stubby legs. His head sits on a short thin neck and is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor.

He is warning the person watching: heads up. In the first half second he takes hold of his speech-bubble head with both mitten hands. Over the next three quarters of a second he lifts it straight up off his neck and raises it high above his body at arm's length, holding it up like a sign for everyone to see. Over the following three quarters of a second he waggles it gently from side to side twice while the yellow underscore cursor on his screen blinks fast, like an alert. Over the next half second he brings it back down and clicks it onto his neck. In the last half second he lowers his arms to his sides and the cursor settles back to its steady blink. His head comes off like a toy part and clicks back on, and his raised head stays inside the frame with light grey space above it the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft plastic pop as the head lifts off, two quick urgent electronic beeps, a small plastic click as it goes back on, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio heads up

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

He is warning the person watching: heads up. In the first half second he takes hold of his box head, headphones and all, with both mitten hands. Over the next three quarters of a second he lifts it straight up off his neck and raises it high above his body at arm's length, holding it up like a sign for everyone to see. Over the following three quarters of a second he waggles it gently from side to side twice while the teal sound wave on his screen jumps into tall spiky peaks like an alarm. Over the next half second he brings it back down and clicks it onto his neck. In the last half second he lowers his arms to his sides and the teal sound wave on his screen is exactly as it was at the start. His head comes off like a toy part and clicks back on, and his raised head stays inside the frame with light grey space above it the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft plastic pop as the head lifts off, two quick urgent electronic beeps, a small plastic click as it goes back on, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video heads up

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body whose short neck goes straight into the plain mauve-brown top of his body with no collar, a dark clapperboard icon with orange stripes and an orange play triangle on his chest, a thin timeline bar with a small orange marker across his belly, orange trim down the outer edges of his body, short stubby arms with round mitten hands and short stubby legs with orange soles. His head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

He is warning the person watching: heads up. In the first half second he takes hold of his film-frame head with both mitten hands. Over the next three quarters of a second he lifts it straight up off his neck and raises it high above his body at arm's length, holding it up like a sign for everyone to see. Over the following three quarters of a second he waggles it gently from side to side twice while the orange scrubber bar on his head slides quickly to the left edge and back, twice. Over the next half second he brings it back down and clicks it onto his neck. In the last half second he lowers his arms to his sides and the scrubber bar sits back in its place just right of the middle. His head comes off like a toy part and clicks back on, and his raised head stays inside the frame with light grey space above it the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft plastic pop as the head lifts off, two quick urgent electronic beeps, a small plastic click as it goes back on, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Vision search no results

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot. The magnifying glass is not in the first frame; it comes from this description alone.

The character is a small robot: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

He is searching for something that is not there. In the first second he reaches one mitten hand behind his back and brings out a small round magnifying glass with a plain wooden handle and a clear glass lens. Over the next second and a quarter he leans forward a little and sweeps the magnifying glass slowly across the ground in front of his feet from left to right, his head following it. Over the following three quarters of a second he straightens up and holds the magnifying glass up in front of his lens, looking straight at the camera through it, and his big pink-ringed lens looks huge and round behind the glass. Over the next second he lowers the glass and gives a big slow shrug, both arms out and palms up, and the small pink light in the top right corner of his head blinks once. In the last second he tucks the magnifying glass back behind his back, where it disappears out of sight behind his body, and brings both hands back to his sides. The magnifying glass only ever appears in front of his body or disappears behind his back, and it stays well inside the frame the whole time. The glass of his lens stays perfectly clean, dark and glossy for the whole shot, with its two small round highlights. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft rustle as the magnifying glass comes out, a curious little electronic hum as he searches, a small questioning electronic bloop on the shrug, a soft rustle as it is tucked away, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio search no results

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot. The magnifying glass is not in the first frame; it comes from this description alone.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

He is searching for something that is not there. In the first second he reaches one mitten hand behind his back and brings out a small round magnifying glass with a plain wooden handle and a clear glass lens. Over the next second and a quarter he leans forward a little and sweeps the magnifying glass slowly across the ground in front of his feet from left to right, his head following it. Over the following three quarters of a second he straightens up and holds the magnifying glass up in front of his screen, looking straight at the camera through it, and his two pixel eyes look huge behind the glass. Over the next second he lowers the glass and gives a big slow shrug, both arms out and palms up, and his short flat mouth line changes into a small wavy pixel line. In the last second he tucks the magnifying glass back behind his back, where it disappears out of sight behind his body, and brings both hands back to his sides, and his mouth goes back to its short flat line. The magnifying glass only ever appears in front of his body or disappears behind his back, and it stays well inside the frame the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft rustle as the magnifying glass comes out, a curious little electronic hum as he searches, a small questioning electronic bloop on the shrug, a soft rustle as it is tucked away, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt search no results

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot. The magnifying glass is not in the first frame; it comes from this description alone.

The character is a small robot: a rounded mauve-brown body with a yellow pill-shaped light at the top of his chest, a small keyboard of mauve keys across his belly, a yellow band around each arm just above the hand, short stubby arms with round mitten hands and short stubby legs. His head sits on a short thin neck and is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor.

He is searching for something that is not there. In the first second he reaches one mitten hand behind his back and brings out a small round magnifying glass with a plain wooden handle and a clear glass lens. Over the next second and a quarter he leans forward a little and sweeps the magnifying glass slowly across the ground in front of his feet from left to right, his head following it. Over the following three quarters of a second he straightens up and holds the magnifying glass up in front of his screen, looking straight at the camera through it, and the yellow > arrow and underscore cursor on his screen look huge behind the glass. Over the next second he lowers the glass and gives a big slow shrug, both arms out and palms up, and three yellow dots light up one after another on his screen and fade away. In the last second he tucks the magnifying glass back behind his back, where it disappears out of sight behind his body, and brings both hands back to his sides, and his screen shows the yellow > arrow and the yellow underscore cursor again. The magnifying glass only ever appears in front of his body or disappears behind his back, and it stays well inside the frame the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft rustle as the magnifying glass comes out, a curious little electronic hum as he searches, a small questioning electronic bloop on the shrug, a soft rustle as it is tucked away, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio search no results

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot. The magnifying glass is not in the first frame; it comes from this description alone.

The character is a small robot: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

He is searching for something that is not there. In the first second he reaches one mitten hand behind his back and brings out a small round magnifying glass with a plain wooden handle and a clear glass lens. Over the next second and a quarter he leans forward a little and sweeps the magnifying glass slowly across the ground in front of his feet from left to right, his head following it. Over the following three quarters of a second he straightens up and holds the magnifying glass up in front of his screen, looking straight at the camera through it, and the teal play button on his screen looks huge behind the glass. Over the next second he lowers the glass and gives a big slow shrug, both arms out and palms up, and the teal sound wave on his screen sinks into a flat line. In the last second he tucks the magnifying glass back behind his back, where it disappears out of sight behind his body, and brings both hands back to his sides, and the teal sound wave on his screen is exactly as it was at the start. The magnifying glass only ever appears in front of his body or disappears behind his back, and it stays well inside the frame the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft rustle as the magnifying glass comes out, a curious little electronic hum as he searches, a small questioning electronic bloop on the shrug, a soft rustle as it is tucked away, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video search no results

5s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera, his whole body in view with plenty of light grey space above him and on both sides, his arms resting at his sides. Keep his design exactly as it is in that frame for the whole shot: his proportions, his colours and his thick outline style. There is only one robot in the shot. The magnifying glass is not in the first frame; it comes from this description alone.

The character is a small robot: a rounded mauve-brown body whose short neck goes straight into the plain mauve-brown top of his body with no collar, a dark clapperboard icon with orange stripes and an orange play triangle on his chest, a thin timeline bar with a small orange marker across his belly, orange trim down the outer edges of his body, short stubby arms with round mitten hands and short stubby legs with orange soles. His head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

He is searching for something that is not there. In the first second he reaches one mitten hand behind his back and brings out a small round magnifying glass with a plain wooden handle and a clear glass lens. Over the next second and a quarter he leans forward a little and sweeps the magnifying glass slowly across the ground in front of his feet from left to right, his head following it. Over the following three quarters of a second he straightens up and holds the magnifying glass up in front of his head, looking straight at the camera through it, and the dark play triangle on his head looks huge behind the glass. Over the next second he lowers the glass and gives a big slow shrug, both arms out and palms up, and the orange scrubber bar on his head slides a little way left and stops. In the last second he tucks the magnifying glass back behind his back, where it disappears out of sight behind his body, and brings both hands back to his sides, and the scrubber bar glides back to its place just right of the middle. The magnifying glass only ever appears in front of his body or disappears behind his back, and it stays well inside the frame the whole time. His feet stay planted on the same spot for the whole shot. In the last moment he is back in exactly the pose he started in, standing on the same spot facing the camera with his arms resting at his sides, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing his whole body inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft rustle as the magnifying glass comes out, a curious little electronic hum as he searches, a small questioning electronic bloop on the shrug, a soft rustle as it is tucked away, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Vision gallery peek

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the head of a small robot on its own, peeking up over the bottom edge of the frame in the centre, with the bottom edge of the frame hiding the lower part of the head and plenty of light grey space above it and on both sides. Keep the head's design exactly as it is in that frame for the whole shot: its shape, its colours and its thick outline style. Only this one head is in the shot, and the rest of the robot stays out of sight below the bottom edge of the frame the whole time.

The character is a small robot, and only his head is in this shot. The head is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

It is a shy little head checking whether anyone is there. In the first half second it rises a little higher over the bottom edge of the frame. Over the next second it looks slowly to the left and then slowly to the right, tipping a little each way. Over the following half second it turns to face the camera and the small pink light in its top right corner blinks on and off twice, surprised to see someone. Over the next half second it ducks quickly down behind the bottom edge until only the very top of it shows. In the last half second it rises slowly back up to exactly where it started. The glass of its lens stays perfectly clean, dark and glossy for the whole shot, with its two small round highlights. In the last moment the head is back in exactly the place and pose it started in, peeking over the bottom edge of the frame in the centre and facing the camera, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and the head is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing the head low in the centre of the frame with a clear margin of light grey background above it and on both sides, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft curious electronic hum as it looks around, two tiny surprised electronic beeps, a quick soft whoosh as it ducks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio gallery peek

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the head of a small robot on its own, peeking up over the bottom edge of the frame in the centre, with the bottom edge of the frame hiding the lower part of the head and plenty of light grey space above it and on both sides. Keep the head's design exactly as it is in that frame for the whole shot: its shape, its colours and its thick outline style. Only this one head is in the shot, and the rest of the robot stays out of sight below the bottom edge of the frame the whole time.

The character is a small robot, and only his head is in this shot. The head is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

It is a shy little head checking whether anyone is there. In the first half second it rises a little higher over the bottom edge of the frame. Over the next second it looks slowly to the left and then slowly to the right, tipping a little each way. Over the following half second it turns to face the camera and its two pixel eyes blink twice and its two antennas give a little twitch, surprised to see someone. Over the next half second it ducks quickly down behind the bottom edge until only the very top of it shows. In the last half second it rises slowly back up to exactly where it started. In the last moment the head is back in exactly the place and pose it started in, peeking over the bottom edge of the frame in the centre and facing the camera, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and the head is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing the head low in the centre of the frame with a clear margin of light grey background above it and on both sides, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft curious electronic hum as it looks around, two tiny surprised electronic beeps, a quick soft whoosh as it ducks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt gallery peek

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the head of a small robot on its own, peeking up over the bottom edge of the frame in the centre, with the bottom edge of the frame hiding the lower part of the head and plenty of light grey space above it and on both sides. Keep the head's design exactly as it is in that frame for the whole shot: its shape, its colours and its thick outline style. Only this one head is in the shot, and the rest of the robot stays out of sight below the bottom edge of the frame the whole time.

The character is a small robot, and only his head is in this shot. The head is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor.

It is a shy little head checking whether anyone is there. In the first half second it rises a little higher over the bottom edge of the frame. Over the next second it looks slowly to the left and then slowly to the right, tipping a little each way. Over the following half second it turns to face the camera and the yellow underscore cursor on its screen blinks quickly twice, surprised to see someone. Over the next half second it ducks quickly down behind the bottom edge until only the very top of it shows. In the last half second it rises slowly back up to exactly where it started. In the last moment the head is back in exactly the place and pose it started in, peeking over the bottom edge of the frame in the centre and facing the camera, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and the head is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing the head low in the centre of the frame with a clear margin of light grey background above it and on both sides, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft curious electronic hum as it looks around, two tiny surprised electronic beeps, a quick soft whoosh as it ducks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio gallery peek

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the head of a small robot on its own, peeking up over the bottom edge of the frame in the centre, with the bottom edge of the frame hiding the lower part of the head and plenty of light grey space above it and on both sides. Keep the head's design exactly as it is in that frame for the whole shot: its shape, its colours and its thick outline style. Only this one head is in the shot, and the rest of the robot stays out of sight below the bottom edge of the frame the whole time.

The character is a small robot, and only his head is in this shot. The head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and it wears big headphones, a grey-green headband arching over the top of the head and a round teal ear cup on each side.

It is a shy little head checking whether anyone is there. In the first half second it rises a little higher over the bottom edge of the frame. Over the next second it looks slowly to the left and then slowly to the right, tipping a little each way. Over the following half second it turns to face the camera and the teal sound wave on its screen jumps up in two quick spikes, surprised to see someone. Over the next half second it ducks quickly down behind the bottom edge until only the very top of it shows. In the last half second it rises slowly back up to exactly where it started. In the last moment the head is back in exactly the place and pose it started in, peeking over the bottom edge of the frame in the centre and facing the camera, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and the head is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing the head low in the centre of the frame with a clear margin of light grey background above it and on both sides, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft curious electronic hum as it looks around, two tiny surprised electronic beeps, a quick soft whoosh as it ducks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video gallery peek

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the head of a small robot on its own, peeking up over the bottom edge of the frame in the centre, with the bottom edge of the frame hiding the lower part of the head and plenty of light grey space above it and on both sides. Keep the head's design exactly as it is in that frame for the whole shot: its shape, its colours and its thick outline style. Only this one head is in the shot, and the rest of the robot stays out of sight below the bottom edge of the frame the whole time.

The character is a small robot, and only his head is in this shot. The head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

It is a shy little head checking whether anyone is there. In the first half second it rises a little higher over the bottom edge of the frame. Over the next second it looks slowly to the left and then slowly to the right, tipping a little each way. Over the following half second it turns to face the camera and the orange scrubber bar on it gives two quick little jumps, surprised to see someone. Over the next half second it ducks quickly down behind the bottom edge until only the very top of it shows. In the last half second it rises slowly back up to exactly where it started. In the last moment the head is back in exactly the place and pose it started in, peeking over the bottom edge of the frame in the centre and facing the camera, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and the head is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing the head low in the centre of the frame with a clear margin of light grey background above it and on both sides, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft curious electronic hum as it looks around, two tiny surprised electronic beeps, a quick soft whoosh as it ducks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

## Gallery peek, reroll: loop fix

All five first peeks (`i2v_062`-`066`) ended higher than they started: loop 10 to 19.5, against at most 1.3 for every
other clip in the batch. The opening "rises a little higher" beat left the head up, and the last beat returned it to
that risen height instead of the first frame's. Prompt's also frayed into specks as it ducked. The reroll drops the
rise, pins the height to the first frame twice, gives the return a whole second, and keeps the head solid ("like a
puppet ducking behind a wall"). Only the shot paragraph changes; the originals stay in the gallery for comparison.

### Vision gallery peek 2

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the head of a small robot on its own, peeking up over the bottom edge of the frame in the centre, with the bottom edge of the frame hiding the lower part of the head and plenty of light grey space above it and on both sides. Keep the head's design exactly as it is in that frame for the whole shot: its shape, its colours and its thick outline style. Only this one head is in the shot, and the rest of the robot stays out of sight below the bottom edge of the frame the whole time.

The character is a small robot, and only his head is in this shot. The head is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

It is a shy little head checking whether anyone is there. It is one solid head that slides down and up behind the bottom edge of the frame like a puppet ducking behind a wall, and it never rises any higher than it is in the first frame. In the first second it looks slowly to the left and then slowly to the right, tipping a little each way and staying at the same height. Over the next half second it turns to face the camera and the small pink light in its top right corner blinks on and off twice, surprised to see someone. Over the following half second it ducks quickly down behind the bottom edge until only the very top of it shows. In the last second it rises slowly back up to the same height it had in the first frame, no higher, with the same lower part of it hidden behind the bottom edge, and settles there. The glass of its lens stays perfectly clean, dark and glossy for the whole shot, with its two small round highlights. In the last moment the head is back in exactly the place and pose it started in, peeking over the bottom edge of the frame in the centre and facing the camera, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and the head is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing the head low in the centre of the frame with a clear margin of light grey background above it and on both sides, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft curious electronic hum as it looks around, two tiny surprised electronic beeps, a quick soft whoosh as it ducks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio gallery peek 2

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the head of a small robot on its own, peeking up over the bottom edge of the frame in the centre, with the bottom edge of the frame hiding the lower part of the head and plenty of light grey space above it and on both sides. Keep the head's design exactly as it is in that frame for the whole shot: its shape, its colours and its thick outline style. Only this one head is in the shot, and the rest of the robot stays out of sight below the bottom edge of the frame the whole time.

The character is a small robot, and only his head is in this shot. The head is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

It is a shy little head checking whether anyone is there. It is one solid head that slides down and up behind the bottom edge of the frame like a puppet ducking behind a wall, and it never rises any higher than it is in the first frame. In the first second it looks slowly to the left and then slowly to the right, tipping a little each way and staying at the same height. Over the next half second it turns to face the camera and its two pixel eyes blink twice and its two antennas give a little twitch, surprised to see someone. Over the following half second it ducks quickly down behind the bottom edge until only the very top of it shows. In the last second it rises slowly back up to the same height it had in the first frame, no higher, with the same lower part of it hidden behind the bottom edge, and settles there. In the last moment the head is back in exactly the place and pose it started in, peeking over the bottom edge of the frame in the centre and facing the camera, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and the head is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing the head low in the centre of the frame with a clear margin of light grey background above it and on both sides, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft curious electronic hum as it looks around, two tiny surprised electronic beeps, a quick soft whoosh as it ducks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt gallery peek 2

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the head of a small robot on its own, peeking up over the bottom edge of the frame in the centre, with the bottom edge of the frame hiding the lower part of the head and plenty of light grey space above it and on both sides. Keep the head's design exactly as it is in that frame for the whole shot: its shape, its colours and its thick outline style. Only this one head is in the shot, and the rest of the robot stays out of sight below the bottom edge of the frame the whole time.

The character is a small robot, and only his head is in this shot. The head is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor.

It is a shy little head checking whether anyone is there. It is one solid head that slides down and up behind the bottom edge of the frame like a puppet ducking behind a wall, and it never rises any higher than it is in the first frame. In the first second it looks slowly to the left and then slowly to the right, tipping a little each way and staying at the same height. Over the next half second it turns to face the camera and the yellow underscore cursor on its screen blinks quickly twice, surprised to see someone. Over the following half second it ducks quickly down behind the bottom edge until only the very top of it shows. In the last second it rises slowly back up to the same height it had in the first frame, no higher, with the same lower part of it hidden behind the bottom edge, and settles there. In the last moment the head is back in exactly the place and pose it started in, peeking over the bottom edge of the frame in the centre and facing the camera, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and the head is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing the head low in the centre of the frame with a clear margin of light grey background above it and on both sides, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft curious electronic hum as it looks around, two tiny surprised electronic beeps, a quick soft whoosh as it ducks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio gallery peek 2

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the head of a small robot on its own, peeking up over the bottom edge of the frame in the centre, with the bottom edge of the frame hiding the lower part of the head and plenty of light grey space above it and on both sides. Keep the head's design exactly as it is in that frame for the whole shot: its shape, its colours and its thick outline style. Only this one head is in the shot, and the rest of the robot stays out of sight below the bottom edge of the frame the whole time.

The character is a small robot, and only his head is in this shot. The head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and it wears big headphones, a grey-green headband arching over the top of the head and a round teal ear cup on each side.

It is a shy little head checking whether anyone is there. It is one solid head that slides down and up behind the bottom edge of the frame like a puppet ducking behind a wall, and it never rises any higher than it is in the first frame. In the first second it looks slowly to the left and then slowly to the right, tipping a little each way and staying at the same height. Over the next half second it turns to face the camera and the teal sound wave on its screen jumps up in two quick spikes, surprised to see someone. Over the following half second it ducks quickly down behind the bottom edge until only the very top of it shows. In the last second it rises slowly back up to the same height it had in the first frame, no higher, with the same lower part of it hidden behind the bottom edge, and settles there. In the last moment the head is back in exactly the place and pose it started in, peeking over the bottom edge of the frame in the centre and facing the camera, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and the head is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing the head low in the centre of the frame with a clear margin of light grey background above it and on both sides, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft curious electronic hum as it looks around, two tiny surprised electronic beeps, a quick soft whoosh as it ducks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video gallery peek 2

3s.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the head of a small robot on its own, peeking up over the bottom edge of the frame in the centre, with the bottom edge of the frame hiding the lower part of the head and plenty of light grey space above it and on both sides. Keep the head's design exactly as it is in that frame for the whole shot: its shape, its colours and its thick outline style. Only this one head is in the shot, and the rest of the robot stays out of sight below the bottom edge of the frame the whole time.

The character is a small robot, and only his head is in this shot. The head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

It is a shy little head checking whether anyone is there. It is one solid head that slides down and up behind the bottom edge of the frame like a puppet ducking behind a wall, and it never rises any higher than it is in the first frame. In the first second it looks slowly to the left and then slowly to the right, tipping a little each way and staying at the same height. Over the next half second it turns to face the camera and the orange scrubber bar on it gives two quick little jumps, surprised to see someone. Over the following half second it ducks quickly down behind the bottom edge until only the very top of it shows. In the last second it rises slowly back up to the same height it had in the first frame, no higher, with the same lower part of it hidden behind the bottom edge, and settles there. In the last moment the head is back in exactly the place and pose it started in, peeking over the bottom edge of the frame in the centre and facing the camera, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and the head is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, framing the head low in the centre of the frame with a clear margin of light grey background above it and on both sides, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft curious electronic hum as it looks around, two tiny surprised electronic beeps, a quick soft whoosh as it ducks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```
## Rolls

All 26 queued in one go 2026-09-15 (~70 min, one after another) and verified by agent: sidecar prompt identical to the
prompt above, `minimax-h3`, both frame slots = the staged frame, 768x768 1:1 turbo, ffprobe 124 frames for 5s and 73 for
3s. Every card named after its heading. Fabio has not reviewed them yet.

Motion numbers as in `mascot-states.md` (move, loop, still; no frames looked at except the five peeks). **Snap** (biggest step over
the median step) was measured too and left out: the approved state clips read up to 106 on it (Audio happy hop), so a high
ratio there means a hold, not a jump.

| Clip | Card | Seed | Time | Move | Loop | Still |
|---|---|---|---|---|---|---|
| Studio engine starting | `i2v_041` | 3694575168 | 196s | 21.2 | 0.5 | 18% |
| Studio landing no projects | `i2v_042` | 4076946089 | 193s | 35.5 | 0.3 | 13% |
| Studio update ready | `i2v_043` | 1542402757 | 141s | 24.4 | 0.7 | 37% |
| Studio agent thinking | `i2v_044` | 3604804013 | 137s | 12.3 | 0.6 | 12% |
| Studio agent listening | `i2v_045` | 1451317540 | 134s | 15.5 | 0.3 | 21% |
| Studio agent answer ready | `i2v_046` | 4219920042 | 133s | 18.9 | 0.8 | 29% |
| Vision job cancelled | `i2v_047` | 3057228906 | 187s | 39.1 | 0.3 | 12% |
| Studio job cancelled | `i2v_048` | 1769713727 | 187s | 35.1 | 0.3 | 12% |
| Prompt job cancelled | `i2v_049` | 1803003576 | 187s | 41.2 | 1.2 | 2% |
| Audio job cancelled | `i2v_050` | 2812280199 | 183s | 40.9 | 0.3 | 13% |
| Video job cancelled | `i2v_051` | 1133714286 | 187s | 35.7 | 0.5 | 8% |
| Vision heads up | `i2v_052` | 397784602 | 135s | 19.9 | 0.7 | 7% |
| Studio heads up | `i2v_053` | 1617214585 | 134s | 19.7 | 0.6 | 21% |
| Prompt heads up | `i2v_054` | 950215998 | 133s | 20.9 | 0.6 | 18% |
| Audio heads up | `i2v_055` | 1416965017 | 138s | 18.9 | 0.8 | 23% |
| Video heads up | `i2v_056` | 1663596382 | 133s | 17.8 | 0.4 | 16% |
| Vision search no results | `i2v_057` | 2185147782 | 185s | 17.6 | 0.3 | 10% |
| Studio search no results | `i2v_058` | 2452580501 | 185s | 20.3 | 0.4 | 16% |
| Prompt search no results | `i2v_059` | 4236971954 | 186s | 24.0 | 0.3 | 12% |
| Audio search no results | `i2v_060` | 836233365 | 183s | 21.1 | 0.6 | 12% |
| Video search no results | `i2v_061` | 3271817998 | 185s | 18.8 | 1.3 | 3% |
| Vision gallery peek | `i2v_062` | 965985227 | 136s | 14.5 | **10.3** | 14% |
| Studio gallery peek | `i2v_063` | 2159500639 | 135s | 13.1 | **11.1** | 14% |
| Prompt gallery peek | `i2v_064` | 2623499836 | 135s | 22.9 | **19.5** | 10% |
| Audio gallery peek | `i2v_065` | 2992449281 | 133s | 15.6 | **14.0** | 5% |
| Video gallery peek | `i2v_066` | 597574430 | 133s | 17.9 | **12.4** | 10% |

**The five peeks do not loop** (bold): each ends higher than it starts. Rerolled as `gallery peek 2`, see the section above.

**Rerolls** (same checks, all verified, cards named `{Mascot} gallery peek 2`):

| Clip | Card | Seed | Time | Move | Loop | Still |
|---|---|---|---|---|---|---|
| Vision gallery peek 2 | `i2v_067` | 3825739259 | 137s | 13.0 | 0.2 | 34% |
| Studio gallery peek 2 | `i2v_068` | 2570187334 | 136s | 10.0 | 0.2 | 26% |
| Prompt gallery peek 2 | `i2v_069` | 1626254599 | 133s | 23.2 | **17.9** | 4% |
| Audio gallery peek 2 | `i2v_070` | 4166661603 | 136s | 15.3 | **12.6** | 5% |
| Video gallery peek 2 | `i2v_071` | 1641579085 | 138s | 13.2 | 0.3 | 22% |

The fix worked for Vision, Studio and Video. **Prompt and Audio failed the same way twice:** the head rises in the first
second and ends at that risen height (Prompt no longer frays into specks). Not rerolled a third time on the same frame;
a start frame with more of the head in view is the likelier fix, and it changes the look, so it is Fabio's call.

**Decided 2026-09-16 (Fabio): no reroll.** All the peeks are fine as they are. Their home is the top edge of the prompt
box, where a peek plays once and leaves, so the loop no longer matters. Placement in `mascot-placement.md`.
