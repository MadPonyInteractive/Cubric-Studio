# Studio connecting: the remote engine clip

> **Moved here from MadPony-Identity on 2026-09-20.** This is the record of HOW the clip was made - prompt, seed, what failed and why. To wire a clip, read `mascot-placement.md` and `mascot-gif-manifest.md` instead.

MPI-78, asked for by Fabio 2026-09-17. While Cubric Vision connects to a RunPod GPU, the landing hero crew leaves and
Studio alone tries to connect a cable, and never manages it. Wide 21:9 loops that fill the landing page's crew band; the
app cycles them with a transition between each, for as long as the connect takes.

## Round 2: loops (Fabio, 2026-09-17, current)

Round 1 below (walk-in from the frame edge) was dropped while it rolled. Fabio: make it **loop like the other clips**,
Studio **tries to connect and never does** (sparks, gets angry, throws the cable on the floor), and several loops that the
app cycles with a transition between them, as planned for Cubric Studio. Medium quality stays (21:9 medium is already
1536x640).

- **Route:** plain MiniMax H3 (`minimax-h3`, `i2v_ms`), the SAME frame as start and end, like `mascot-states.md`.
- **The frame:** `../../MadPony-Identity/production/cubric-mascots/plates/studio-connecting-plate.png` (1536x640, grey 202, `Studio-Idle.png` centred at 70% of the frame
  height, feet at 92%), then Klein 9B Edit adds the props around him. Fabio approves the frame before any loop rolls.
- 21:9, medium, turbo on, seed random, 8s (192 frames).

### Frame: Klein 9B Edit

`klein-9b`, `kleinEdit`, style None, `inputImage` = the plate. Output 1584x656.

- **Frame 1** (`edit_009`, the first prompt): Klein drew TWO cables, the laptop's running to Studio's feet and the
  tower's plugged into its socket with a loose plug beside him. **Fabio's pick (2026-09-17):** the cables are already
  in, so Studio just picks up the two leads and tries to join them. The agent read two cables as a fault and rerolled
  with the prompt below (one cable, empty socket); frames 2-4 are kept in the gallery but not used.
- **Frame 2** (`edit_010`): one cable, empty socket; the plug is a two-pin mains plug, not square.
- **Frame 3** (`edit_011`): one cable, empty socket, square plug on the ground right beside Studio.
- **Frame 4** (`edit_012`): the tower grew its own cable to the plug again, so two cables. Not usable.

Frame 1 prompt (the one in use):

```text
Add a small scene around the cartoon robot in Image 1, the kind of simple prop layout an animation studio draws for a short gag.

Keep the robot in the centre of Image 1 exactly as he is, at the same position, the same size and in the same pose, with the thin dark line under his feet.

On the left side of the picture, well clear of the robot, draw a small plain mauve-grey desk with a chunky open laptop on it, its screen dark. On the right side of the picture, well clear of the robot, draw a tall chunky computer tower, a little taller than the robot, dark plum with a pale beige front panel, a column of small round lights on its front, all of them dark, and one square socket on its front at the robot's chest height. The desk and the tower stand on the same ground level as the robot's feet.

A thick dark cable comes down from the laptop and runs along the ground to the right, in front of the robot's feet, ending in a chunky square plug that lies on the ground between the robot and the tower, not plugged into anything.

Everything is drawn in the same flat vector cartoon style as the robot, with the same thick dark outlines, flat muted colours and soft even lighting. The desk, the laptop, the tower and the cable all sit fully inside the picture with light grey space around them. The background is one flat, even light grey across the whole picture, with nothing else on it.
```

Frames 2-4 prompt (the reroll, not used):

```text
Add a small scene around the cartoon robot in Image 1, the kind of simple prop layout an animation studio draws for a short gag.

Keep the robot in the centre of Image 1 exactly as he is, at the same position, the same size and in the same pose. Do not redraw him: his head, his face, his antennas, the knobs on the sides of his head, his body, his arms and his legs stay exactly as they are in Image 1.

On the left side of the picture, well clear of the robot, draw a small plain mauve-grey desk with a chunky open laptop on it, its screen dark. On the right side of the picture, well clear of the robot, draw a tall chunky computer tower, a little taller than the robot, dark plum with a pale beige front panel, a column of small round lights on its front, all of them dark, and one empty square socket on its front at the robot's chest height, with nothing plugged into it. The desk and the tower stand on the same ground level as the robot's feet.

There is only one cable in the picture. It comes out of the side of the laptop, drops down beside the desk and runs along the ground to the right, passing in front of the robot's feet, and ends in a chunky square plug lying loose on the ground between the robot and the tower, a little in front of the tower. The tower has no cable of its own.

Everything is drawn in the same flat vector cartoon style as the robot, with the same thick dark outlines, flat muted colours and soft even lighting. The desk, the laptop, the tower and the cable all sit fully inside the picture with light grey space around them. The background is one flat, even light grey across the whole picture, with nothing else on it.
```

### Loop prompts (whole, as rolled)

`minimax-h3`, `i2v_ms`, `startFrame` = `endFrame` = **Frame 1 (`edit_009`), Fabio's pick**: the cables are already in, one
lead per computer, and he only has to pick up the two leads and try to join them. The laptop lead's end is hidden
behind his feet; the video model invents it. Same rules as `mascot-states.md`: timed beats that add up to 8s, the snap fix,
props stay in frame, both leads end exactly where they started. No "no flicker": sparks and lights flash.

#### Studio connecting sparks

```text
A cute 2D cartoon mascot animation in a wide cinematic frame, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera with his arms resting at his sides, a small desk with an open laptop on the left, and a tall computer tower on the right. The laptop's cable runs down to the ground and its end lies hidden right behind the robot's feet. The tower's cable is plugged into the front of the tower and runs along the ground to a chunky square plug lying on the ground just beside the robot, on the tower's side. Keep his design and every prop exactly as they are in that frame for the whole shot: their proportions, their colours and their thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

He is trying to join the two cables, and it never works. In the first second and a quarter he bends down, picks up the end of the laptop's cable from behind his feet in one mitten hand, a small square connector, and the tower's square plug in the other hand, and straightens up. Over the next second he holds them in front of his chest and pushes the plug into the connector, and a small burst of bright yellow cartoon sparks pops out between them, he jerks back, and his two antennas frizz into zigzags. Over the following second and a quarter his antennas spring straight again, he shakes his head and pushes the two ends together once more, harder, and a bigger burst of yellow sparks pops out and throws his arms apart. Over the next second and a quarter two slanted angry eyebrows appear above his pixel eyes, his mouth line turns into a jagged frown, and he stamps his feet, shaking both cable ends. Over the following second he throws both ends down onto the ground, and they bounce once and settle exactly where they lay at the start, the laptop's cable end behind his feet and the tower's plug on the ground beside him. In the last two and a quarter seconds he folds his arms with a grumpy huff and turns his head away, then the angry eyebrows fade, his face goes back to its plain pixel face, he turns his head back to the camera, unfolds his arms and lowers them to his sides. Both cables stay attached to their computers the whole time, and the desk, the laptop and the tower stay on the same spots. In the last moment everything is back in exactly the picture it started from, the robot standing in the centre facing the camera with his arms at his sides and both cables lying where they began, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, a wide shot framing the whole scene with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A light rustle as he picks up the cables, a short crackling zap and a springy boing as his antennas frizz, a bigger crackling zap, two angry little stamps, a plastic clatter as the cable ends hit the ground, a grumpy electronic huff, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

#### Studio connecting plug flip

```text
A cute 2D cartoon mascot animation in a wide cinematic frame, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera with his arms resting at his sides, a small desk with an open laptop on the left, and a tall computer tower on the right. The laptop's cable runs down to the ground and its end lies hidden right behind the robot's feet. The tower's cable is plugged into the front of the tower and runs along the ground to a chunky square plug lying on the ground just beside the robot, on the tower's side. Keep his design and every prop exactly as they are in that frame for the whole shot: their proportions, their colours and their thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

He is trying to join the two cables, and the plug never fits. In the first second and a quarter he bends down, picks up the end of the laptop's cable from behind his feet in one mitten hand, a small square connector, and the tower's square plug in the other hand, and straightens up. Over the next second he holds them in front of his chest and pushes the plug at the connector, but it does not fit and bumps back off. Over the following second he turns the plug upside down and pushes again, and it bumps back off again. Over the next second he turns the plug on its side and pushes a third time, it bumps back off, and one tiny yellow spark fizzles out. Over the following second and a quarter little puffs of white steam shoot up out of the tips of his two antennas, two slanted angry eyebrows appear above his pixel eyes, and he shakes both cable ends hard. Over the next second he flings both ends down onto the ground, and they bounce once and settle exactly where they lay at the start, the laptop's cable end behind his feet and the tower's plug on the ground beside him. In the last second and a half he takes one big calming breath, his shoulders rising and falling, the steam stops, the angry eyebrows fade, his face goes back to its plain pixel face, and he lowers his arms to his sides. Both cables stay attached to their computers the whole time, and the desk, the laptop and the tower stay on the same spots. In the last moment everything is back in exactly the picture it started from, the robot standing in the centre facing the camera with his arms at his sides and both cables lying where they began, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, a wide shot framing the whole scene with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A light rustle as he picks up the cables, three dull plastic bonks as the plug bumps off, one tiny electric fizz, two sharp kettle-like whistles of steam, a plastic clatter as the cable ends hit the ground, a long calming hiss, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

#### Studio connecting spit out

```text
A cute 2D cartoon mascot animation in a wide cinematic frame, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given and ends on that same picture: the small robot standing in the centre of the frame facing the camera with his arms resting at his sides, a small desk with an open laptop on the left, and a tall computer tower on the right. The laptop's cable runs down to the ground and its end lies hidden right behind the robot's feet. The tower's cable is plugged into the front of the tower and runs along the ground to a chunky square plug lying on the ground just beside the robot, on the tower's side. Keep his design and every prop exactly as they are in that frame for the whole shot: their proportions, their colours and their thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

He is trying to join the two cables, and the connection refuses to hold. In the first second and a quarter he bends down, picks up the end of the laptop's cable from behind his feet in one mitten hand, a small square connector, and the tower's square plug in the other hand, and straightens up. Over the next second he holds them in front of his chest and pushes the plug into the connector, and it clicks in. Over the following second the small round lights on the front of the tower switch on one at a time from the bottom up, and he gives a happy little hop, still holding the joined cables. Over the next second all the tower's lights switch off at once, and the plug pops back out of the connector with a bang: it flies up in a small arc, bonks him on the top of his head between his antennas, and drops back into his hand. Over the following second and a quarter his pixel eyes turn into two small crosses for a moment, then two slanted angry eyebrows appear above them, his mouth line turns into a jagged frown, and he shakes the plug at the tower. Over the next second he throws both ends down onto the ground, and they bounce once and settle exactly where they lay at the start, the laptop's cable end behind his feet and the tower's plug on the ground beside him. In the last second and a half he stamps one foot, the angry eyebrows fade, his face goes back to its plain pixel face, and he lowers his arms to his sides. Both cables stay attached to their computers the whole time, and the desk, the laptop and the tower stay on the same spots. In the last moment everything is back in exactly the picture it started from, the robot standing in the centre facing the camera with his arms at his sides, the tower's lights as they were at the start and both cables lying where they began, so the last frame matches the first frame. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, a wide shot framing the whole scene with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A light rustle as he picks up the cables, a satisfying click, rising electronic blips as the lights switch on, a cheerful little hop, a sudden power-down blip and a loud cartoon pop, a hollow bonk on his head, a short dizzy warble, a plastic clatter as the cable ends hit the ground, one heavy stamp, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

#### Studio connecting laptop

Added 2026-09-17 after Fabio found plug flip too close to sparks: a loop where he tries to work out what is wrong on
the computer instead of with the cables. `startFrame` only.

```text
A cute 2D cartoon mascot animation in a wide cinematic frame, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given: the small robot standing in the centre of the frame facing the camera with his arms resting at his sides, a small desk with an open laptop on the left, and a tall computer tower on the right. The laptop's cable runs down to the ground and its end lies hidden right behind the robot's feet. The tower's cable is plugged into the front of the tower and runs along the ground to a chunky square plug lying on the ground just beside the robot, on the tower's side. Keep his design and every prop exactly as they are in that frame for the whole shot: their proportions, their colours and their thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

He is trying to work out what is wrong with the laptop, and he never fixes it. In the first second and a quarter he turns and walks over to the desk and stands in front of the laptop. Over the next second he types on the laptop's keyboard with both mitten hands, and the laptop's screen lights up pale with a small spinning circle in its middle. Over the following second the spinning circle is replaced by a big red cross symbol, and he leans in close, his pixel eyes narrowing. Over the next second and a quarter he types faster and faster, jabs one key three times, and taps the side of the laptop's screen twice with one mitten hand, and the red cross blinks. Over the following second the laptop's screen goes dark again, and his two antennas droop. Over the next second and a quarter he scratches the top of his head with one mitten hand, puzzled, then turns and walks back to the centre of the frame. In the last second and a quarter he turns to face the camera, gives a small helpless shrug, and lowers his arms to his sides, standing in the same pose and on the same spot as at the start, his antennas straight again. Both cables stay lying where they are the whole time, and the desk, the laptop and the tower stay on the same spots. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, a wide shot framing the whole scene with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft padding footsteps, soft plastic keyboard clicking that speeds up, a small whirring hum as the laptop screen lights up, a flat error buzz, three sharp key jabs, two hollow taps on the screen, a sad little power-down blip, a puzzled electronic warble, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

#### Studio connecting screwdriver

Added with `laptop`: he opens the tower up and it blows sparks and smoke in his face. `startFrame` only.

```text
A cute 2D cartoon mascot animation in a wide cinematic frame, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given: the small robot standing in the centre of the frame facing the camera with his arms resting at his sides, a small desk with an open laptop on the left, and a tall computer tower on the right. The laptop's cable runs down to the ground and its end lies hidden right behind the robot's feet. The tower's cable is plugged into the front of the tower and runs along the ground to a chunky square plug lying on the ground just beside the robot, on the tower's side. Keep his design and every prop exactly as they are in that frame for the whole shot: their proportions, their colours and their thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

He is trying to fix the tower himself, and it goes wrong. In the first second and a quarter he reaches behind his back, brings out a small screwdriver with a yellow handle, and walks over to the tower. Over the next second and a quarter he twists the screwdriver in a screw on the tower's pale beige front panel, and the upper half of the front panel swings open like a small door, showing a tangle of coloured wires and little circuit boards inside. Over the following second he leans in and pokes the screwdriver into the wires. Over the next second a burst of bright yellow cartoon sparks and a round puff of dark grey smoke blast out of the tower straight into his face, and he jerks back. Over the following second and a quarter the smoke clears and his pale beige screen is covered in dark sooty smudges, his pixel eyes blinking through the soot, his two antennas bent and trailing thin wisps of smoke, and he coughs out one small puff of smoke. Over the next second the tower's panel swings shut by itself with a clunk, and he wipes the soot off his screen with one mitten hand, leaving his face clean, and his antennas spring straight again. In the last second and a quarter he tucks the screwdriver behind his back, where it disappears out of sight behind his body, walks back to the centre of the frame and turns to face the camera, lowering his arms to his sides, standing in the same pose and on the same spot as at the start. The screwdriver only ever appears in front of his body or disappears behind his back. Both cables stay lying where they are the whole time, and the desk, the laptop and the tower stay on the same spots. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame from the first to the last.

The camera is locked off and completely static for the entire shot, a wide shot framing the whole scene with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A small metal clink as the screwdriver comes out, soft padding footsteps, a squeaky screw turning, a creaking little hinge, soft electronic humming from inside the tower, a sharp crackling zap and a muffled poof of smoke, one tiny robotic cough, a metal clunk as the panel shuts, a quick squeaky wipe, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

#### Studio connected

The success clip (Fabio, 2026-09-17), not a loop: on the app's connect-success event a transition plays at once, this
clip swaps in under it and **plays once**, then a transition brings the crew back. **5s** (`Input_Duration` 5, 124
frames), `startFrame` only; it ends connected, so it does not return to the frame.

```text
A cute 2D cartoon mascot animation in a wide cinematic frame, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

The shot starts on the first frame it is given: the small robot standing in the centre of the frame facing the camera with his arms resting at his sides, a small desk with an open laptop on the left, and a tall computer tower on the right. The laptop's cable runs down to the ground and its end lies hidden right behind the robot's feet. The tower's cable is plugged into the front of the tower and runs along the ground to a chunky square plug lying on the ground just beside the robot, on the tower's side. Keep his design and every prop exactly as they are in that frame for the whole shot: their proportions, their colours and their thick outline style. There is only one robot in the shot.

The character is a small robot: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

This time the connection works, and he is overjoyed. In the first second he bends down, picks up the end of the laptop's cable from behind his feet in one mitten hand, a small square connector, and the tower's square plug in the other hand, and straightens up. Over the next three quarters of a second he pushes the plug into the connector, it clicks in, and a small bright flash of light pops at the join. Over the following second the laptop's dark screen lights up bright with a big green tick symbol, the small round lights on the front of the tower switch on one after another from the bottom to the top and glow a bright soft green, and his pixel eyes turn into two happy upturned arcs with a wide smile below them. Over the next second and a half he lets the joined cable drop gently to the ground, throws both arms up and does two big bouncy hops and a quick happy spin on the spot, his two antennas wiggling. In the last three quarters of a second he lands facing the camera with both arms raised high in triumph and holds that pose, beaming, while the laptop's tick and the tower's green lights stay lit. The joined cable stays lying on the ground between the desk and the tower, and the desk, the laptop and the tower stay on the same spots. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame until that final pose.

The camera is locked off and completely static for the entire shot, a wide shot framing the whole scene with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: A light rustle as he picks up the cables, a crisp satisfying click, a bright rising start-up chime from the laptop, quick cheerful electronic blips climbing up as the tower lights switch on, two bouncy boings, a playful whoosh on the spin, a happy little fanfare of beeps, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

### Loop rolls

**Rerolls get the start frame only** (Fabio, 2026-09-17): first-and-last-frame models do worse with both frames set, and
the transitions between loops hide the seam anyway. The three below were rolled with both frames.

Measured on the saved file: **peak** = largest mean difference from frame 0, **loop** = last frame against frame 0,
**end step** = largest frame-to-frame step in the last 12 frames (a snap would stand far above the median step, 0.8 on
`i2v_072`). All passed the sidecar checks (`minimax-h3` `i2v_ms`, 1536x640 21:9, turbo, 8s, both frames, not
preview-only, named) and are 192 frames.

| Clip | File | Seed | Time | Peak | Loop | End step | Notes |
|---|---|---|---|---|---|---|---|
| Studio connecting sparks | `i2v_072` | 3615934314 | 460s | 17.5 | 2.4 | 1.5 (f180) | Looks good (Fabio). No snap in the saved file; the live preview showed one |
| Studio connecting plug flip | `i2v_073` | 2232850072 | 449s | 14.1 | 3.5 | 0.1 (f186) | **Failed, archived** (Fabio): morphing in one stretch, and too close to sparks. Passed every numeric check, which cannot see morphing |
| Studio connecting spit out | `i2v_074` | 1831658394 | 455s | 16.7 | 2.7 | 0.3 (f186) | Awaiting Fabio's review |
| Studio connecting laptop | `i2v_075` | 1182580200 | 431s | 22.3 | 1.1 | 0.9 (f180) | Start frame only. Awaiting Fabio's review |
| Studio connecting screwdriver | `i2v_076` | 848334324 | 426s | 32.4 | 1.0 | **9.3 (f179)** | Start frame only, and still **snaps**: at f179 he is still walking back, half-turned, right of centre; at f180 he is in the centre facing the camera, a morph over about two frames. The last 12 frames (0.5s) hold the start pose. **Kept as is (Fabio):** the agent box sits right over that spot on the landing, so the snap does not show |
| Studio connected | `i2v_077` | 231437215 | 268s | 16.9 | 11.0 | 0.2 (f118) | 5s, 124 frames, start frame only. Plays once, so a high loop figure is expected: it ends connected, arms up. Awaiting Fabio's review |

Plug flip archived 2026-09-17 with the idle-queue recipe (`update-project` + `open-project`), guarded by a GPU-memory
check because `updatedAt` does not change while a generation runs.

### Round 3: the same five at 1920x768 (2026-09-20)

Fabio, 2026-09-20: the 1536x640 rolls morph in places and do not look good enough. Re-rolled at what he calls **1K**,
which on H3 is the **`very_high` tier, 1920x768** at 21:9 — H3 has no `1k` tier, and the same word was misread as `high`
in the Vision repo the same day.

- Same five prompts, **verbatim** from § Loop prompts above. Nothing retyped or spliced.
- `minimax-h3`, `i2v_ms`, 21:9, `very_high`, turbo on, seed random, 8s loops and 5s for connected.
- **Start frame only on all five**, including sparks and spit out, which round 2 rolled with both frames. The
  2026-09-17 rule applies to every clip the app joins with a transition, and both frames is a quality cost — which is
  the complaint being fixed.
- Start frame is still `edit_009`, Fabio's pick, staged as-is; H3 scales it from 1584x656.

**These are fresh samples, not the old clips sharpened.** A canvas change is a different latent shape, so even a pinned
seed would render a different take (`js/utils/ratios.js`). Seeds were left random. The morphing can move rather than
shrink, and no numeric check can see it either way — the review is Fabio's, in the app.

| Clip | File | Card | Seed | Time | Peak | Loop | End step | Notes |
|---|---|---|---|---|---|---|---|---|
| Studio connecting sparks | `i2v_078` | Studio connecting sparks 1K | 1127038615 | 772s | 16.7 | 2.8 | 0.7 (f179) | Cleanest of the five on the numbers; better end step than `i2v_072`'s 1.5 |
| Studio connecting spit out | `i2v_079` | Studio connecting spit out 1K | 198261966 | 760s | 15.3 | 2.5 | **4.1 (f179)** | A step `i2v_074` did not have (0.3), well above its own 0.2 median |
| Studio connecting laptop | `i2v_080` | Studio connecting laptop 1K | 4112202810 | 743s | 24.1 | 3.5 | **4.0 (f182)** | A step `i2v_075` did not have (0.9), against a 0.1 median |
| Studio connecting screwdriver | `i2v_081` | Studio connecting screwdriver 1K | 2804442176 | 753s | 32.8 | 1.6 | **8.6 (f179)** | Still snaps, at the same f179 as `i2v_076` (9.3). The agent box covers that spot |
| Studio connected | `i2v_082` | Studio connected 1K | 515523245 | 427s | 19.4 | 11.1 | 0.2 (f118) | 5.167s, 124 frames. Plays once, so the loop figure is expected to be high |

All five are 1920x768 at 24 fps, 192 frames (8.000s) and 124 frames (5.167s) for connected, matching round 2's counts.
53.8 minutes of GPU in total.

**Fabio's verdict, 2026-09-20: only screwdriver `i2v_081` survived.** The other four either morphed more than the
1536x640 originals or animated less well, and he archived them (`i2v_078`, `i2v_079`, `i2v_080`, `i2v_082`). The
shipping set is therefore mixed: sparks `i2v_072`, spit out `i2v_074`, laptop `i2v_075` and connected `i2v_077` at
1536x640, screwdriver `i2v_081` at 1920x768. `i2v_076` was archived as the superseded screwdriver.

So a bigger canvas is not a reliable fix for H3 morphing on these loops — it resampled four of five into something
worse. Worth remembering before spending an hour of GPU on the same move again.

Peak, loop and end step are measured exactly as round 2's table defines them; the script was **checked by reproducing
all six of round 2's published numbers** before it was trusted on these, which is what caught the end-step window
being the last 13 frames, not 12.

Plug flip was not re-rolled: it was archived for sitting too close to sparks as well as for morphing, and a bigger
canvas does not fix the first.

Rolled from an isolated app instance (`npm run app:isolated`) so Fabio could keep restarting his own. That instance
**owns the engine**, which matters: `routes/shared.js` kills ComfyUI when the owning app exits, so had his app owned it,
every restart would have killed a run mid-clip.

## Round 1: walk-in (dropped 2026-09-17)

### Settings

- **MiniMax H3 Reference** (`minimax-h3-ref2va`, `ref2v_ms`): Studio starts out of frame, so there is no start picture.
  `inputImage` (`<Picture 1>`) = the Studio sheet `Media/edit_003.png`, staged with `place-preview-asset`.
- **21:9, quality medium (1536x640)**, turbo on, seed random, **8s** (`Input_Duration` 8, 192 frames; 8s is the
  shortest whole second on H3's 17k+5 grid). Local engine (RTX 4060 Ti); the RunPod pod that was up (RTX 2000 Ada,
  31 GB RAM) cannot run H3.
- Flat light grey background like every other clip, so SAM3 can cut out Studio, the props and the cable together.
- No "no flicker" in the constraint line: lights blink in all three.

### Prompts (whole, as queued)

#### Studio connecting plug flip

Enters from the left. The cable runs from a computer tower; the socket is in Studio's own head.

```text
A cute 2D cartoon mascot animation in a wide cinematic frame, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot. The computer tower and the cable are not in <Picture 1>; they come from this description alone.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head with a small socket in its middle.

The shot opens on the scene with no robot in it. Standing at about two thirds of the way across the frame is a tall chunky computer tower, a little taller than the robot, dark plum with a pale beige front panel and a column of small round lights on its front, all of them dark. A thick dark cable comes out of the side of the tower and lies along the ground to the left, ending in a chunky plug that lies on the ground in the centre of the frame. The tower stays on the same spot for the whole shot. In the first second and a half the robot walks in from the left edge of the frame with small bouncy steps and stops in the centre of the frame beside the plug, facing the camera, about half as tall as the frame. Over the next second he bends down, picks the plug up in both mitten hands and straightens up, looking at it. Over the following second he lifts the plug to the round knob on the side of his head and pushes it in, but it does not fit and bumps back out, and his two antennas wobble. Over the next second he turns the plug upside down and pushes again, and again it bumps back out. Over the following second he turns the plug back the way it was, pushes once more, and this time it clicks into the knob on the side of his head with a small springy bounce. In the last two and a half seconds his pixel face is replaced by three small dark dots in a row that light up one after another, again and again, like something loading, the round lights on the front of the tower blink on and off one after another, and he taps one foot, waiting, with the cable running from the side of his head to the tower. He has not finished connecting when the shot ends. The robot, the tower and the cable stay fully inside the frame with light grey space around them once he has walked in. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame.

The camera is locked off and completely static for the entire shot, a wide shot framing the whole scene with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft padding footsteps, a light rustle as he picks up the cable, two dull plastic bonks as the plug bumps back out, a small satisfying click as it goes in, soft ticking electronic blips as the dots and the lights blink, a soft tapping foot, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

#### Studio connecting too short

Enters from the right. Two computers, two cables that cannot meet, and Studio becomes the link.

```text
A cute 2D cartoon mascot animation in a wide cinematic frame, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot. The laptop, the desk, the computer tower and the cables are not in <Picture 1>; they come from this description alone.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

The shot opens on the scene with no robot in it. On the left side of the frame stands a small plain mauve-grey desk with a chunky open laptop on it, its screen dark. On the right side of the frame stands a tall chunky computer tower, a little taller than the robot, dark plum with a pale beige front panel and a column of small round lights on its front, all of them dark. A short thick dark cable comes down from the laptop and lies on the ground pointing right, and another short thick dark cable comes out of the tower and lies on the ground pointing left. Each ends in a chunky plug, and the two plugs lie on the ground in the middle of the frame with a wide gap between them, too far apart to meet. The desk, the laptop and the tower stay on the same spots for the whole shot. In the first second and a half the robot walks in from the right edge of the frame with small bouncy steps, passes in front of the tower and stops in the centre of the frame between the two plugs, facing the camera, about half as tall as the frame. Over the next second he bends down, picks up one plug in each mitten hand and straightens up. Over the following second and a half he pulls the two plugs towards each other in front of his chest, both cables stretch tight, and the plugs stop a hand's width apart and will not meet however hard he pulls, his antennas quivering with the effort. Over the next second he lets the cables go slack and looks at one plug, then the other, then blinks his pixel eyes once as he gets an idea. Over the following second he spreads both arms out wide, the plug from the laptop in the hand nearer the laptop and the plug from the tower in the hand nearer the tower, and stands between them as the link that joins them. In the last two seconds a thin dark bar slowly fills from left to right across the bottom of his screen under his pixel face, like a loading bar, the laptop's screen lights up pale, the round lights on the tower blink on and off one after another, and he bounces gently on his toes with his arms still spread wide, proud of himself. The loading bar is only half full when the shot ends. The robot, the desk, the laptop, the tower and the cables stay fully inside the frame with light grey space around them once he has walked in. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame.

The camera is locked off and completely static for the entire shot, a wide shot framing the whole scene with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft padding footsteps, a light rustle as he picks up the cables, a tight rubbery creak as the cables stretch, a small straining hum, a tiny bright ding as he gets the idea, a soft rising electronic tone as the bar fills, soft ticking blips as the tower lights blink, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

#### Studio connecting wrong port

Enters from the left. A server cabinet with three different sockets; the third one fits.

```text
A cute 2D cartoon mascot animation in a wide cinematic frame, flat vector illustration style with thick dark outlines and flat muted colours, a plain flat light grey background, bright even front lighting like a sticker, snappy bouncy cartoon timing, one continuous shot.

Use <Picture 1> as the whole character: his body, his head, his proportions, his colours and his outline style. <Picture 1> is a turnaround sheet that shows this same one robot twice, from the front on the left and from a three-quarter angle on the right, so it tells you how deep his head and body are. Take only the character design from it, not its side-by-side layout, its framing or its background. There is only one robot in the shot. The laptop, the server cabinet and the cable are not in <Picture 1>; they come from this description alone.

The character is the small robot from <Picture 1>: a rounded mauve-brown body with a pale beige collar plate at the top of his chest, a dark hexagonal C logo on his chest, small bolted panels on his sides, short stubby arms with round mitten hands and short stubby legs. His head sits on a short neck and is a rounded mauve-brown box like a small old computer monitor, with a flat pale beige screen on its front face showing a simple pixel face of two small dark upright rectangle eyes and a short flat dark line for a mouth, two thin antennas sticking straight up from the top, and a round knob on each side of the head.

The shot opens on the scene with no robot in it. Near the left side of the frame a chunky open laptop sits on the ground, its screen dark. Across the right half of the frame stands a wide server cabinet, a little taller than the robot, dark plum with a pale beige front, with a row of small round lights along its top edge, all of them dark, and three different sockets in a row across its front at the robot's chest height: a round socket on the left, a narrow slot in the middle and a square socket on the right. A thick dark cable comes out of the laptop and lies along the ground to the right, ending in a chunky square plug that lies on the ground in the centre of the frame. The laptop and the cabinet stay on the same spots for the whole shot. In the first second and a half the robot walks in from the left edge of the frame with small bouncy steps, passes in front of the laptop and stops beside the plug, about half as tall as the frame. Over the next second he picks the plug up in both mitten hands and takes two small steps to the front of the cabinet. Over the following second and a half he pushes the plug into the round socket, a small bright spark pops, his two antennas frizz into zigzags and spring straight again, and he shakes his hand. Over the next second and a half he pushes the plug at the narrow slot, it is far too big and bumps against it twice, and he tilts his head, puzzled. Over the following second he pushes the plug into the square socket, and it slides in snugly with a click. In the last one and a half seconds he takes one small step back to watch, and the round lights along the top of the cabinet switch on one at a time from left to right, while he gives a small hopeful bounce. Only half of the lights are on when the shot ends. The robot, the laptop, the cabinet and the cable stay fully inside the frame with light grey space around them once he has walked in. It is one single continuous take with no cut, no jump and no snap, and he is moving in every single frame.

The camera is locked off and completely static for the entire shot, a wide shot framing the whole scene with a clear margin of light grey background on every side, and it does not move, pan, tilt, push in or pull out at any point.

overall_soundscape: Soft padding footsteps, a light rustle as he picks up the plug, a short crackling zap and a springy boing as his antennas frizz, two dull plastic bonks on the slot, a small satisfying click, soft rising electronic blips as each light switches on, and no speech of any kind.

non_diegetic_music: N/A

No text, no subtitles, no watermarks, no photorealistic or 3D rendering, no soft dissolves, no warped hands.
```

### Rolls

| Clip | File | Seed | Time | Frames | Size | Notes |
|---|---|---|---|---|---|---|
