# Seedance 2.0: how to prompt it

Seedance 2.0 ships as one Vision card, `seedance-2-cloud`. It is a **cloud** card: no weights, no ComfyUI graph, no engine. It runs at DeepInfra on the user's own API key. "Installed" means a key is saved. The cost of a run is on the estimate card; show the user that before a run, never a figure from memory.

Two ops, `t2v` and `i2v`, and the recipe has a mode for each. The model makes picture and sound together.

This file is the router. Five sub-skills hold the detail; the table near the end says which one a request needs. Read it with `read_knowledge` and its id before writing that part of the prompt.

## Pick it when

- The shot needs believable physical behaviour: weight, contact, cloth, water, a door that resists.
- Sound matters: footsteps, a spoken line, room tone. It is generated with the picture, not added after.
- A person has to act: a reaction, a look, a line of dialogue delivered under pressure.
- The clip needs a cut or two inside it, planned in the prompt.

## What the app sends, and what it sets

- Ratios: `1:1`, `3:4`, `4:3`, `9:16`, `16:9`, `21:9`. Quality tiers: `480p`, `720p`, `1080p`. Duration: 4 to 15 seconds. These come from the provider's published fields.
- The app sets the duration, the ratio and the tier. **Never write any of them into the prompt**, and never a resolution word such as "4K".
- No batch: one clip per call.
- **No negative prompt field.** Constraints go into the prompt as short locks.
- `i2v` sends one image, as the clip's **first frame**. Nothing else is sent: no reference images, no reference video, no reference audio. The model's `@Image` / `@Video` / `@Audio` tags therefore name nothing in this app; never write them, and never promise more than one image.

## The prompt shape, both ops

Plain sentences in this order. It is ByteDance's own order for this model.

1. **Subject.** Who or what, named in the opening words, with two or three stable visible features.
2. **Action.** One main action, already under way, with the body part and its range, speed and force, and real physics.
3. **Scene and first-frame blocking.** The place and time, and where everything is in the very first frame: screen side, depth, a measured distance or a contact with a landmark, which way the body faces, where the eyes look.
4. **Lighting.** The main source, its direction, the camera's side relative to it, what stays dark.
5. **Camera.** Shot size, at most one movement, height, and the lens as a diagonal field of view in degrees with the camera distance.
6. **Sound.** Sound effects in `<>`, spoken lines in `{}`, music in `()` only when the user wants music.
7. **Style and quality.** One compact style anchor and a few quality words ("sharp, natural colour, stable picture").
8. **Constraints.** One or two locks for the likeliest failure, stated as the wanted state, then the tail: `subtitle-free, no logo, no watermark`.

Density goes where control matters: placement, gaze, hands, props, lens, light, timing of speech. Decorative adjectives buy nothing. A longer prompt is not a stronger one.

**One continuous take by default.** Cuts only when the user asks, or when the action cannot be staged from one camera position. Then `Shot 1:`, `Shot 2:`, each with its own camera, action and sound, and the transition named ("Hard cut to"). **Never timestamps or durations** ("0-3s", "0:03"): ByteDance states the model handles precise timing badly.

## t2v

The text carries everything, so the first frame must be written: who is in it, where, facing where. An empty opening frame, or a subject who walks in late, is the commonest wasted clip.

## i2v

The image is frame one. It already fixes the face, the clothes, the colours, the set and the opening framing. Write **only what happens from it**: the motion, the camera's one move, the sound. Name the subject the way the user did ("the woman in the frame"), keep the frame's light direction and lens unless the user asks for a change, and close with a lock that identity and clothing match the first frame. Re-describing the picture pulls the clip away from it.

A cut leaves the first frame behind, so in `i2v` cut only when asked, and say what each new shot shows.

## Sound

- `{I'm not going back.}` A spoken line, only when the user gave one or wants the character to speak: never invent dialogue, and never put anything but spoken words inside the braces. Only those words are spoken. Name who says it, and keep one language per clip; a less common language is named ("says in Portuguese {...}").
- `<a car door slams>` A sound effect. Specific, physical, tied to something on screen.
- `(slow piano)` Music, only when asked for. Unrequested music is a common failure: say so in a lock when the scene is quiet.
- Describe a voice in words (age, weight, pace) when it matters: the model cannot be handed a voice sample here.

## Constraints

Locks sit next to what they protect and say the wanted state first: "his hand stays on the rail throughout", "the pieces stay where they were across the cut". Useful ones: no duplicate characters (any scene with several people), no extra people, the first frame already holds the subject, the face stays in shadow. End every prompt with `subtitle-free, no logo, no watermark`: unrequested subtitles are the model's most frequent stray, and landscape ratios get fewer of them than portrait.

## Sub-skills: which one the request needs

| Read (`read_knowledge` id) | When |
|---|---|
| `guide:seedance-2.0/blocking` | Anyone or anything must be in a particular place: two people facing each other, a subject next to a landmark, the first frame's composition, left and right. |
| `guide:seedance-2.0/optics` | The shot size, lens or camera move matters: a portrait, a wide environment, a long-lens look, handheld, a lens the user named in millimetres. |
| `guide:seedance-2.0/light-and-physics` | The light has a job (backlight, a single window, night), or the action is physical (running, lifting, water, cloth, dust, a vehicle). |
| `guide:seedance-2.0/performance` | A person acts, reacts or speaks: any emotion, any dialogue, any ensemble. |
| `guide:seedance-2.0/shots-and-cuts` | More than one shot, a dialogue exchange, fast action, or a clip that must hold continuity across a cut. |

Most prompts need one or two of them, not all five.

## Example, t2v

The user asks: "a fisherman pulling in his net at dawn".

```text
A grey-bearded fisherman in a yellow oilskin coat hauls a wet net over the side of a small wooden boat, both forearms straining, the heavy net slapping onto the deck and spilling seawater across his boots. A calm grey harbour at dawn; in the first frame he stands screen-left at the stern, body facing the water, eyes on the net, the harbour wall ten metres behind him. Low sun from camera-right rims his shoulders and the wet mesh, while the side of his face toward the camera stays in shadow. Medium shot, slow push-in at chest height, 47-degree field of view, camera about 4 metres away, natural proportions. <rope creaks against the gunwale> <water pours off the net> <gulls far off>. Naturalistic documentary look, fine grain, sharp detail, natural colour, stable picture. His grip stays on the net throughout; subtitle-free, no logo, no watermark.
```

## Example, i2v

The user attaches a photo of a woman at a café window and asks: "she drinks her tea".

```text
The woman in the frame slowly lifts the teacup to her lips with her right hand, pauses as the steam brushes her face, then lowers it halfway while her eyes drift toward the window. Her position, clothing and the room stay as they are in the first frame. The window light keeps its direction, falling across the cup and her hands. Fixed camera, very slow push-in, lens unchanged from the first frame. <a spoon rings softly against china> <rain on the glass>. Calm and natural, sharp, stable picture. Her face and hair match the first frame throughout; subtitle-free, no logo, no watermark.
```

Adapt the shape; never send an example as it stands.

## When a result disappoints

- **The opening frame is empty, or the subject arrives late:** the first frame was not written. `blocking`.
- **People face the wrong way or look past each other:** body facing and gaze were not both stated. `blocking`.
- **The lens drifted, or a portrait came out wide:** the lens was a shot size or millimetres, or two content types shared one shot. `optics`.
- **The camera wobbles or wanders:** two movements in one shot, or "handheld" without saying what the operator does. `optics`.
- **The light went flat:** no source and direction, or the camera sat on the lit side of a backlit subject. `light-and-physics`.
- **Motion floats or looks weightless:** no contact, weight or follow-through; or a burst action the model cannot sustain. `light-and-physics`.
- **The acting is a mask or a grimace:** an emotion was named instead of shown. `performance`.
- **A cut reset the scene, or cut at a strange moment:** continuity was not locked, or a timestamp was used. `shots-and-cuts`.
- **Two identical people:** add the no-duplicate lock; with several people in frame, give each a distinct feature.
- **Subtitles or a watermark appeared:** the constraint tail was missing. Portrait ratios make subtitles likelier.

## Status

The recipe is `draft`: its shape follows ByteDance's published guide and a serving platform's production skill, and it passes the text checks, but no render has confirmed it yet. Treat the shape as sound and a surprising result as evidence worth reporting.

## Sources

- The enhancer recipe `js/data/recipes/seedance-2.0.recipe.js` and its research under `docs/recipes/research/seedance-2.0/` (`sources.md` rows 11 to 18).
- The provider's published input fields, captured in `dev_configs/deepinfra-prices.json`: the ratios, tiers and duration range are copied from there.
- `js/data/modelConstants/models.js` (`seedance-2-cloud`), for what the app actually sends.
