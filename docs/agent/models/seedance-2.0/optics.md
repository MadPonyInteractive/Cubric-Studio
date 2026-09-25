# Seedance 2.0: lens, shot size and camera

Read this when the look of the shot matters: a portrait, a wide place, a long-lens feel, a camera move, handheld, or a lens the user named. It feeds the **Camera** part of the prompt.

## Shot size and lens are two different things

The **shot size** says how much of the subject fills the frame: wide, medium, close-up. The **lens** says how the space behaves: whether the background swells or compresses, whether the foreground looms. The same close-up can be made from a metre away on a wide lens or from seven metres away on a long one, and they look nothing alike. Write both.

Seedance follows the lens best when it is given as a **diagonal field of view in degrees**, with the camera's distance and what the viewer sees. It follows millimetres, f-stops, ISO and lens brand names poorly: never use them as the control.

## The working angles

| Degrees | Camera distance | What it looks like | Good for |
|---|---|---|---|
| 107 | under a metre from the foreground | the foreground looms, the surroundings spread to every edge, lines stay straight (no fisheye) | a subject inside a big space, immersion |
| 84 | about a metre | expanded perspective, surroundings visible to the edges, the body near camera feels large | action in an environment, an intimate close shot that keeps the room |
| 47 | 3 to 5 metres | natural proportions, background readable, like a human eye | everyday action, documentary, a neutral default |
| 29 | 4 to 6 metres | flattering faces, the background starts to compress and soften | a portrait, a medium close-up |
| 18 | 6 to 8 metres | strong compression, thin focus on the eyes, a feeling of being watched | a tight emotional close-up |
| 8 | 20 metres or more | the background flattened into a soft wash; blurred shapes in the foreground framing the subject | observation from afar: wildlife, surveillance, sport |

Write it as one phrase: `29-degree field of view, camera about 5 metres away, background compressed into soft shapes`.

## A lens the user named

Convert millimetres to the full-frame diagonal and write the degrees:

| mm | degrees |
|---|---|
| 16 | 107 |
| 24 | 84 |
| 35 | 63 |
| 50 | 47 |
| 85 | 29 |
| 135 | 18 |
| 300 | 8 |

Keep a lens type the user named (anamorphic, macro) as a visible outcome: `anamorphic look, oval highlights, horizontal flares`. "Shot on 35mm film" is a film stock, not a lens; it belongs in the style part.

## Choose the lens by the content

- The shot is about a **face**: 29 or 18. Use 84 only when the face should sit inside its room.
- The shot is about a **place or a body in motion**: 47, 84 or 107.
- The shot is about a **small detail**: a close-up at 29 or 18, as its own shot.
- The shot is someone **watched from far away**: 8, with foreground occlusion.

Do not ask one shot to be a face portrait, a wide geography and a macro detail at once: the lens drifts to a muddy middle. Give each its own shot (see `guide:seedance-2.0/shots-and-cuts`), each with its own lens.

When a lens has to hold, back it with its visible outcomes rather than repeating the number: a long lens gets `only the subject sharp, background dissolved into soft colour, close framing from far away`; a wide lens gets `the surroundings reaching every edge of the frame, everything in focus, the camera close`.

## The camera as a person operating it

Write what the operator does: the height (`lens at hip height`, `camera at ground level`), the side (`camera on the shadow side of him`), the distance, and at most **one movement per shot**.

Movements Seedance knows by name: fixed camera, slow push-in, slow pull-back, pan, tilt, smooth lateral tracking, follow at walking pace, crane up, orbit. One of them. `Slow push-in while orbiting` asks for two and the image wobbles.

**Handheld** is a person holding the camera, not a shake effect: `handheld, the operator breathing, small settling corrections, weight shifting with each step`. Without that, "handheld" tends to become digital jitter.

## Never write

- "extreme wide-angle", "ultra wide", "super wide": give degrees.
- "wide shot" or "establishing shot" as if it were the lens: it is a shot size.
- "zoom out" together with a wide lens, or "tight wide framing": contradictions.
- Two camera moves in one shot.
- A lens change in the middle of a shot. A new lens starts with a new shot, at a hard cut.

## In i2v

The first frame already has a lens. Keep it: `lens unchanged from the first frame`. Only when the user asks for a different look does a new angle go in, in degrees, usually after a cut.
