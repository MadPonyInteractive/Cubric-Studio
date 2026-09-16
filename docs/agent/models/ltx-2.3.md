# LTX 2.3: how to prompt it

LTX 2.3 is Lightricks' native joint audio-video model: one pass generates picture and sound together, and it can also take a reference audio clip in. Two Vision cards share this guide, with the same ops and only the transformer's precision differing:

- `ltx-23`: the high, quality-ceiling tier (full bf16 transformer).
- `ltx-23-balanced`: the fast tier (int8 transformer; everything else is shared).

Both offer `t2v_ms` (text to video) and `i2v_ms` (image to video), and both resolve to the same `ltx-2.3` enhancer recipe, which only defines a `t2v` mode: an i2v request gets the same six-part instruction. In practice, real production work reaches for this model image-to-video almost exclusively. A plate is mandatory overhead on every shot, but it also fixes the framing for you, so lean on it instead of re-describing what the picture already shows.

## Pick it when

- The clip needs synchronized sound generated in the same pass: ambience, foley, dialogue and score all come from the prompt, with no separate audio step.
- Quality is the priority over Wan. LTX's stage-1 output already beats Wan's finished output (`docs/models/ltx/strategy.md`).
- A voice needs to carry into the clip: stage a reference or input audio clip (`inputAudio`) to steer delivery or identity (see Settings).
- Not for mature or NSFW content: this model can only animate what a supplied image already shows, and cannot generate new anatomy from a text prompt alone. That is a confirmed capability gap (`docs/models/ltx/strategy.md`), not a prompting problem; `wan-22` is Vision's card for that instead.

## Settings

- Ratios (per op, from `connector-models.json`): identical across `t2v_ms` and `i2v_ms` on both `ltx-23` and `ltx-23-balanced`: `1:1`, `9:16`, `16:9`, `21:9`.
- Quality tiers (same source): identical across both ops on both cards: `very_low, low, medium, high, very_high, 2k, 4k`. Auto opens on `medium`.
- Turbo is `false` on every op of both cards, and neither offers a style picker. The shipped workflow is already an 8-step, CFG-1 distilled build on both tiers, so there is nothing to toggle.
- Media roles. `t2v_ms`: `inputAudio` (optional). `i2v_ms`: `startFrame` (required), `endFrame` (optional), `inputAudio` (optional).
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
- `tests/fixtures/agent/connector-models.json` and `js/data/commandRegistry.js`, for the ops, params and media roles as the app actually exposes them.
- Field evidence: `MadPony-Identity/production/cubric-western/findings/h3-prompting.md`, the "LTX is installed, and it is a different tool, not a better H3" note (2026-08-14); it corroborates the i2v-first usage pattern and the supplied-audio-overrides-the-prompt finding.
