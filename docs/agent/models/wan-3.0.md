# Wan 3.0: how to prompt it

Wan 3.0 ships as one Vision card, `wan3-cloud`. It is a **cloud** card: no weights, no ComfyUI graph, no engine. It runs at DeepInfra on the user's own API key, and "installed" means a key is saved. The cost of a run is on the estimate card; show the user that before a run, never a figure from memory.

Three ops: `t2v`, `i2v` and `ref2v`. The model makes picture and sound together: speech, sound effects and music come out of the same prompt.

**It is not Wan 2.2.** Wan 2.2 wants one short block of cinematic prose in a fixed six-part order. Wan 3.0 reads a prompt more like a short script: an overall line, the references and what each one is for, the action shot by shot when there are several shots, then dialogue, sound, style, and a short list of what must not appear. Never write a Wan 3.0 prompt from the Wan 2.2 guide.

## Pick it when

- The user asks for Wan 3.0 by name, or for a cloud video model with sound.
- The clip needs spoken lines with lip sync, a voiceover, or music written into the prompt.
- The clip is longer than the local models make comfortably: up to 30 seconds, with several planned shots inside it.
- The user hands over references (people, places, a clip whose motion they want, a voice) and wants a new clip that keeps them consistent: `ref2v`.

## What the app sends, and what it sets

- Ratios `1:1`, `3:4`, `4:3`, `9:16`, `16:9`; quality tiers `480p`, `720p`, `1080p`; a duration in seconds. **The app sets all three. Never write a duration, a ratio, a resolution or a frame rate into the prompt.**
- One clip per call: no batch.
- **No negative prompt field.** What must not appear goes in a short list at the end of the prompt (below).
- `i2v` sends a first frame, and an optional last frame (the `endFrame` slot). No references go with it.
- `ref2v` sends references, not frames: up to 9 images, 3 videos and 3 audio clips. A reference video adds its own seconds to the bill, so the estimate can read "up to".
- The provider rewrites and expands the prompt before the model sees it. A complete prompt in the shape below still steers it best.

## The prompt shape

Plain sentences, in this order. Leave out any part the request does not need.

1. **Overall line.** One sentence: what this clip is, its theme and its point of view ("A quiet morning in a mountain bakery, seen through the baker's day.").
2. **References** (`ref2v` only). One short line per staged reference, saying what it is for (below).
3. **The action.** Who, where, doing what, with the motion already under way. One continuous take unless cuts are wanted (see Shots and timing). Each beat: subject, scene, motion, and the camera.
4. **Dialogue.** `The baker says: "We open in five minutes."` Only lines the user gave, or a character the user wants speaking.
5. **Sound and music.** Effects tied to what is on screen; music only as the user wants it.
6. **Style and mood.** One compact anchor: the look, the light, the feeling.
7. **What must not appear.** Only when the user excluded something: `Negative prompt list: no subtitles, no watermark.`

Describe change over time, not a still picture. "A woman stands by a window" is a photograph; "a woman stands by a window, turns, and walks out of frame" is a clip.

## Shots and timing

One take is the default. Use shots when the user asks for cuts, or when the story has beats one camera position cannot hold. Then:

```text
Shot 1 [0-4s]: ...
Shot 2 [4-8s]: ...
```

- Shots join end to end, with no gaps and no overlaps, and together they fill the clip's length. Two to five seconds per shot works best.
- Name the transition when it matters: "hard cut", "dissolve", or "continue seamlessly from the last frame of the previous shot".
- Keep each person's position, clothing and size the same across shots unless the story changes them. A character who jumps place between shots is the commonest broken cut.
- Ask the user, or read the duration on the card, before you time shots; never change the duration yourself.

## Sound

- Speech: `Name says: "line"`, or `Name whispers: "line"`. Several speakers: one line each, every speaker named. Add `Lip sync.` after a line when the mouth must match. A voice with no one on screen: `Voiceover: "line"`.
- Never invent dialogue. If the user wants no speech, write `No dialogue.`
- Sound effects come from what is clearly described (rain on a tin roof, boots in a puddle). Write a standalone effect when it has to land on a moment: "a glass shatters on the tiled floor".
- Music has three settings: say nothing and the model picks; describe it ("a soft cello enters under the last shot"); or switch it off (`No background music.`). Leave it open unless the user cares.
- Describe a voice in words (age, pace, accent) when it matters. Only `ref2v` can be handed a voice sample ("speaks in the voice of Audio 1").

## Camera

- Plain verbs, one move per shot: push in, pull out, orbit, handheld follow, whip pan, dolly, crane. State the speed ("the camera slowly pushes in").
- A locked camera is said outright: "fixed shot, the camera does not move".
- Shot size and angle in plain words: wide, medium, close-up, low angle, high angle. A lens may be named in millimetres ("85mm telephoto, shallow depth of field").
- Two moves in one shot ("dolly in and pan left") give erratic motion: split them across shots.

## What must not appear

The model reads a short trailing list of what to avoid. Write only what the user excluded or what this clip is likely to get wrong, never a padded list, and never repeat something the prompt already states. Typical entries: no subtitles, no watermark, no extra people, no costume changes, no background music, no large camera movements.

## t2v

The text carries everything, so write who is in the opening moment, where, and doing what. A subject who wanders in late wastes the clip's first seconds.

## i2v

The first frame is the picture the user gave. It already fixes the faces, clothes, colours, set and opening framing. Write **only what happens from it**: the motion, the camera, the dialogue, the sound. Name the subject as the user did ("the woman in the frame"); re-describing the picture pulls the clip away from it.

With a last frame too, write how the clip gets from one picture to the other: the transition and the action between them, never a description of either picture.

## ref2v

- Cite each reference by type and number, counted per type in the order they were staged: `Image 1`, `Image 2`, `Video 1`, `Audio 1`. The prompt box's `@` picker writes them in angle brackets (`<Image 1>`); either form names the same reference. Keep the form the user wrote, and never cite a tag that was not staged.
- Give every reference a job: "the woman in Image 1 walks through the market in Image 2", "the dance moves of Video 1", "speaks in the voice of Audio 1". A reference staged but never cited leaves the model guessing.
- The picture carries the look. Give a referenced person a short anchor at most, never a full description that can contradict the image.
- References are not frames: none appears in the output as it is.

## Repeating a clip on Wan 3.0

When the user asks to repeat or redo a clip on this model, read the source card first (`list_cards` with its group id gives the prompt and the op that made it).

- Made from text alone: rewrite its prompt for Wan 3.0 with this guide and run `t2v`. Never feed the finished clip back in as a reference: that is a different job and its seconds add to the bill.
- Made from a picture: run `i2v` on that same picture. Pass the clip itself in the picture slot and the app sends the picture it was made from, or its first frame when it has none.
- With the settings panel open, the op and every setting are the user's: use them as they are.

## Example, t2v

The user asks: "a fox crossing a snowy field at sunrise, with nature sounds".

```text
A wild red fox crosses an open snowfield at sunrise, alone in a wide white valley. The fox trots from the left edge of the frame toward a line of pines, pauses mid-field, lifts its head to listen, then bounds on through the deep snow, leaving a trail of prints. Wide shot, low to the snow, the camera tracks slowly alongside the fox. Snow crunches under its paws, a light wind hisses across the field, a crow calls once from the trees. No dialogue. No background music. Cold blue shadows and warm gold light on the snow, calm and natural.
```

## Example, i2v

The user attaches a photo of a baker at a counter and asks: "she welcomes the first customer".

```text
The baker in the frame looks up from the counter, wipes her hands on her apron and smiles toward the door as it opens. She says: "Good morning, the bread is still warm." Lip sync. The camera holds still, then slowly pushes in toward her face. A shop bell rings as the door opens, an oven fan hums in the back. Warm, early morning feel.
```

Adapt the shape; never send an example as it stands.

## When a result disappoints

- **A static clip that barely moves:** the prompt described a scene, not a change. Write what happens over time.
- **Someone speaks who should not, or music nobody asked for:** sound was left open. Add `No dialogue.` or `No background music.`
- **The wrong reference shows up, or one is ignored:** a tag was mistyped or a reference had no job. Check every `Image N`, `Video N` and `Audio N` against what was staged.
- **A cut lost the character's place or costume:** state position and clothing again in the next shot.
- **Erratic camera:** two moves in one shot. Split them.
- **Motion the model cannot hold** (a head shaking three times a second, a superhuman lift): slow it down or make it physically possible.

## Status

The recipe is `draft`: its shape follows Alibaba's own Wan 3.0 prompt guide, and no render has confirmed it in this app yet. Treat a surprising result as evidence worth reporting.

## Sources

- The enhancer recipe `js/data/recipes/wan-3.0.recipe.js` and its research under `docs/recipes/research/wan-3.0/`.
- Alibaba Cloud Model Studio, the Wan 3.0 video generation prompt guide and API reference (the vendor's own).
- `js/data/modelConstants/models.js` (`wan3-cloud`) and `js/data/commandRegistry.js` (`ref2v`), for what the app actually sends.
