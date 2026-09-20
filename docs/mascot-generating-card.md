# Generating card: mascot clips

> **Moved here from MadPony-Identity on 2026-09-20.** This is the record of HOW the clip was made - prompt, seed, what failed and why. To wire a clip, read `mascot-placement.md` and `mascot-gif-manifest.md` instead.

MPI-78 phase 2. Rolled by agent 2026-09-15 over `/connector/generate`, local ComfyUI
on the RTX 4060 Ti, no pod. Vision first (A, A2, B), then the other nine together
(batch 2, below B).

## The two states (Cubric-Vision `MpiGalleryGrid.js` ~1518-1570, CSS ~306-320)

- **Getting ready** (`mascot-idle`): big and centred, replaces the spinner; today
  `idle.png` and `greet.png` swap on a random 4-8s timer.
- **Waiting** (`mascot-cooking`): once a preview lands, small (22% of card width) in
  the bottom-right corner; today the single `waiting.png`, the seated reader.

Both clips start and end on the same pose so they loop as GIFs.

## Settings (same as Fabio's `ref2v_001`)

- **MiniMax H3 Reference** (`minimax-h3-ref2va`, `ref2v_ms`), 1:1, quality medium
  (768x768), turbo on, duration 3 (73 frames), seed random. A, A2 and B went one
  submit at a time; batch 2 fired all nine submits together.
- `inputImage` (`<Picture 1>`) = the mascot's own sheet, staged with
  `place-preview-asset`, the only reference: Vision `Media/edit_002.png`, Studio
  `edit_003`, Prompt `edit_004`, Audio `edit_005`, Video `edit_008`.
- Reference detail is no longer a control (baked since Vision MPI-687).

## Prompts (whole, as rolled)

Neither prompt mentions a floor, a line or a shadow, on purpose: the first roll is a
test of what H3 does with the sheet's floor bar by default.

### A: Getting ready

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

The shot begins with him standing in the centre of the frame facing the camera, his whole body in view from his feet to the top of his head, with space above and around him, arms resting at his sides exactly like the front view in <Picture 1>. In the first half second he stands still, his big lens looking straight at the camera. Over the next second he lifts one mitten hand to his head and rubs the pink-ringed lens in two quick little circles, like wiping a smudge off it, then lowers the hand. Over the following half second the small pink light in the top right corner of his head blinks on bright, twice, and stays lit. In the last second he gives the camera one quick eager little wave with the same hand and drops it back to his side, ending in the same front-on pose he started in. His feet stay planted on the same spot for the whole shot, and he is moving in every part of the shot until that final pose.

The camera is locked off and completely static for the entire shot, framing his whole body with space above and around him, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft squeaky rub on glass, two tiny electronic beeps as the light blinks on, a light cartoon whoosh on the wave, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### A2: Getting ready, reroll (camera prep, no wipe)

After `ref2v_002` failed. Fabio's direction: he is readying his camera to take a photo
(lens, focus), still getting there, never a greeting. The wipe is gone because
"wiping a smudge off it" put the smudge on screen, and the lens glass is now pinned
clean in positive words.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

The shot begins with him standing in the centre of the frame facing the camera, his whole body in view from his feet to the top of his head, with space above and around him, arms resting at his sides exactly like the front view in <Picture 1>. He is a camera getting himself ready to take a photo, careful and precise like a photographer setting up. In the first half second he stands still, his big lens looking straight at the camera. Over the next second he lifts both mitten hands to his head, takes hold of the pink ring around his lens and twists it a quarter turn, and the lens slides forward out of his head a little, like a camera zooming in. Over the following second he twists the ring back, the lens slides back into his head, and the small pink light in the top right corner of his head blinks quickly on and off twice, like a camera finding its focus. In the last half second he gives the side of his head one small tap with one hand, like settling a part into place, and lowers both hands back to his sides, ending in the same front-on pose he started in. The glass of his lens stays perfectly clean, dark and glossy for the whole shot, with its two small round highlights exactly as in <Picture 1>. His feet stay planted on the same spot for the whole shot, and he is moving in every part of the shot until that final pose.

The camera is locked off and completely static for the entire shot, framing his whole body with space above and around him, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft ratcheting clicks as the lens ring turns, a small motor whirr as the lens slides out and back, two tiny electronic beeps as the light blinks, one light plastic tap, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### B: Waiting

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot. The armchair and the book are not in <Picture 1>; they come from this description alone.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

The shot begins with him sitting in a small rounded mustard-yellow armchair in the centre of the frame, the chair and his whole body in view with space above and around them, his body turned about 45 degrees towards the left edge of the picture like the three-quarter view on the right of <Picture 1>. He holds an open plain sage-green hardback book up in both mitten hands, and his lens points down at its pages. In the first second he reads, his head tipping in tiny steps as it follows the lines. Over the next half second one mitten hand flicks a page over. Over the following second his head lifts and his big lens peeks up over the top of the book straight at the camera, the small pink light in the top right corner of his head blinks once, and his head goes back down to the pages. In the last half second he settles back into reading, holding the book up exactly as he did at the start. The chair and his feet stay on the same spot for the whole shot, and he is moving in every part of the shot until he settles.

The camera is locked off and completely static for the entire shot, framing his whole body and the chair with space above and around them, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft papery page flip, one tiny electronic beep as the light blinks, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

## Batch 2: the other nine (queued 2026-09-15)

Ideas from the MPI-78 brief's idea table, same shape as A2. **Getting ready** = the
mascot readies its own tool and is not there yet; **working** = the user waits, the
mascot does the job, framed tighter ("filling most of the frame") because it plays at
22% of the card width.

Every clip loops: the opening pose and each prop's opening state are written out, the
last beat returns to them, repeating actions get whole cycles, and anything that
accumulates gets a reset beat (Polaroid tossed and a blank one ejected, Prompt's paper
torn off and tossed, Video's scrubber snapping back). Beat windows add up to 3s.

Studio getting ready alone drops "no flicker" from the constraint line: his screen
fills with television static, and the tail must not argue with the scene.

### Vision working

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot. The instant photos are not in <Picture 1>; they come from this description alone.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a pink V-shaped collar at the top of his chest and a small dark V inside it, a dark camera icon on his chest, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a wide mauve-brown box camera, with one big round lens ringed in bright pink in the middle of its front face, a thin seam line running across it, and a small round pink light in its top right corner.

The shot begins with him standing in the centre of the frame facing the camera, his whole body in view from his feet to the top of his head, filling most of the frame. He has just taken a photo and is waiting for it to develop. He holds up in one mitten hand, out to his side at shoulder height, a small square instant photo with a thick white border and a plain dark grey picture area, and his other arm rests at his side. For the first two seconds he shakes the photo quickly from side to side in four full shakes, and as he shakes it soft pink and sage-green colours slowly fade in across the dark grey until it shows a simple little picture of a round green hill under a soft pink sky. Over the next half second his big lens turns to look at the finished photo, the small pink light in the top right corner of his head blinks once, and he tosses the photo away over his shoulder so it flies out of the top of the frame. In the last half second a fresh instant photo with a plain dark grey picture area slides out of a thin slot along the bottom edge of the front of his head, and he takes it in the same mitten hand and holds it up out to his side at shoulder height, ending in exactly the pose he started in with a fresh dark grey photo in his hand, so the last frame matches the first frame. The glass of his lens stays perfectly clean, dark and glossy for the whole shot, with its two small round highlights exactly as in <Picture 1>. His feet stay planted on the same spot for the whole shot, and he is moving in every part of the shot.

The camera is locked off and completely static for the entire shot, framing his whole body and the photo so they fill most of the frame, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A quick papery flapping as the photo shakes, one tiny electronic beep as the light blinks, a light cartoon whoosh as the photo is tossed, a soft mechanical whirr as the fresh photo slides out, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio getting ready

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

The shot begins with him standing in the centre of the frame facing the camera, his whole body in view from his feet to the tips of his antennas, with space above and around him, arms resting at his sides exactly like the front view in <Picture 1>, and his pixel face on his screen exactly as in <Picture 1>. He is an old television switching himself on and tuning in, still warming up. In the first half second he lifts one mitten hand to the round knob on the side of his head. Over the next second he twists the knob one way and back again like tuning an old television, his whole screen fills with fuzzy grey television static, and his two antennas give two quick twitches and spring back straight up. Over the following second the static clears, his two pixel eyes switch back on with one quick blink, and in place of his mouth three small dark square dots light up one after another from left to right, like a thinking indicator, then all three clear and his short flat mouth line is back. In the last half second he lowers his hand back to his side, ending in exactly the same front-on pose he started in, with his pixel face exactly as it was at the start, so the last frame matches the first frame. His feet stay planted on the same spot for the whole shot, and he is moving in every part of the shot until that final pose.

The camera is locked off and completely static for the entire shot, framing his whole body with space above and around him, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft ratcheting clicks as the knob turns, a short burst of crackling television static, two tiny springy boings as the antennas twitch, three tiny soft electronic blips as the dots light up, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

### Studio working

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot. The stool, the desk and the keyboard are not in <Picture 1>; they come from this description alone.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

The shot begins with him sitting on a small round stool behind a small plain mauve-grey desk in the centre of the frame, facing the camera, the desk, his head and his upper body in view, filling most of the frame. On the desk sits a chunky plain keyboard with blank pale beige keys. He leans forward over it with both mitten hands on the keys, his pixel eyes looking down at them. He is hard at work. For the whole shot he types fast in a steady even rhythm, his two mitten hands tapping the keys alternately, left and right, and his two antennas bob gently in time with the taps. Below his pixel eyes, rows of short plain dark dashes scroll steadily up his pale beige screen and out of the top of it, like work flowing past. Halfway through, at one and a half seconds, he hits one wide key with a small bouncy flourish of one hand, then goes straight back to typing at the same fast rhythm. In the last moment he is leaning over the keyboard exactly as he started, both hands on the keys in the same places, so the last frame matches the first frame. The desk and the stool stay on the same spot for the whole shot, and he is moving in every part of the shot.

The camera is locked off and completely static for the entire shot, framing him, the desk and the keyboard so they fill most of the frame, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Fast soft plastic keyboard clicking the whole time, one heavier clack on the wide key, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt getting ready

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a yellow pill-shaped light at the top of his chest, a small keyboard of mauve keys across his belly, a yellow band around each arm just above the hand, short stubby arms with round mitten hands and short stubby legs. His head sits on a short thin neck and is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor, exactly as in <Picture 1>.

The shot begins with him standing in the centre of the frame facing the camera, his whole body in view from his feet to the top of his head, with space above and around him, arms resting at his sides exactly like the front view in <Picture 1>. He is getting ready to type, and he has not typed anything yet. In the first half second he lifts both mitten hands up in front of the keyboard on his belly. Over the next second he wiggles both hands in the air just above the keys, like a pianist warming up before playing, while the yellow underscore cursor on his screen blinks on and off at a steady pace. Over the following three quarters of a second he taps two keys on his belly, tap and tap, each key pressing in and popping back out, and with each tap the underscore cursor blinks faster, while his screen still shows only the yellow > arrow and the underscore cursor. In the last three quarters of a second he lowers both hands back to his sides and the cursor settles back to its steady blink, ending in exactly the same front-on pose he started in, so the last frame matches the first frame. His feet stay planted on the same spot for the whole shot, and he is moving in every part of the shot until that final pose.

The camera is locked off and completely static for the entire shot, framing his whole body with space above and around him, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft rustle as his hands wiggle, two crisp little key clicks, tiny quickening electronic ticks as the cursor blinks faster, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Prompt working

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot. The paper strip is not in <Picture 1>; it comes from this description alone.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a yellow pill-shaped light at the top of his chest, a small keyboard of mauve keys across his belly, a yellow band around each arm just above the hand, short stubby arms with round mitten hands and short stubby legs. His head sits on a short thin neck and is a chunky mauve-brown block shaped like a speech bubble with a stepped pixel-art outline, with a little speech-bubble tail poking down from its bottom edge and a dark screen on its front face showing a yellow > arrow and a yellow underscore cursor, exactly as in <Picture 1>.

The shot begins with him standing in the centre of the frame facing the camera, his whole body in view from his feet to the top of his head, filling most of the frame. A short stub of plain cream paper sticks up out of a thin slot in the top edge of his speech-bubble head, and he holds the end of it in both mitten hands just above his head. He is hard at work. For the first two seconds the plain cream paper strip feeds steadily up out of the slot and he pulls it down in front of him hand over hand, four even pulls, and the loose paper falls in soft curls onto the floor around his feet, while the yellow underscore cursor on his screen blinks steadily. Over the next half second he tears the strip off at the slot with one quick tug, leaving the same short stub sticking up out of the slot, then gathers the long strip and all its curls into his arms and tosses them away out of the right edge of the frame, leaving the floor around his feet completely clear. In the last half second he reaches both hands back up and takes hold of the end of the stub above his head, ending in exactly the pose he started in, so the last frame matches the first frame. The paper is plain, smooth and cream-coloured for the whole shot. His feet stay planted on the same spot for the whole shot, and he is moving in every part of the shot.

The camera is locked off and completely static for the entire shot, framing his whole body and the paper so they fill most of the frame, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A steady soft whirr of paper feeding out, papery rustling as he pulls it hand over hand, one crisp paper rip, a light cartoon whoosh as the strip is tossed away, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio getting ready

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

The shot begins with him standing in the centre of the frame facing the camera, his whole body in view from his feet to the top of his headband, with space above and around him, arms resting at his sides exactly like the front view in <Picture 1>. At the start the teal sound wave on either side of the play button on his screen is a calm flat teal line. He is doing a quick sound check before a show. In the first three quarters of a second he lifts one mitten hand and presses the ear cup on that side against his head, listening, his head tilting a little towards it. Over the next second, still holding the ear cup, he taps the round speaker grille on his chest twice with his other hand, and with each tap the flat teal line on his screen jumps up into a tall spiky sound wave and settles flat again. Over the following three quarters of a second he gives one small satisfied nod. In the last half second he lowers both hands back to his sides and straightens his head, with the teal line on his screen calm and flat again, ending in exactly the same front-on pose he started in, so the last frame matches the first frame. His feet stay planted on the same spot for the whole shot, and he is moving in every part of the shot until that final pose.

The camera is locked off and completely static for the entire shot, framing his whole body with space above and around him, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A soft cushioned press on the ear cup, two dull hollow taps on the speaker grille each with a short bright electronic blip, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio working

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot. The DJ table, the turntable and the mixer are not in <Picture 1>; they come from this description alone.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

The shot begins with him standing in the centre of the frame behind a small plain mauve-grey DJ table, facing the camera, the table, his head and his upper body in view, filling most of the frame. On the left of the table sits a turntable with a plain black record with a plain teal centre, and on the right sits a small mixer with one upright slider. His mitten hand on the left side of the picture rests on the record, and his other mitten hand rests on the slider, which sits halfway up. He is hard at work mixing a track. For the whole shot he scratches the record with quick short back-and-forth strokes, four full back-and-forth strokes spread evenly across the shot, and at the same time his other hand pushes the slider up to the top and back down to halfway, twice, in time with the strokes. With every scratch the teal sound wave on his screen jumps up into tall spikes, and his head bobs down and up on the beat so his headphones bounce. In the last moment his hand is back on the record at the same spot, the slider is back at halfway and his head is up, exactly as he started, so the last frame matches the first frame. The table stays on the same spot for the whole shot, and he is moving in every part of the shot.

The camera is locked off and completely static for the entire shot, framing him and the DJ table so they fill most of the frame, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Quick rubbery record scratches, a soft sliding swish on the slider, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video getting ready

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot.

The character is the small robot from <Picture 1>: a rounded mauve-brown body whose short neck goes straight into the plain mauve-brown top of his body with no collar, a dark clapperboard icon with orange stripes and an orange play triangle on his chest, a thin timeline bar with a small orange marker across his belly, orange trim down the outer edges of his body, short stubby arms with round mitten hands and short stubby legs with orange soles. His head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame just right of the middle and sticks out above and below it.

The shot begins with him standing in the centre of the frame facing the camera, his whole body in view from his feet to the top of his scrubber bar, with space above and around him, arms resting at his sides exactly like the front view in <Picture 1>, and the orange scrubber bar on his head in its place just right of the middle. He is a film director getting ready for a take, and the take has not started yet. In the first second the orange scrubber bar slides smoothly left across the front of his head all the way to the left edge, like a tape rewinding to the start, while the square sprocket holes down both sides of his head roll upward in a quick run. Over the next half second he raises one arm straight up high, mitten hand open, like a director about to call action. Over the following second he keeps that arm up high, bouncing gently on the spot with eager anticipation, while the scrubber bar waits at the left edge. In the last half second he lowers the arm gently back to his side and the scrubber bar glides back right to its place just right of the middle, ending in exactly the same front-on pose he started in, so the last frame matches the first frame. His feet stay planted on the same spot for the whole shot, and he is moving in every part of the shot until that final pose.

The camera is locked off and completely static for the entire shot, framing his whole body with space above and around him, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A fast whirring rewind, a soft clicking rattle as the sprockets roll, a light cartoon whoosh as the arm goes up, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Video working

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot. The movie camera and the tripod are not in <Picture 1>; they come from this description alone.

The character is the small robot from <Picture 1>: a rounded mauve-brown body whose short neck goes straight into the plain mauve-brown top of his body with no collar, a dark clapperboard icon with orange stripes and an orange play triangle on his chest, a thin timeline bar with a small orange marker across his belly, orange trim down the outer edges of his body, short stubby arms with round mitten hands and short stubby legs with orange soles. His head is a thick mauve-brown block shaped like a single frame of film, with a dark play triangle in the middle of its front face, a column of square dark sprocket holes running down each side of the front, and an upright orange scrubber bar with round ends that crosses the frame and sticks out above and below it.

The shot begins with him standing on the right side of the frame beside an old-fashioned hand-cranked movie camera on a wooden tripod on the left side of the frame, his whole body and the whole tripod in view, filling most of the frame. The movie camera is a plain dark brown box with two round film reels on top and a small crank handle on the side facing him, and its lens points off towards the left edge of the picture. His body is turned about 45 degrees towards the left edge of the picture like the three-quarter view on the right of <Picture 1>, so he stands behind the camera looking the same way it points. One mitten hand holds the crank handle at the top of its circle, his other arm rests at his side, and the orange scrubber bar on his head sits at the left edge of the front of his head. He is hard at work filming. For the first two and a half seconds he turns the crank in steady full circles, one full turn every half second, five full turns in all, and in time with it the two film reels spin round, the square sprocket holes down the sides of his head roll downward like film running through, and the orange scrubber bar creeps slowly right across the front of his head like a progress bar until it reaches the right edge. In the last half second he gives the crank one more full turn back to the top of its circle while the scrubber bar snaps back to the left edge of his head, ending in exactly the pose he started in, so the last frame matches the first frame. His feet and the tripod stay planted on the same spot for the whole shot, and he is moving in every part of the shot.

The camera is locked off and completely static for the entire shot, framing his whole body and the tripod so they fill most of the frame, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A steady rhythmic clicking whirr of the hand crank and the film reels, one small snap as the scrubber bar returns, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Studio working, reroll (whole desk in frame)

After `ref2v_007`: good and loops, but the desk runs out of frame (Fabio). Only the
set-up sentence and the camera line change: the desk is small, on four legs, whole in
view with light grey around it. The fix is worded positively, never "cut off".

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot. The stool, the desk and the keyboard are not in <Picture 1>; they come from this description alone.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

The shot begins with him sitting on a small round stool behind a small plain mauve-grey desk in the centre of the frame, facing the camera. The desk is small and narrow and stands on four short straight legs, and the whole desk is in view, from the feet of its legs on the floor up to its top, with clear light grey background on both sides of it and below it. His head, his antennas and his upper body show above the desk. On the desk sits a chunky plain keyboard with blank pale beige keys. He leans forward over it with both mitten hands on the keys, his pixel eyes looking down at them. He is hard at work. For the whole shot he types fast in a steady even rhythm, his two mitten hands tapping the keys alternately, left and right, and his two antennas bob gently in time with the taps. Below his pixel eyes, rows of short plain dark dashes scroll steadily up his pale beige screen and out of the top of it, like work flowing past. Halfway through, at one and a half seconds, he hits one wide key with a small bouncy flourish of one hand, then goes straight back to typing at the same fast rhythm. In the last moment he is leaning over the keyboard exactly as he started, both hands on the keys in the same places, so the last frame matches the first frame. The desk and the stool stay on the same spot for the whole shot, and he is moving in every part of the shot.

The camera is locked off and completely static for the entire shot, framing him and the whole desk inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Fast soft plastic keyboard clicking the whole time, one heavier clack on the wide key, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

### Audio working, reroll (whole table in frame)

After `ref2v_011`: same fault and the same two-sentence fix as Studio's reroll.

```text
A cute 2D cartoon mascot animation, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot. The DJ table, the turntable and the mixer are not in <Picture 1>; they come from this description alone.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a teal collar at the top of his chest, a round speaker grille of small dark dots on his chest, short stubby arms with round mitten hands and short stubby legs. His head is a deep rounded mauve-brown box like a small monitor, with a dark screen on its front face showing a round bright teal play button in the middle and a bright teal sound wave on either side of it, and he wears big headphones, a grey-green headband arching over the top of his head and a round teal ear cup on each side.

The shot begins with him standing in the centre of the frame behind a small plain mauve-grey DJ table, facing the camera. The table is small and narrow and stands on four short straight legs, and the whole table is in view, from the feet of its legs on the floor up to its top, with clear light grey background on both sides of it and below it. His head, his headphones and his upper body show above the table. On the left of the table sits a turntable with a plain black record with a plain teal centre, and on the right sits a small mixer with one upright slider. His mitten hand on the left side of the picture rests on the record, and his other mitten hand rests on the slider, which sits halfway up. He is hard at work mixing a track. For the whole shot he scratches the record with quick short back-and-forth strokes, four full back-and-forth strokes spread evenly across the shot, and at the same time his other hand pushes the slider up to the top and back down to halfway, twice, in time with the strokes. With every scratch the teal sound wave on his screen jumps up into tall spikes, and his head bobs down and up on the beat so his headphones bounce. In the last moment his hand is back on the record at the same spot, the slider is back at halfway and his head is up, exactly as he started, so the last frame matches the first frame. The table stays on the same spot for the whole shot, and he is moving in every part of the shot.

The camera is locked off and completely static for the entire shot, framing him and the whole DJ table inside the frame with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Quick rubbery record scratches, a soft sliding swish on the slider, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands, no flicker.
```

## Rolls

| Clip | Card | Seed | Time | Result |
|---|---|---|---|---|
| A Getting ready | `ref2v_002` | 2625577134 | 154s | **Fail (Fabio).** Rubbing the lens left the glass blurred and dirty, and a wave is the wrong beat: getting ready means readying the camera for a photo, not greeting. Design held, one robot, ends on the start pose. Floor bar kept as a hard dark line on every frame. |
| A2 Getting ready | `ref2v_004` | 3982056065 | 147s | **Good (Fabio).** The Vision getting ready clip. Replaces `ref2v_002`, which Fabio archived. |
| Vision working | `ref2v_005` | 3866783899 | 151s | **Good (Fabio).** Loops cleanly. |
| Studio getting ready | `ref2v_006` | 458403706 | 154s | **Good (Fabio).** Loops cleanly. |
| Studio working | `ref2v_007` | 1721092146 | 147s | **Loops, but the desk runs out of frame (Fabio).** Rerolled with the whole desk in view. |
| Prompt getting ready | `ref2v_008` | 850291663 | 147s | **Good (Fabio).** Loops cleanly. |
| Prompt working | `ref2v_009` | 486720909 | 150s | **Good (Fabio).** Loops cleanly. |
| Audio getting ready | `ref2v_010` | 2125952140 | 156s | **Good (Fabio).** Loops cleanly. |
| Audio working | `ref2v_011` | 2796665596 | 149s | **Loops, but the DJ table runs out of frame (Fabio).** Rerolled with the whole table in view. |
| Video getting ready | `ref2v_012` | 3112160405 | 145s | **Good (Fabio).** Loops cleanly. |
| Video working | `ref2v_013` | 110556620 | 148s | **Good (Fabio).** Loops cleanly. |
| Studio working, reroll | `ref2v_014` | 1240350963 | 150s | **Good (Fabio).** Whole desk in frame. Replaces `ref2v_007`, which he archived. |
| Audio working, reroll | `ref2v_015` | 849262111 | 143s | **Good (Fabio).** Whole table in frame. Replaces `ref2v_011`, which he archived. |
| B Waiting | `ref2v_003` | 531435089 | 148s | One robot in a mustard armchair, plain green book, no text. Lens peeks up over the book mid-clip. Clean grey under the chair legs: no bar, no shadow, because his feet never touch the floor, so this roll does not test the bar. Figure plus chair fill only ~40% of the frame. **Good (Fabio):** the reading works; it came out small, so he crops at the end. Archived by Fabio later the same day, once the new working clips landed. |

## Finding: the floor bar is copied as drawing, not read as a shadow

With the sheet as the only reference, H3 kept the front view's dark floor bar as a flat
hard line under the feet for all 73 frames. It did not soften it into a shadow.

Fabio's `ref2v_001` did come back with a soft grey ellipse under the feet, but its
second reference, `Vision-Waiting.png`, has a floor shadow drawn in, so the ellipse
most likely came from that picture rather than from the bar.

Either way the bar ends up in the clip, and a hard line under the feet survives
background removal. The bar has to come off the sheets, or be removed from the clip.
