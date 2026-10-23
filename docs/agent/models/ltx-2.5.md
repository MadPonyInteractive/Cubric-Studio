# LTX 2.5: how to prompt it

LTX 2.5 is Lightricks' successor to LTX 2.3: the same native joint audio-video model family (picture and sound in one pass, a reference audio clip in), with a Gemma 4 text encoder, more natural acting and about 35-40% faster runs. Vision's card is `ltx-25` (int8, dev builds only for now). Prefer it over `ltx-23-balanced` when both are installed. It has its OWN enhancer recipe, `ltx-2.5`, because Lightricks' own 2.5 rewriter asks for different prompts than 2.3's: do not reuse 2.3 habits blind.

It offers `t2v_ms` (text to video), `i2v_ms` (image to video) and `ref2v_ms` (Reference to Video). Each gets its own recipe mode: `t2v`, `i2v` (which is told what the start and end frames show) and `r2v`.

## Pick it when

- Everything in the LTX 2.3 guide's "Pick it when" (`ltx-2.3.md`) applies: synchronized sound in the same pass, quality over Wan, a voice to carry in. Same NSFW gap: it animates what a supplied image shows and cannot invent new anatomy from text.
- The clip needs acting (faces, timing, lip-sync): 2.5 wins there (side-by-side bench, MPI-1095).
- The user wants several shots in ONE clip: 2.5 can cut between 2-4 shots inside one prompt (text to video only).
- Not when the Flow or LoRA the job needs is 2.3-only (Foley, the Transition LoRA): those stay on `ltx-23-balanced`.

## Reference to Video

Identical to LTX 2.3 (`ltx-2.3.md` § Reference to Video): the same `<Picture n>` lines the app turns into a sheet for 2.5's own Ingredients LoRA, the same sheet rules, the same optional start frame and audio. Only the scene paragraph changes, to the 2.5 caption style below. When the user describes no camera behaviour, pick the move or stillness that serves the action (as on 2.3).

## Settings

- Ratios and quality tiers: as LTX 2.3 (`connector-models.json`).
- **Turbo exists on 2.5** (`turbo`): ON = the fast video decoder, OFF (default) = the slower diffusion decoder that keeps fine textures (scales, cobbles, tiles) steady. Leave it off unless the user wants speed. Same steps either way.
- Media roles: as LTX 2.3. No working negative box (distilled build): say what you want, never name what you want absent.

## The prompt shape

Write it as a CAPTION of the finished video, in the style 2.5's training captions use. One flowing paragraph, no labels, no bullets, no timestamps, six to eight sentences, roughly 150-220 words. In order:

1. Open on the action or a visual detail, never "The scene opens", "We see" or "There is".
2. The framing, as prose, for every shot: exactly one shot type (extreme wide, wide, medium, medium close-up, close-up, extreme close-up) and the viewpoint (front-facing, back-facing, side view, over-the-shoulder, top-down, low-angle, high-angle).
3. The place in full: materials, textures, colours, where things sit, the light as a physical source with a direction.
4. The people, identified specifically and kept distinct: apparent gender presentation, skin tone, age group, hair, build, clothing. Never ethnicity, nationality, religion or culture.
5. The action in time order ("Initially...", "A moment later...", "as", "then"), emotion shown as face and body, never a feeling word.
6. The camera, always stated: the user's move in its optical term with an end point ("pushes in until her face fills the frame"), or static when they described none. Never invent a move (Vision's rule: Lightricks' rewriter would add one, and we don't).
7. The full soundscape woven in: sounds of things in frame, dialogue quoted exactly in its own language with its tone, "no music" unless music was asked for or the scene plainly carries it.

Then the LOOK, woven through those sentences, not added at the end: cinematic, film-grade colour and contrast, beautiful natural light, crisp texture. This is the opposite of LTX 2.3, whose own rewriter asks for plain wording. On 2.5 the rich register is the vendor's instruction.

## Adapting what the user asked for

- **Only what is in the frame.** Naming something outside the shot pulls it in: an off-screen listener walked into 6 of 10 clips in one user's tests (HF LTX-2.5 #92). Write where someone looks, not who they look at; the light on a face, not the lamp out of shot.
- **`i2v_ms`: open on the start frame.** 2.5's own image-to-video rewriter starts the caption by describing the first frame exactly (subject, clothing, setting, light, framing), then plays the action from it as one continuous take, no cuts. The opposite of the 2.3 advice. If an end frame is staged, the last beat arrives on it.
- **Several shots only when asked.** If the user wants cuts: 2-4 shots in one paragraph, each transition named (hard cut, match cut, dissolve), each shot restating its framing and who is in it, and whether the sound carries over.
- **Camera wording drifts in i2v.** "Static" held about half the time and "very slow push-in" overshot in one user's tests (HF #84): state a static camera plainly, and give every move an end point.
- No legible text, no chaotic physics (fights, pile-ups): unreliable here too.

Example. The user asks: "a cyclist braking hard on a wet street, with traffic sounds."

```text
A cyclist in a yellow rain jacket brakes hard at a wet cobbled crossing, a medium shot framing her from a side view as the camera remains static. She is a woman in her thirties with light skin and short dark hair plastered to her forehead, a slim build, and black cycling gloves gripping the handlebars of a steel-grey commuter bike. Initially her back wheel skids a few centimetres across the slick stones, throwing a thin fan of spray, and a moment later she plants her left foot and straightens up, her jaw set and her eyes fixed on the lights ahead. The street behind her glows in low evening sun from the right, warm cinematic light raking across the rounded cobbles and catching every bead of rain on her sleeve in crisp film-grade detail. A red tram slides past in the background, its windows softly blurred. The tyres hiss on the wet stone, a bicycle bell rings once, and the tram rumbles away over the rails; no music.
```

## When a result disappoints

- Someone or something appeared that nobody asked for: the prompt named it, probably as off-screen. Rewrite with gaze direction and light only.
- The camera moved when it should not have: check the camera sentence says static plainly; in i2v it still drifts sometimes, so reroll.
- The voice or sound does not match: staged audio's real content tends to win over the written line; write to match the file.
- Fine textures shimmer or morph: Turbo is on. Turn it off.

## Sources

- LTX 2.5's own rewriter, `Lightricks/LTX-2` `.../gemma/encoders/prompts/gemma4_{t2v,i2v}_system_prompt.txt`; full read-out and every other source in `docs/recipes/research/ltx-2.5/`.
- The enhancer recipe `js/data/recipes/ltx-2.5.recipe.js`.
- `docs/models/ltx/ltx-2.5.md` (weights, Turbo, what stays on 2.3) and `ltx-2.3.md` here for the shared Reference to Video rules.
