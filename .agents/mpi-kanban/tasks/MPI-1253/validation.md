# MPI-1253 validation

Shipped in `8300de9b3`. Idea from a ComfyUI MOSS workflow video (Ok Todd AI, 15:00 on): an
"Analyze Image" button where a vision LLM writes a scene caption plus captioned boxes.

## Bench (question shape)

`ANALYSE_QUESTION` on Ollama `huihui_ai/qwen3-vl-abliterated:4b` (the app describer's family),
soap-ad picture cropped from the video: 5 items, boxes drawn back on the picture land tight on
the soap bar, headline and tagline; lettering quoted word for word. Confirms bbox_2d = [x1,y1,x2,y2]
on 0-1000.

## Unit

- `tests/layout-boxes-analyse.test.cjs`: 3 pass (fenced answer, clamp/drop/cap, no JSON -> null).
- `npm test`: 3524 pass, 0 fail. `npm run lint`: clean.

## Live (own `app:isolated` instance, describer = endpoint/Ollama qwen3-vl 4B)

- FLUX.3 edit: Analyse on picture 1 -> 6 named boxes in place, caption written into the empty
  prompt. Queue row, status bar, Prism "describing", Stop all shown while it ran.
- FLUX.3 t2i: gallery card dropped on the open panel -> guide drawn, NOT staged (imageCount 0,
  op stays t2i). Analyse -> ratio 1:1 -> 3:4 (picture 314x410), 4 boxes, caption.
- MOSS-Image t2i: ratio reset to 1:1, Analyse -> 3:4, 5 boxes, caption.
- Stop mid-run: job cancelled, Analyse button came back.
- Describer down: "Describe failed." toast, button came back.

## Rework 2026-10-22: right-click Create boxes, t2i only

Fabio: the drop path goes (a real card drag got staged as a prompt input); the way in is a
gallery card's right-click > Create boxes; t2i ONLY (recreate a layout like a magazine cover;
an edit's boxes are the user's own). History cards get no item: that workspace has no t2i op.

- `npm test`: 3532 pass, 0 fail. eslint on the changed files: clean.
- Live, own `app:isolated`, REAL mouse right-clicks and drags in the browser pane, a 1200x2000
  card. Describer = endpoint with Ollama stopped (no GPU), then `/llm/describe` stubbed in the
  page with a canned qwen answer (3 items + caption):
  - MOSS t2i: menu shows Create boxes; it opens the panel with the card as guide, queue row
    shows, then 3 boxes + descs, frame 1:1 -> 58x93 (3:5), caption into the empty prompt,
    imageCount 0. Ollama down: "Describe failed." toast, button back.
  - FLUX.3 t2i: same, 3 boxes, 3:5, imageCount 0.
  - Real drag of the card onto the prompt box: staged normally (imageCount 1, op -> i2i).
  - FLUX.3 edit: no Create boxes in the menu; Boxes panel shows picture 1, Analyse and the
    hint hidden.
- NOT re-run on the real describer this round: the analysis code path (question, parser) is
  unchanged from the earlier benched run above.

## Rework 2: Create boxes on any op, t2i lock (Fabio 2026-10-22)

Create boxes shows on every op while the model takes Boxes on t2i, and switches the box to t2i.
While the layout picture is loaded the other ops grey out and adds are refused; the panel's
Remove picture unlocks them.

- `npm test`: 3532 pass, 0 fail. eslint clean. Same live setup (real clicks and drags, stubbed
  `/llm/describe`):
  - SDXL: no Create boxes in the menu.
  - FLUX.3 with a card staged on edit: Create boxes -> op t2i, staged picture dropped
    (imageCount 0), 2 boxes, guide drawn, Remove picture shown.
  - Locked: edit chip info "... remove the layout picture in Boxes to use it"; a real click on
    it leaves the op on t2i; a real card drag onto the box is refused with "Remove the layout
    picture in Boxes first." (imageCount 0).
  - Remove picture: guide gone, the 2 boxes kept, edit back to "needs 1 image"; a real drag
    then stages (imageCount 1).

## Rework 3: Fabio's first real run (2026-10-23)

Fabio's run on an anime meadow picture: 7 boxes, all misplaced, slow. Swap test on his
screenshot: the squirrel's drawn box is the real one with x and y exchanged, i.e. the
describer answered [y1,x1,y2,x2] (Gemini/Gemma order) to a question that asks Qwen's
[x1,y1,x2,y2]. Describer still to confirm (his storage shows both ComfyUI and DeepInfra
gemma entries); fix pending that.

Fixed meanwhile, same live setup (real clicks, stubbed describer), `npm test` 3532/0:
- The layout picture lives in `state.promptDraft` (`boxesGuide`): Projects page and back
  kept the picture, Remove picture and the edit chip's lock reason.
- Analyse button removed (right-click is the way in): absent from the panel.
- Eye per row: hid "head" on the frame (node `.hide`, eye grey), run count stayed 2.
  View-only, resets when the panel remounts.

## Rework 4: box order (2026-10-23)

Fabio's describer: Remote, DeepInfra `google/gemma-4-26B-A4B-it`. Bench on
`Big Photos Test/Media/flowObjectStamp_003.png` (same meadow scene: tall girl, top sky, wide
pink field, small squirrel), 1024 px JPEG as the describe route sends, script
`research/box-order/boxbench.mjs` (answers + overlays beside it) (drawn as asked and transposed). 4 paid runs, ~$0.0014 total:
- Gemma 4, the shipped question (`bbox_2d` [x1,y1,x2,y2]): 64.5 s (DeepInfra slow that call),
  sky `[0,0,289,1000]` = a LEFT strip as asked; transposed, every box lands (sky top, fields
  bands, squirrel exact). Gemma answers top-first whatever the question says. Fabio's bug.
- Gemma 4 asked `box_2d` [ymin,xmin,ymax,xmax]: 7.2 s, all right, girl hat to feet.
- Gemma 4 asked NAMED edges `box:{top,left,bottom,right}`: 10.9 s, all right.
- Qwen3-VL-30B (DeepInfra) asked named edges: 27.2 s, all right (girl 146-888 x 382-680).
Shipped: named edges; `box_2d` read top-first, `bbox_2d`/`bbox` left-first as fallbacks. The
three saved answers through `boxesFromAnalysis`: girl x.39 y.16 w.29 h.75, sky full-width top,
squirrel x.31 y.85 on all. New unit test pins the sky case for all three keys.
ComfyUI describer cap 512 -> 1024 (node 36): answers ran 550-950 tokens, 512 cut the JSON.
NOT run: the local ComfyUI qwen3-vl 4B on the new question (needs the GPU, Fabio rendering).

## Fabio's check + rework 5 (2026-10-23)

Fabio, own app, Gemma 4 26B: meadow picture and a 9:16 storefront both "10 times faster.
And 100% correct" (boxes on the girl, squirrel, sign, window, people).
- Caption: a second Create boxes kept the FIRST picture's caption (empty-prompt rule). Now
  the caption also replaces the last one Create boxes wrote itself (`_autoCaption`); a typed
  or edited prompt stays. Live, stubbed describer: run 1 wrote caption 1, run 2 replaced it,
  run 3 after an edit left "caption 2 + my edit".
- "Cubric" read as "Cubic": Gemma 4 on `FLUX3 Flow Bench/Media/t2i_007.png`, 4 paid runs
  (~$0.001): the shipped question 2/2 "Cubic Studio", plus "copy lettering letter by letter,
  even when not a real word" 2/2 "Cubic Studio". A model misread, not a wording one: not shipped.
  The desc field is editable.

## Rework 6: the video's analyser, on Qwen3-VL (2026-10-23)

The video's Analyze Image is AcademiaSD's MOSS Layout node (github.com/AcademiaSD/comfyui_AcademiaSD,
`nodes/academia_moss_layout.py`, no licence stated): Qwen3-VL-4B (`qwen3-vl-4b-heretic_int8`,
the pack's Prompt Enhancer model) loaded as a CLIP, Qwen's own `bbox_2d` [x1,y1,x2,y2] on
0-1000, up to 20 items labelled character/object/text with the exact letters in a `text`
field, greedy with no repetition penalty (their comment: the penalty punishes repeated digits
and moves the boxes), 2048 tokens, picture <= 1 MP.
Bench `research/qwen-bench/bench.py`: the app's own `image_descriptor.json` on OUR shipped
`qwen3vl_4b_abliterated_fp8_scaled`, own engine on :48299 under the GPU lease, Vogue cover
(`FLUX3 Flow Bench/Media/imported_002.jpg`) scored by best IoU against Fabio's 9 saved boxes:
- A, shipped (named edges, sampling 0.2 / penalty 1.05): 26 s, 5/9, coordinates on a 100-step
  grid (0, 100, 1000): Qwen 4B does not ground in named edges. ComfyUI users got this.
- B, AcademiaSD's question, greedy: 36 s, 20 tight boxes, every text block found.
- C, named edges, greedy: 24 s, 1/9. The format, not the decoding, broke A.
- D, B plus a `name` per item, greedy injected the app's way (`sampling_mode` off, the `on`
  keys left in): 34 s, 16 boxes, woman 0.95, VOGUE 0.88; photos as object, lettering as text.
  The headlines score lower only because Qwen splits title and subtext where Fabio grouped them.
Shipped: `analyseQuestion(family)` = D's wording (byte-identical to the benched string) with the
box in the family's format: qwen `bbox_2d`, gemma `box_2d` (7.2 s all right in Rework 4), named
for an unknown model; `describerFamily()` = qwen for ComfyUI, else by endpoint model id; greedy
on both paths (ComfyUI `Generate Text.*` dotted keys, endpoint temperature 0); 20 boxes; a cut-off
answer keeps its whole items; a text item is `kind: 'text'` with `"words": caption` as its desc,
and MOSS gets it as a `text` item printing the quoted words.
- `npm run lint` clean, `npm test` 3537 pass / 0 fail; new cases in layout-boxes-analyse (family
  formats, text item, cut-off, MOSS text) and llm-service (every greedy key reaches a real
  widget of image_descriptor.json).
- Live, own `app:isolated`, FLUX.3 Klein, describer set to a Qwen endpoint model, `/llm/describe`
  answered in the page with D's real answer: a real right-click Create boxes sent the bbox_2d
  question with `greedy: true`; 16 rows in the panel, caption in the prompt; project.json holds
  16 boxes, `kind: text` on the lettering; `mossLayoutPrompt` over them: 11 text items of 16.
NOT run: Gemma 4 26B on the new question (paid, Fabio's describer); a FLUX.3/MOSS render of the
cover from these boxes (Fabio's eye).

## Not this card

Prism reads "cancelled" after every successful describe, the stock gallery Describe included
(control run, same session). Pre-existing.
