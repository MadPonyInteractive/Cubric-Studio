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

## Not this card

Prism reads "cancelled" after every successful describe, the stock gallery Describe included
(control run, same session). Pre-existing.
