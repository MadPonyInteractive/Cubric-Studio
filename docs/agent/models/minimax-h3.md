# MiniMax H3: how to prompt it

H3 makes video with its own sound: 24 fps picture and stereo audio generated together, so
ambience, footsteps, hooves, speech and score all come from the prompt. Two cards use this
guide:

- `minimax-h3`: `t2v_ms` (text to video) and `i2v_ms` (image to video).
- `minimax-h3-ref2va`: `ref2v_ms` (reference to video: up to 9 pictures, 3 videos and
  3 audio clips steer who and what appears).

## Pick it when

- The clip needs sound, and the user wants it in one pass.
- A character or place must stay the same across clips: use `ref2v_ms` with their
  reference pictures.
- A still should come alive: `i2v_ms` with that still as the first frame.

## Settings

- Turbo on. The non-turbo path has come back undercooked in real use.
- `qualityTier` `medium` is the Auto default. A face that is small in the frame needs
  pixels: go a tier higher, or frame closer, before blaming the prompt.
- Ratios: `16:9`, `9:16`, `1:1`, `21:9`. The clip length comes from the project's
  settings, so write enough action to fill it and no more than fits.
- Media roles. `i2v_ms`: `startFrame` (required), `endFrame` (optional).
  `ref2v_ms`: `inputImage` ... `inputImage9` are `<Picture 1>` ... `<Picture 9>`,
  `inputVideo` ... `inputVideo3` are `<Video 1>` ... `<Video 3>`, and `inputAudio` ...
  `inputAudio3` are `<Audio 1>` ... `<Audio 3>`, in that order.

## The prompt shape

Plain text, no markdown, these parts in this order:

1. A look line: subject and style, palette, atmosphere, mood. A lens, film stock or shot
   size goes here too; nothing else in the prompt gives them a home.
2. `ref2v_ms` only: a reference line giving every reference a job, e.g. "Use <Picture 1>
   as the rider's face and clothes, and <Picture 2> as the setting only, not its framing."
3. The shots. `[Shot 1]` never has a time. A later shot opens with its cut instant:
   `[Shot 2] At 00:03.000, the camera cuts to ...`. One clear action per shot, and only as
   many shots as the user asked for: one is the normal answer.
4. A camera line: movement written as plain English with a speed, from zoom in or out,
   push in or pull out, truck left or right, pedestal up or down, arc, roll, or static.
5. `overall_soundscape:` the place and the sounds of the actions.
6. `non_diegetic_music:` a score only the audience hears, or `N/A`. `N/A` is how you stop
   an invented drone.
7. A constraint line, last: rendering faults only (text, subtitles, logos, watermarks,
   cartoon or CG look, dissolves, flicker).

Length: one shot usually takes 60 to 120 words; each extra shot adds more, and a
reference-heavy `ref2v_ms` prompt runs 200 words and up. H3 reads long prompts well, so
never trim detail to be short. The measured failure is the opposite: 45-word captions with
no shot marker and no sound lines.

## Adapting what the user asked for

Keep their subject, action and mood. Add what H3 needs and they did not say: the look, the
camera, the sound of the place, the constraint line. Then check the action against these:

- A performance is named, not implied: "her jaw tight with fear", not only a pose.
- A sustained sound or action has an end. A shout happens once and stops; give the rest
  of the clip its next beat, or the model repeats the first one for the whole clip.
- A state is not an action. "Holds the gun level" over six seconds becomes a slow lift
  into the pose. Write the move with its timing ("in the first half second he snaps the
  gun up") and then pin the stillness ("and holds it still for the rest of the shot").
- Scenery gets no verbs. "A ridge running across the frame" moves. "A ridge on the far
  horizon, fixed in place" does not.
- Entrances happen in screen space: "rides in from the left edge of the frame". The model
  cannot draw what is behind the camera, so it moves things instead.
- A long travelling shot names what the camera passes on the way; otherwise the model
  invents events to fill the time.
- Speech: quote the words and put the delivery right before them ("shouts over the
  hooves: ..."). A voice reference gives the timbre; the prompt gives the delivery. Expect
  the scene sound to dip while someone speaks.
- Cite each reference inside the sentence that uses it ("the rider from <Picture 1>
  pulls up"), never as a tag after the sentence.
- `ref2v_ms` has no negative field, so "no close-up" puts the word close-up into the
  prompt. Never negate the scene's own content; say what you want instead.
- For `i2v_ms`, the picture is already the first frame: describe what happens next, not
  what the picture shows.

Example. The user asks: "a short video of a paper boat drifting down a flooded gutter after
rain".

```text
Rainy city street look: low to the ground, wet asphalt mirroring a grey sky, muted blues around one bright white paper boat, mood small and hopeful.
[Shot 1] A folded paper boat rides the fast water along a flooded gutter, rocks as it clears a drift of leaves, spins once in an eddy by a drain grate, then straightens and sails on past a parked bicycle wheel.
The camera travels beside it at gutter height, trucking right at the boat's speed.
overall_soundscape: Water gurgling along the curb, drips falling from an awning, a car rolling slowly past on the wet road.
non_diegetic_music: N/A
No text, subtitles, logos or watermarks, no cartoon or CG rendering, no slow motion.
```

## When a result disappoints

- The move arrives early and skips its middle: the clip is too short for it. Simplify
  the move, or suggest a longer clip.
- Things drift or move on their own: too little is written for the length. Add a second
  beat, or pin the stillness in words.
- A face goes soft in a wide shot: raise `qualityTier` or frame closer.
- A reference is ignored, or its framing takes over: cite it inside a sentence, say what
  it is for, and say what it must not supply.
- A clip comes back silent: something else sits where the sound lines belong. One camera
  line, then the two sound lines, then the constraint line, nothing after.
- Someone shouts or hums the whole clip: the sound had no end.

## Sources

- MiniMax's own prompt-writing skill, `github.com/MiniMax-AI/MiniMax-H3`,
  `.claude/skills/h3-prompt-writing/` (read 2026-08-17; locations and claims in
  `docs/recipes/research/minimax-h3/sources.md`).
- The enhancer recipe `js/data/recipes/minimax-h3.recipe.js`.
- `docs/models/h3/` (the model card, `ref2va.md` for reference slots).
- Mad Pony's H3 western production findings, 2026-08-11 to 2026-08-17 (reference-to-video
  only, so the `t2v_ms` and `i2v_ms` advice rests on the vendor's guide).
