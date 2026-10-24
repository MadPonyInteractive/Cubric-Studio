# FLUX.3 Klein: how to prompt it

One Vision card resolves to this recipe: `flux3-klein` (FLUX.3 Klein, Black Forest Labs). One
model for six ops: a generator (`t2i`, `i2i`), an instruction editor (`edit`, up to TEN
references), two masked ops (`inpaint`, `detail`) and `upscale`. It is NOT FLUX.2 Klein
(`klein-4b` / `klein-9b`, guide `guide:flux-2`): a newer model, and its prompts are long where
Klein's are short.

**A short prompt renders flat.** Its maker ships a prompt upsampler and says not to run the
model without one. Vision does not ship that weight: the prompt YOU write is the upsampled
one. Never send a one-line idea as it is; write the long form below. A user prompting it by
hand is told to press Enhance first (it runs this same recipe).

Licence: FLUX Kommunity License. The model is non-commercial; the IMAGES may be used
commercially only by a user under the licence's revenue limit (a "Qualifying User"). Say so
when a user mentions selling or client work.

## Pick it when

- More than eight pictures in one edit: `edit` takes up to ten.
- Several references composed into one new picture (a person from one, a jacket from
  another, a place from a third).
- A photograph that should look like an ordinary photo rather than a stock shot: its maker's
  rewriter asks for "a few ordinary, non-ideal specifics".

## Settings

- **Turbo** (`turbo`) picks the weight: on (default) = the distilled model, 16 steps, fast;
  off = the base model, 50 steps, about four times slower. In Auto, send `turbo: true`, people
  and photographs included. Base renders skin more naturally (Turbo skin can read plastic);
  Turbo holds up on products and text, and Turbo single-pass `upscale` kept a face's identity
  best of every upscale tried.
- `turbo: false` only when the user asks for it: more quality, more natural skin, a final or
  best pass, the base model, turbo off. That is never a higher tier: a tier here is only the
  picture's size. Say it runs about four times slower.
- In Ask first, offer Turbo as the default. A user who names a setting of their own gets exactly that.
- Tiers `1k`, `2k`, `4k` on `t2i`, `i2i` and a custom-size `edit` (4k: Turbo ~130 s, base ~11 min on a 16 GB card).
  The ratio is a param: never write it into the prompt.
- `edit` keeps the FIRST image's frame unless custom size is on: a `ratio` or `qualityTier`
  param turns it on, and a `qualityTier` needs a `ratio` with it. A mask always keeps the
  source frame, and so do edit boxes: send neither with them. The first image's OWN ratio at
  a bigger tier (8:5 2K on an 8:5 picture) keeps the scene and adds pixels; another ratio
  re-lays the whole frame around the scene.
- `inpaint` and `detail` need a mask painted in History; you cannot paint one, so ask the user
  to, naming the area, and dispatch once they say it is drawn (`app:masking`).
- `upscale` with `tiles: true` gives every tile the prompt plus a short name the app writes per
  tile, so send only the look ("sharp photo, fine film grain") or none, never the scene; single
  pass reads the prompt as a description of the picture as it already is.
- Media roles: `t2i` takes no image; `i2i`, `inpaint`, `detail`, `upscale` take `inputImage`;
  `edit` takes `inputImage` through `inputImage10`, the first the one being changed.

## Boxes (`t2i`, `edit`)

`boxes` places things: `[{ name, x, y, w, h, desc }]`, with `x, y` the top-left corner and
`w, h` the size, each 0 to 1 of the output picture (on `edit`, of the first image). Send them
when the user says WHERE something goes ("a fox bottom-left", "put a lamp on the table").
The app appends them to your prompt as the model's layout table; never write coordinates in
the prompt yourself.

- `name` is one word (`fox`, `red_lamp`); cite it in the prompt as `<fox>`. That is the one
  angle-bracket tag this model reads.
- `desc` is what goes in the box. Inside its box, the desc wins over the prompt, so keep the
  two saying the same thing.
- The box SIZE reads as distance: a big box is near the camera, a small one far away. Size
  the box for the depth you want, not just the area.
- Write the prompt at the box's size: the prompt beats the box. Each person's clothes, their
  faces, or a camera close behind them draws them far larger than a small box. For a small
  box say small, distant figures, the camera far back, and leave out detail that only shows
  up close.
- Boxes are fractions of the frame they were drawn on: send the same `ratio`, or they stretch.
- On `edit`, an added object lands in its box. Who does what to whom across boxes (the tiger
  chasing the mouse) is the model's limit: say it in the prompt, then adjust box size and
  place, and never promise it.

## The prompt shape

Two shapes, and the op tells you which.

**Generation ops (`t2i`, `i2i`, `upscale`).** ONE continuous prose block, typically
100 to 350 words (more for a complex scene), in the generative voice: it states the picture,
never "this image shows", "we can see" or "is visible".

1. Lead with the medium and style. No style asked for: plan an actual photograph and open on
   the convention, "Full-color outdoor photograph, ...", "Full-color indoor photograph, ...",
   "Studio photograph, ...", "Close-up photograph, ...". "Photorealistic" is for renders; a
   request for a "realistic photo" becomes the photograph convention.
2. The scene, the lighting and the camera.
3. The subjects with concrete colours, materials and state. Every person in focus gets an
   observable profile: ethnicity, gender, age range, skin tone ("fair skin", "brown skin"),
   hair and clothing.
4. A layout someone could rebuild from the words: frame-relative positions (frame-left,
   frame-right, upper, lower, foreground, midground, background), sentences opening on an
   anchor ("On the left, ...", "In the background, ..."), relations (holds, faces, behind).
   Up to about ten things one by one; beyond that the exact count and arrangement.
5. Out-of-focus or distant planes as shapes, colours and silhouettes, never identities or
   readable text; the background takes about a sixth of the prompt.
6. Words in the picture: every wording verbatim in double quotes, in its own language and
   script, line breaks kept, with typography, colour and placement. Text the request needs
   but does not give: write correct, real wording.

Decide everything the user left open as ONE plan: never offer alternatives, never hedge. Keep
every subject, count, position, style cue and word they gave. Turn moods into what is
physically there. No quality words, no emotion judgments, no closing sentence about mood.
Depth of field, bokeh or blur only when asked for or implied. No invented names, brands,
logos or celebrities; keep the ones the user named. All prose in English.

`detail` is NOT this shape: a few words naming what is inside the mask, `hand over arm`
(`app:masking`). On `i2i` and
`upscale`, describe the picture you want, not the change.

**`edit` and `inpaint` are an INSTRUCTION** on the images, one prose block, scaled to the
request: one or two sentences for a single-property change, about 40 to 90 words for a
standard edit, up to 150 for a multi-reference composition. Pick the voice by the task:

- One picture keeps, a bounded change: imperative. "Remove the ...", "Change the ... to ...",
  "Zoom in on ...".
- The whole picture transforms: open with the scope. "Convert the entire image into ...",
  "Apply a ... filter over the entire scene", "Shift the camera viewpoint to ...", then where
  the major things now are.
- References drawn into a NEW frame: a generation request. "Create a photograph of ...",
  "Generate a new image featuring ...", saying what to take from each image BY ORDINAL ("the
  woman from the first image, the jacket from the second") and what is newly made.

Name each thing by how it really looks in the picture, never something that is not there, and
use every image attached. Say every end state concretely (which colour, how large, which pose,
which material), cover the knock-on effects (shadows, reflections, what covers what, scale,
light) and say what fills a removed region. Describe the change, not the whole scene, and end
an editing instruction with ONE clause naming what stays unchanged; a transferred person keeps
their face, identity and accessories unless asked otherwise. On-picture text: verbatim in
double quotes, matching the original font, size and colour when replacing it. No angle-bracket
tags: images go by ordinal.

## Adapting what the user asked for

A one-line idea is not a one-line prompt here. Expand it into the plan above; keep every
choice the user made, said as something visible. Ask for the user's ratio when the
composition depends on it, and set it as the `ratio` param.

Example. The user asks: "a fox in the snow".

```text
Full-color outdoor photograph, a red fox standing side-on in fresh snow at the edge of a pine forest in the late afternoon, low winter sun from frame-right raking across the snow and leaving short blue shadows, shot at eye level. The fox stands in the center foreground with its head turned toward the camera and its front left paw lifted, a deep russet coat fading to cream on the chest, black legs and black-edged ears, frost on its whiskers. In the snow in front of it, a line of small paw prints runs in from the lower left, one print half filled by blown powder. On the left, a fallen log lies half buried, a strip of grey bark showing above the drift. In the background, dark pine trunks stand in a dense row, snow resting on their lower branches, the far trees reduced to grey vertical shapes.
```

Example. The user asks, on a pool-side portrait: "make her swimsuit red".

```text
Change the woman's ribbed teal one-piece swimsuit to a deep cherry red with the same ribbed texture, thin spaghetti straps and scooped neckline, so the fabric shows the same soft highlights along the ribs and a slightly warmer reflection on the wet stone ledge beside her. Keep her face, smile, pink-tipped wavy hair, gold ring, pose, the turquoise pool and the tropical foliage behind her unchanged.
```

## When a result disappoints

- Flat, plain, stock-looking: the prompt was short. Write the full form; that is what the
  model was trained on.
- Plastic or oily skin on a person: Turbo is on. Offer a rerun with `turbo: false` (about four
  times slower); run it once the user says yes.
- A custom-size edit recomposed or widened a scene whose shape did not change: drop `ratio`
  and `qualityTier` so the edit keeps the first image's frame.
- An edit changed something it should not have: end on the unchanged clause, naming each kept
  thing by type and place, and stop re-describing it.
- The wrong reference was used: name each image by ordinal with what it shows.

## Sources

- Its maker's prompt-upsampler system prompts (`flux3/pup.py`, `system_prompts.json` in
  `black-forest-labs/flux-3-image-klein`, Apache-2.0), copied in
  `.agents/mpi-kanban/tasks/MPI-1181/research/bfl_pup_system_prompts.json`.
- The enhancer recipe: `js/data/recipes/flux-3.recipe.js`.
- `docs/models/flux3/README.md` and the MPI-1181 bench evidence.
