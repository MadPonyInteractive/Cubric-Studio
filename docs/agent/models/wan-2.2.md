# Wan 2.2: how to prompt it

Wan 2.2 is a dual-expert (MoE) video model shipped as two different Vision cards:

- `wan-22`: the 14B SmoothMix build, distilled. One op, `i2v_ms` (image to video); there is no text-to-video op on this card.
- `wan22-5b`: the small TI2V-5B build, a cheap and fast alternative. Two ops, `t2v` (text to video) and `i2v` (image to video), sharing one transformer.

Both cards resolve to the same enhancer recipe, `wan-2.2`, and that recipe only defines a `t2v` mode: whichever op you are writing for, i2v included, you compose the same six-part scene description, because there is no separate i2v-shaped instruction yet. For an i2v op, treat the supplied still as already fixing cast, setting and the opening camera framing, and spend your words on what happens next rather than re-describing the picture.

## Pick it when

- The user wants mature or uncensored content: `wan-22` is Vision's card for this (its own description says so), and it is a real point of difference from LTX 2.3, which has a confirmed capability gap on NSFW synthesis. LTX can only animate what a supplied image already shows, never generate new anatomy from text alone (`docs/models/ltx/strategy.md`).
- VRAM or speed is the constraint: `wan22-5b` needs as little as 8GB VRAM (about 17GB of downloads) and is Vision's low-tier video card, built for cheap and fast, not for quality.
- The user hands you a still image to animate: `i2v_ms` on `wan-22`, or `i2v` on `wan22-5b`.
- Not when quality is the goal. LTX 2.3's stage-1 output already beats Wan's finished output (`docs/models/ltx/strategy.md`), and Wan is being displaced by LTX and MiniMax H3 in this app; reach for it when uncensored or cheap is actually what is being asked for.

## Settings

- Ratios (per op, from `connector-models.json`): `wan-22`'s `i2v_ms` and `wan22-5b`'s `t2v`/`i2v` all offer the same four: `1:1`, `9:16`, `16:9`, `21:9`.
- Quality tiers (same source): `wan-22` `i2v_ms`: `very_low, low, medium, high, very_high`. `wan22-5b` `t2v` and `i2v`: `low, medium, high` only (720p is its whole band, no draft or upscale extremes). Auto opens on `medium` for every op on both cards.
- Turbo is `false` on every op of both cards, and neither offers a style picker. Both already ship pre-distilled workflows (`wan-22` runs the SmoothMix v2 two-stage sigma schedule, `wan22-5b` bakes in a 4-step Turbo LoRA), so there is nothing to toggle.
- Media roles. `wan-22` `i2v_ms`: `startFrame` (required), `endFrame` (optional, a real second keyframe, not just a hint). `wan22-5b` `t2v`: no media. `wan22-5b` `i2v`: `startFrame` only; unlike its bigger sibling, this card has no end-frame slot at all.
- `wan-22` renders at 16fps; tell the user it benefits from interpolation afterward for smooth motion. `wan22-5b` runs at 24fps.
- Both cards run a distilled, step-reduced workflow, and the recipe's own notes already treat the negative box as inert in that regime (CFG=1, Lightning-style). Say what you don't want as a positive statement inside the prompt.

## The prompt shape

Structured plain prose, not tags: six parts, in this fixed order, and the order matters. Wan's high-noise expert reads the early sentences (cast, setting, camera); its low-noise expert reads the late ones (lighting, style). Moving a detail out of its slot sends it to the wrong expert.

1. Cast and count, stated as an exact number at the very start ("Exactly one woman, alone in frame"). An ambiguous count is the single biggest cause of extra, hallucinated people.
2. Setting and time: place, weather, time of day. Unstated defaults to daytime. A sky in shot is "deep blue" (not "bright"), which is what keeps the exposure from blowing out.
3. Camera: shot size and movement, in film terms, established early. Add a shooting angle (over-the-shoulder, low, high, Dutch, aerial or overhead) only when the shot has no movement of its own; a described move and an added angle fight each other, so the move always wins and gets no angle on top.
4. Action as a short sequence of concrete steps, never a vague verb: "steps forward, glances left, crouches," not "walks." When nothing was asked for, give the subject a small action and let the background move too (a drifting cloud, stirring leaves); a still prompt renders a still video.
5. Motion boundaries, woven into the same prose as positive statements ("the camera does not move," "no other people enter frame"). This is where a negative would go if the box worked.
6. Lighting and style tags, last (this is what the low-noise expert actually reads): at most four choices total from light source, intensity, angle, colour tone and composition (defaulting to centre). Add a named style only if the user asked for one, and never layer cinematic lighting language over a 2D or illustration style.

Length: six sentences, about 80 to 120 words, 150 hard ceiling. The floor is 50: thin, but real, because field use shows very basic Wan prompts, especially i2v, work fine, so don't pad for its own sake. The research this recipe draws on does warn that a prompt under about 60 words risks the model inventing generic filler to cover the gap, so treat 60 as the real target and 50 as the fallback for a one-word request.

## Adapting what the user asked for

Keep their subject and intent; add the six required pieces they didn't think to specify. That is the job, not embellishment.

- For an i2v op, don't restate what the picture already shows. Say what changes: the action, the camera's move from here, anything new entering frame.
- A named 2D or illustration style drops the cinematic lighting and camera language entirely; film vocabulary describing a drawing reads as a mismatch, not extra detail.
- Multiple subjects need their actions sequenced explicitly ("first the man turns, then the woman steps forward"); unscripted simultaneous action for more than one subject is a known miss.
- Skip literary mood words ("the frame brims with tension"); write what a camera would record, and spend those words on a concrete physical detail instead.

Example. The user asks: "make a video of a dog catching a frisbee in a park."

```text
Exactly one golden retriever, alone in frame, no other people or animals present. A sunny afternoon in a wide grassy park, a line of oak trees along the far edge, sky deep blue. Medium wide shot, wide-angle lens. The dog sprints left to right across the grass, leaps mid-stride, and snatches a red frisbee out of the air before landing and trotting to a stop. The camera does not move; no zoom, no pan; the dog stays inside frame the entire time. Sunny lighting, soft shadows, warm colors, center composition.
```

## When a result disappoints

- Extra people or animals appear: the cast line wasn't an explicit count, or the count was ambiguous.
- The scene reads generic, or drifts from what was asked: the prompt was too thin (under about 60 words) and the model filled the gap itself.
- Things drift when they shouldn't, or the camera cuts randomly: no explicit lock was written ("the camera does not move"); absence defaults to change, not stillness.
- Exposure looks blown out on a sky shot: swap the vague light word for the safer default (a "deep blue" sky, and a named light source, intensity and angle instead of a mood adjective).
- A negative typed into a negative box did nothing: expected at CFG=1; move the constraint into the main prompt as a positive statement.
- i2v output ignores the still's framing: check that only `startFrame`/`endFrame` were staged, and that the prompt isn't describing a different scene than the image shows.

## Sources

- Alibaba's own Wan 2.2 prompt rewriter, `Wan-Video/Wan2.2` at `wan/utils/system_prompt.py` and `prompt_extend.py` (read 2026-08-17; claim-by-claim read-out in `docs/recipes/research/wan-2.2/sources.md`).
- The enhancer recipe `js/data/recipes/wan-2.2.recipe.js`.
- `docs/models/wan/tiers.md` (ratios, tiers, frame rate) and `docs/models/wan/two-stage-sigmas.md` (the distilled schedule, and why there is no turbo switch).
- `tests/fixtures/agent/connector-models.json` and `js/data/commandRegistry.js`, for the ops, params and media roles as the app actually exposes them.
- No field-evidence production has used Wan 2.2; none found under `MadPony-Identity/production/*/findings/`.
