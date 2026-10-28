# LTX 2.3: how to prompt it

LTX 2.3 is Lightricks' native joint audio-video model: one pass generates picture and sound together, and it can also take a reference audio clip in. Its Vision card is `ltx-23-balanced` (int8 transformer); the bf16 High card `ltx-23` is retired (MPI-1095). LTX 2.5 (`ltx-25`) has its own guide, `ltx-2.5.md`, and prompts differently (richer look, opens i2v on the start frame): prefer it when both are installed.

It offers `t2v_ms` (text to video), `i2v_ms` (image to video) and `ref2v_ms` (Reference to Video, below), and all resolve to the `ltx-2.3` enhancer recipe: `ref2v_ms` gets its own `r2v` mode (the `t2v` one while no picture is staged), an i2v request gets the `t2v` instruction. In practice, real production work reaches for this model image-to-video almost exclusively. A plate is mandatory overhead on every shot, but it also fixes the framing for you, so lean on it instead of re-describing what the picture already shows.

## Pick it when

- The clip needs synchronized sound generated in the same pass: ambience, foley, dialogue and score all come from the prompt, with no separate audio step.
- Quality is the priority over Wan. LTX's stage-1 output already beats Wan's finished output (`docs/models/ltx/strategy.md`).
- A voice needs to carry into the clip: stage a reference or input audio clip (`inputAudio`) to steer delivery or identity (see Settings).
- Not for mature or NSFW content: this model can only animate what a supplied image already shows, and cannot generate new anatomy from a text prompt alone. That is a confirmed capability gap (`docs/models/ltx/strategy.md`), not a prompting problem; `wan-22` is Vision's card for that instead.

## Reference to Video

LTX 2.3 can also take several reference pictures and animate them using Lightricks' Ingredients IC-LoRA. This is the `ref2v_ms` op. The pictures are packed into one reference sheet by the app; the prompt tells the model which cell is which.

**Pick it over i2v** when you have more than one reference and care about identity tracking across the clip (not just the opening frame). `i2v_ms` takes a start frame; `ref2v_ms` takes a sheet that keeps guiding every frame.

**Pick it over cloud ref2v** when the user wants it free: it runs on the LTX install they already have. **Over H3** when H3 is not installed, or when the clip needs LTX audio (lip-sync to a clip or a cloned voice); H3 takes video references, LTX does not.

**You do not need to build or supply the sheet.** The user (or you) supply individual pictures; the app composes them. Your job is to write the prompt.

### The prompt shape for ref2v_ms (D5)

One `<Picture n>` line per reference picture, in order, then the scene:

```
<Picture 1> Maya, a woman with dark curly hair and faint freckles, mustard-yellow sweater, dark wool jacket, hiking boots
<Picture 2> setting: a narrow mountain path at dusk, golden light through pines, loose stones on dirt
<Picture 3> prop: a blue-framed canvas backpack, brown leather patch on the main pocket

Maya adjusts her backpack straps and continues climbing the mountain trail.
```

Rules:
- Every `<Picture n>` line must carry a real description -- never a bare tag with nothing after it (produces a web-page collage instead of a video, confirmed on bench).
- Role word (`setting:`, `prop:`, `character:`) is optional. Unless another line says `character:`, a Picture 1 with no role word is the character.
- Two-word labels ("the backpack") lose the prop. Full descriptions hold. Describe what you can see or what the user told you; never invent appearance not mentioned.
- The scene paragraph follows standard LTX seven-sentence prose (same structure as `t2v_ms`): shot establishment, scene setting, action, character, camera, audio, closing detail. The scene describes what happens; the sheet handles what things look like.
- Reference to Video differs from text-to-video on the camera: when the user describes no camera behaviour, pick the move or stillness that serves the action (Fabio, 2026-10-12). Keep anything the user did say about the shot: "facing the camera" is a front view, never a side view. Every event the user names happens on screen, finished, played out as two or three physical steps ("scurries in, grabs the orange, runs off toward the water", never just "steals"), and the person it happens to reacts with the body, not a calm smile at the camera (render `ref2v_007`: a one-clause theft plus a smile came out as her handing the orange over).
- No `<Picture n>` tags in the scene paragraph and no `### Reference Sheet Description` heading -- the app writes those.

### What makes a good reference sheet

The app follows rules from a layout bench (MPI-1060 `research/results.md`):
- **Whole pictures only.** Never split a character's front/side/back views into separate cells -- each split view becomes an extra person in the clip.
- **One picture per character.** A three-view character sheet goes in as one file, not three.
- **Character pictures are not cropped.** Settings may be centre-cropped (the app keeps at least 60% of the picture). Props are not cropped either.
- **Props: three views.** A three-angle picture of a prop (front, side/three-quarter, back) works better than a single view.
- **Descriptions are mandatory.** Without a description the model draws a UI card, not the prop.

### Optional extra inputs

- **Start frame** (role `inputStartFrame`): the clip opens on this photo and the identity carries through. It is NOT on the sheet and gets no `<Picture n>` line. In the prompt box the user makes one by clicking a picture's tag.
- **Audio** (`inputAudio`): one audio clip. The model can lip-sync to it or carry its voice identity across, depending on the audioMode the user set. It is not a picture: no line in the picture block; if the prompt names it, keep `<Audio 1>` once, in the scene's sound sentence.
- No video references. A clip used as the guide is copied frame-for-frame, not referenced (confirmed on bench).

### Worked examples for ref2v_ms

Single character, static camera:
```
<Picture 1> Maya, a woman in her early 30s with dark curly hair and faint freckles, mustard-yellow sweater, dark wool jacket, hiking boots laced to the ankle

A wide shot from behind frames Maya climbing the last steep stretch of a rocky mountain trail at dusk. The narrow path is packed dirt between root-split stones, warm orange light angling through a row of pines on the left. Maya lifts each foot deliberately, left hand steadying briefly on a root before releasing as she tops the rise. Her dark curly hair catches the amber light at the edge, jacket collar turned up against the cooling air. The camera remains static, set back to hold her against the full width of the trail ahead. Dry pine needles crunch under each footstep and a low wind carries the sound of a distant creek; no music. The worn leather lace-hook on her left boot, a small brass fitting, catches the last low sunlight with each step she takes.
```

Three pictures -- character, setting and prop:
```
<Picture 1> Maya, a woman in her early 30s with dark curly hair and faint freckles, mustard-yellow sweater, dark wool jacket
<Picture 2> setting: a narrow mountain hiking path at dusk, golden light through pine trees, loose stones on dirt
<Picture 3> prop: a blue-framed canvas backpack with a brown leather patch on the main pocket, metal side buckles

A wide shot from behind frames Maya on the mountain trail as she adjusts the shoulder straps of her blue-framed backpack and keeps climbing. The path cuts through golden-lit pine forest, amber light landing flat across the dirt and stones. She steps over a gnarled root, the backpack shifting with the movement, the brown leather patch catching the low sun at the edge. Her dark curly hair falls forward as she leans into the slope, jacket collar folded up against the cooling air. The camera remains static, wide enough to hold the full sweep of the trail and the treeline above. Dry pine needles and loose gravel crunch steadily under her boots; a light wind moves the highest branches; no music. The stitching on the leather patch, four lines of pale thread at its corners, rocks gently with each step she takes up the trail.
```

## Settings

- Ratios (per op, from `connector-models.json`): identical across `t2v_ms` and `i2v_ms`: `1:1`, `9:16`, `16:9`, `21:9`.
- Quality tiers (same source): identical across all ops: `very_low, low, medium, high, very_high, 2k, 4k`. Auto opens on `medium`.
- Turbo is `false` on every op, and there is no style picker. The shipped workflow is already an 8-step, CFG-1 distilled build, so there is nothing to toggle.
- Media roles. `t2v_ms`: `inputAudio` (optional). `i2v_ms`: `startFrame`, `endFrame` (at least one; `endFrame` alone builds up to it), `inputAudio` (optional). `ref2v_ms`: `inputImage` .. `inputImage9` (= Picture 1-9; with none it is plain text to video, so send at least one), `inputStartFrame` (optional), `inputAudio` (optional).
- `inputAudio` is more than a reference track: staging it can drive lip-sync or a transferred voice identity, chosen elsewhere in the UI, not by you. Either way, expect the supplied clip's real content to often come through rather than exactly what you wrote; word the Audio Integration sentence to match what's actually in the file when you know it.
- There is no working negative box on this distilled build. The recipe already treats every constraint as inline, positive prose: say what you don't want as a positive statement in the paragraph.

## The prompt shape

One flowing prose paragraph: no headings, no labels, no bullet points. LTX was trained on caption-style text, not instructions. Seven sentences, each naming at least two concrete, observable specifics (a material, a plainly-worded colour, a light quality, a texture, a movement, a sound), covering these in order:

1. Shot establishment: open on the action or a visual detail while naming the shot type (wide, medium, close-up and so on) and the camera's viewpoint relative to the subject (front-facing, side, over-the-shoulder, low, high, top-down).
2. Scene setting: textures, and one coherent light source named plainly ("soft overhead light," not "dramatic lighting").
3. Action progression: what physically happens, in chronological order, present tense.
4. Character definition: who is in frame, described by visible build, hair and clothing, with emotion shown only as a physical beat (a clenched jaw, not "angry"). Never guess at ethnicity, nationality, religion or culture.
5. Camera movement: always write this sentence, but only translate a move the user actually described (their "zooms in fast on his face" becomes a crash zoom; their "follows her" becomes a side tracking shot). If they said nothing about the camera, write that it's static; inventing a move nobody asked for is exactly as wrong as inventing a character.
6. Audio integration: the full soundscape, environmental sound, foley, music, and any spoken line quoted exactly with its delivery. State it even when it's just quiet and wind; an unstated soundscape risks the model defaulting to unwanted music underneath the clip.
7. One closing sentence with two more concrete details about something already named (its material, or a small motion it's still making), never a new object and never praise for the shot.

Length: seven sentences land around 200 words at minimum, and rarely past 275 (contract 100 to 300, a runaway guard rather than a target: there is no real encoder wall here, the Gemma 3 text encoder holds about 750 words). Aim for substance over hitting a count. A short draft usually means each sentence carries only one detail instead of two, not that you were being efficient; go back and fill in the material, light, texture or sound you skipped rather than tacking on an eighth sentence.

## Adapting what the user asked for

Keep their subject and priority; weave in the six required elements as the job, not an embellishment, and treat the camera sentence as the one place where naming nothing is the correct answer (static camera).

- Plain, restrained wording throughout: a colour is "forest green" or "slate grey," never "vibrant" or "richly saturated." If a colour needs to be more specific, name the shade, don't rate its intensity.
- For `i2v_ms`, the start frame already carries the look: don't spend a sentence re-describing what's visible in it; spend the words on what happens after frame one.
- One dominant idea per prompt: LTX handles a single clear priority better than several competing ones, and chaotic simultaneous action (a fight, several collisions at once) tends to distort.
- No legible text or logos in the scene: unreliable on this model version, so don't ask for signage or readable words in frame.

Example. The user asks: "a video of a barista making a latte, with the sound of the espresso machine."

```text
A medium close-up frames the barista's hands from a slightly high angle as they set a white ceramic cup, its rim chipped at one edge, beneath the espresso machine's chrome spout. Stainless steel countertops gleam under warm overhead pendant lighting, and a faint dusting of flour lingers near the pastry case in the small cafe. Steam hisses from the group head as dark espresso streams into the cup in a thin, steady thread, and a moment later the barista tilts a stainless pitcher of stretched milk, pouring it in a slow, controlled spiral that blooms across the surface. The barista's fingers stay steady on the pitcher's handle, sleeves rolled to the forearm, and an apron dusted faintly with cocoa powder hangs loose at the waist. The camera stays static, held level on a tripod at counter height, its framing unchanged from the first hiss of steam to the last drop of milk. The espresso machine's steady hiss and gurgle fill the room, cups clinking somewhere off-frame and low chatter drifting under a quiet acoustic guitar track from a ceiling speaker. The white ceramic cup catches a thin ring of pale crema at its rim, still slowly settling as the pour finishes.
```

## When a result disappoints

- The clip has unwanted music under it: the Audio Integration sentence didn't name the ambient sound explicitly; an unstated soundscape defaults to music filling the gap.
- The camera moves when it shouldn't, or does something unrequested: check that the camera sentence only translated a move the user actually described; with none described it must say static.
- The voice or sound doesn't match what was written: reference audio was staged, and its real content tends to come through rather than the prompt's imagined line; write to match what's actually in the file.
- Black bars or letterboxing appear in a `t2v_ms` clip: a seed-dependent quirk of text-to-video mode on this model, not caused by wording or resolution, and negative terms do not fix it (measured). Reroll, or switch to `i2v_ms` with a plate, which does not show it.
- The output reads short and thin: sentences are each carrying one detail instead of two. Go back through the seven and add the material, light, texture or sound skipped, rather than adding an eighth sentence.
- The closing sentence invents a new prop or compliments the shot: it should be two more details about something already named, nothing new.

## Sources

- LTX-2.3's own rewriter (the Gemma 3 line), `Lightricks/LTX-2` at `.../gemma/encoders/prompts/gemma3_t2v_system_prompt.txt`. Not the `gemma4_*` files in the same folder, which belong to LTX-2.5 (the version trap is recorded in `docs/recipes/playbook/08-vendor-prompt-skills.md`; the claim-by-claim read-out is in `docs/recipes/research/ltx-2.3/sources.md`).
- The enhancer recipe `js/data/recipes/ltx-2.3.recipe.js`.
- `docs/models/ltx/prompt-contract.md` (audio behaviour), `strategy.md` (quality and NSFW positioning), `tiers.md` (ratios and resolution), `audio-input.md` (the two audio modes), `black-bars-and-nag.md` (the t2v letterbox quirk).
- `services/agentBench/connector-models.json` and `js/data/commandRegistry.js`, for the ops, params and media roles as the app actually exposes them.
- Field evidence: `MadPony-Identity/production/cubric-western/findings/h3-prompting.md`, the "LTX is installed, and it is a different tool, not a better H3" note (2026-08-14); it corroborates the i2v-first usage pattern and the supplied-audio-overrides-the-prompt finding.
