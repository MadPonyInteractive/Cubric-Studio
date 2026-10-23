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
- Gemma 4 26B (DeepInfra, Fabio's describer) on the shipped `analyseQuestion('gemma')`
  (`box_2d`), temperature 0, same cover, `research/qwen-bench/gemma.mjs`, 2 paid runs,
  $0.00109 total (quoted ~$0.0006: 20-item answers are longer): 24.8 s / 16.6 s, 17 / 15 boxes,
  13 / 11 text, mean best-IoU 0.53 / 0.55 (Qwen-4B D: 0.57), woman 0.83-0.86, VOGUE 0.68-0.81,
  "Style Speaks Louder" 0.94-0.96, "More Self Love" 0.80-0.85. Gemma splits headline and
  subtext like Qwen; no swapped boxes.
NOT run: a FLUX.3/MOSS render of the cover from these boxes (Fabio's eye).

## Not this card

Prism reads "cancelled" after every successful describe, the stock gallery Describe included
(control run, same session). Pre-existing.

## Rework 7 (2026-10-23): Fabio's eye + the bigger panel

Fabio, own app, Gemma 4 26B describer, after a reload only (no restart, so `routes/llm.js`
greedy/temperature 0 from 25763cc78 was NOT live): 17 boxes on the Vogue cover, lettering as
quoted text, "not bad, almost there", but ~2 min. Not the queue (describe is on the `cloud`
lane, the engine's back-to-back FLUX.3 batch did not hold it) and not local Ollama (none
loaded): the time is in the one DeepInfra call. Added an `llm describe <model>: N ms, N tokens
out` line to `/llm/describe` so his next run after a full restart says which.

Panel (Fabio: stop 200 px below the window top, rows scroll, a drag separator, picture scales):
- `MpiBoxesPanel` sets its own height = bar top - 200 (min 260), list `overflow-y: auto`,
  frame = min(stage width, stage height x aspect); an `MpiResizeHandle` sash sets
  `--boxes-side-w` (280 px to stage 200 px).
- Live, own `app:isolated` (:52788), FLUX.3 t2i, 10 drawn boxes: 1600x1000 panel top 200,
  1:1 frame 706 px band; 1600x720 panel 200..626, list 246/454 px (scrolls, bar visible),
  frame 397 square; sash dragged right -> list wider, frame shrank to fit. eslint clean,
  boxes tests 30/30, llm tests 33/33.
- Not live-checked: a tall guide picture (Create boxes would run the describer on Fabio's engine).

## Rework 8 (2026-10-23): second Create boxes "kept the previous boxes"

Fabio, own app after a full restart: Tokyo then Vogue. Log: both describes ~23 s greedy
(1326 / 1169 tokens), so the 2 min was the reload-only server. The Vogue run's boxes and caption
did not land; no toast, no error, no uncaught line in app.log.
- One paid Gemma 4 run on the Vogue cover, exact app question, temperature 0 ($0.00063, 34.7 s,
  1722 tokens): `boxesFromAnalysis` -> 17 boxes + caption. Not a parse failure.
- Own `app:isolated`, real right-clicks, `/llm/describe` answered in the page: small canned
  answers (0.8 s and 23 s) and the two REAL Gemma answers, Tokyo then Vogue: the second run
  replaced boxes and caption every time. NOT reproduced.
- Added: `Create boxes: N boxes from M chars, op X -> Y` and a `describe cancelled/failed` line
  in `_analyseBoxes`, so the next drop names its exit (seen live in the isolated log).
- Found and fixed meanwhile (breaker): a long caption grows the prompt box and the panel kept
  its height, riding up over the header and gallery. The box now observes its own size and
  calls the panel's `fit()`. Live: bar 216 px tall, panel 200..752.
- eslint clean; boxes + prompt box tests 34/34.

Rework 8b: Fabio's app log names the drop: 01:14 Tokyo and 01:15 Vogue, Gemma answered (3925 / 5096 chars) and `boxesFromAnalysis` read 0 boxes -> the "found nothing" toast (his "kept the old boxes"). A bare `"` inside a text value nulls a whole saved answer (tested); a raw line break does not. The answer is now logged on a 0-box read. Next run (01:19) parsed: 18 boxes, but 115.7 s for 1905 tokens on DeepInfra (other runs 15-23 s): the provider's speed, not the app.

Rework 8c: describer bench, Vogue cover, app question per family, temperature 0, best-IoU vs Fabio's 9 boxes (`research/qwen-bench/vlbench.mjs`, answers q30_*/q235_1.txt). Gemma 4 26B (saved): 0.53/0.55/0.55, 4-5/9 hits. Qwen3-VL-4B local: 0.57. Qwen3-VL-30B (DeepInfra): 0.60/0.61, 6-7/9, 53/83 s, $0.0009 a run; names some boxes text_block_N. Qwen3-VL-235B: 0.54, 4/9, 264 s, $0.0019; run 2 hit Node fetch's 300 s headers timeout (may still bill). Spent $0.0038 seen + up to ~$0.002 unseen. The app's /llm/describe is the same Node fetch: a describe over 300 s fails as 'fetch failed'.

Rework 9 (2026-10-23): the "found nothing" cause. Bazaar cover 08:22 + 08:23, Gemma 4 asked for `box_2d` answered valid JSON with every box as `"box": [y1, x1, y2, x2]`; `_edges` read `box` only as an object, so all 10 items dropped. Fix: a bare `box` array reads in the asked family order (`boxesFromAnalysis(text, family)`). Replay of both logged answers: 10 boxes each, masthead top, headline bottom-right. Test added; boxes tests 9/9, eslint clean.

Rework 10 (2026-10-23): Fabio, Bazaar on MOSS: boxes transposed + model switch changed them. (a) No describe model pinned -> `describerFamily` saw no id -> `named` question; Gemma (the DeepInfra default) answered `"box": [y1,x1,y2,x2]`, read x-first = every box mirrored on the diagonal. `/llm/models` now returns `describers` per connection, `describerFamily` falls back to it (server change: full restart). (b) Boxes were saved per model, so FLUX.3 -> MOSS-Image loaded MOSS's own older set; a box save now goes to every model taking boxes on that op. Tests 25/25 boxes files.

Rework 11 (2026-10-23): snap pass. Fabio: Bazaar boxes "not very accurate" (text blocks a line low, first line outside). `snapBoxes` fits each describer box to the picture's ink: window = box +25% +2.5%, ink = |luma - window border median| > 32, ink joined within 1.2% W / 0.6% H (letters, lines; not a rule or paragraph 2%+ away), box = tight edge of the blocks it covers >= 25%. Left as drawn when a block runs out of the window (lettering on a photo, hair over the masthead), IoU < 0.4, or growth > 1.6x. Bench `research/snap/snapbench.mjs` on saved answers, <= 1024 px, 30-70 ms: Bazaar Gemma 4/10 snapped, all four left text blocks now whole (e.g. denim 290-412 -> 294-412, meet_the_real 30..126 -> 26..157 takes IVANA ESSL); Vogue 2-6 of 15-17 snapped, mean best-IoU vs Fabio's grouping unchanged (0.53/0.55/0.57/0.60), the woman stays loose. Same 4-of-10 pixels in a real Chromium canvas (browser pane page running the app's code). Not snapped: the woman, masthead, "Art of Mystery" (they touch in the picture; SAM3 is the tool for those). Test added.

Rework 12 (2026-10-23): Fabio, Bazaar after restart: boxes mirrored again, "snapped 0 of 10". His saved describe backend reads `comfy` while Gemma 4 answered, so the asked family is a guess that can miss. Fix: Create boxes reads by the model that ANSWERED (`res.model` -> `familyOf`), and an array of any key is read in that family's order (Gemma y-first under `bbox_2d` too, per Rework 4). Log now names asked vs read family + model. Tests 25/25 boxes files.

Rework 13 (2026-10-23): Fabio: "works with any model", no model-specific reading. Reading is now model-blind: `fitAnalysis` reads the answer both ways (yx, xy) plus the key's own order, snaps each, and keeps the reading whose boxes land on ink (sum of snap IoU); no ink either way = the key's order. `familyOf` dropped. `research/snap/orderbench.mjs`: 6/6 right (Bazaar Gemma `box`, Vogue Gemma x2 `box_2d`, Qwen 4B/30B/235B `bbox_2d`), the wrong reading fits 0.00 every time vs 1.34-4.61. The question stays per family (the bench showed a model grounds tight only in its trained format); an unknown model is asked named edges. Tests 28/28 boxes files.

Rework 14 (2026-10-23): Fabio: pressing a box tag should light its row, a row should light its tag. `MpiBoxesPanel._select(i)`: tag pointerdown or row pointerdown/focusin picks a box; the tag turns the workspace accent with an ink-1 ring and the border thickens, the row field takes the box colour (28% over surface-3); kept across re-renders, reset on open. Live, own app:isolated (:53148, throwaway project, deleted after), FLUX.3 t2i, 2 drawn boxes: tag box1 -> box [true,false] row [true,false]; row 2 field -> box [false,true] row [false,true]; zoom shows the pink ringed tag + tinted field. Run log 09:18Z also shows the question was "asked named" for Gemma: the asked-family guess still misses in Fabio's app (reading no longer depends on it).


Rework 15 (2026-10-23): Fabio's 'missing first line' was the box's name tag painted over it. `.mpi-boxes__tag` now sits ON the box's top edge, outside it (bottom: 100%, left: -border, like a folder tab); a box with y < 0.04 (`TAG_IN_Y`, set in `_place` so a drag updates it) gets `--tag-in` and keeps its tag in the corner. Darken persists: `STORAGE_KEYS.BOXES_DIM` + `Storage.getBoxesDim/setBoxesDim` (0-100), read at setup, written on the bar's change (wheel fires change too). Live, own app:isolated (:65130, throwaway project deleted after), panel mounted with an SVG of a masthead + a two-line block: top box tag-in, tag inside its corner; block box tag bottom = box top + 2px (on the border), first line fully visible in the zoom. Darken set 40 -> localStorage '40' -> destroy + remount: label 40%, slider 40, picture brightness(0.6). eslint clean.

Rework 16 (2026-10-23): Fabio's Tokyo/Vogue prompts still held Bazaar's caption. Cause: `_autoCaption` (the last caption Create boxes wrote) lived only in the PromptBox closure while the prompt lives in `state.promptDraft`; any remount (leaving the gallery, reopening the project) restored the caption but reset `_autoCaption` to null, so the old caption read as typed and no later Create boxes replaced it. Fix: `_autoCaption` rides in the draft (`autoCaption`), and a box rename that rewrites a tag in the auto caption keeps it auto. Live, own app:isolated (:52586, throwaway project deleted after), `/llm/describe` stubbed in the page (no model cost), MOSS-Image t2i: run 1 caption written; run 2 replaced it; project reopened (PromptBox remounted, caption restored) -> run 3 replaced it (fix); draft's autoCaption dropped to mimic the old code, remount -> run 4 left run 3's caption (old bug reproduced). eslint clean.

Rework 17 (2026-10-23): zoom pass. Fabio's Gemma 4 runs snapped only 2/15 (Tokyo) and 3/17 (Vogue): text on photos cannot be fitted by ink, so those boxes were the model's raw guess. After fitAnalysis, every box the ink did not fix and under 10% of the picture (`zoomTargets`, max 12) is asked about again: `zoomCrop` pads it by half its long side + 4%, `POST /llm/zoom-crop` writes that crop ENLARGED to 1 MP (up to 4x, lanczos) to os.tmpdir()/cubric-describe-zoom (swept after 1 h) for either describer - a plain `crop` on /llm/describe gives the model the same pixels, since a 736x1104 cover is already under the 1 MP cap; `zoomQuestion` asks in the describer's own box format; `fromZoom` maps the answer back and keeps the first box when the answer is empty, the whole crop, or misses the box (IoU < 0.1); the moved box is snapped again. All crops queue at once (a row + Stop each). Checks: 2 new unit tests (14/14 in layout-boxes-analyse), eslint clean; own app:isolated: /llm/zoom-crop on the Bazaar cover's side block returned an ~4x enlargement (looked at it), served 200 via /project-file, bad crop -> 400. NOT yet checked: whether the moved boxes are better on real covers (needs real describer calls in Fabio's app, routes/ change = full restart).

Rework 18 (2026-10-23): Fabio's first zoom-pass runs (full restart, Gemma 4 26B): Bazaar 'perfect' (order key, snapped 4, zoomed 4 moved 4 in 6 s); Tokyo 'failed hard' - every box on its side. Log: `order xy, snapped 1` - one stray snap on a photo collage beat the key's reading and flipped all 15 boxes (zoomed 12, moved 1, 11 s). Fix: `fitAnalysis` keeps the key's order unless another reading snaps 2+ boxes AND fits 1.0 more. orderbench 7/7 (new Tokyo case rebuilt from the boxes his app saved; with the right picture imported_23c5448e both old and new rules read it yx, so his exact flip did not replay offline - his canvas pixels differ from sharp's, and the margin was that thin). Unit test now uses two blocks and asserts one stray snap cannot flip the order; 28/28. Also: the frame took the picture's ratio only after the read, so a new picture sat squeezed into the last one's frame for the whole wait (Tokyo after Bazaar). The ratio is now applied before the describe. Live, own app:isolated (throwaway project deleted after), 3 s stubbed describe: frame aspect during = after (Bazaar 0.792, Vogue 0.627). The leftover stretch is the nearest supported ratio vs the picture (Bazaar 0.763 -> 0.792), by design (the guide is drawn to the frame).

Rework 19 (2026-10-23): Fabio after a full restart (Gemma 4): Bazaar spot on (zoomed 4, moved 4); Tokyo now order key, zoomed 10 moved 8 - better, still rough on a complex collage; Vogue 'quite a few right' (zoomed 12, moved 8, 21 s). Vogue's prompt kept Tokyo's caption: clicking a box NAME cites `<name>` into the prompt (`_insertPromptText`, the panel's only caller), which counted as the user's edit. A cite now keeps the caption replaceable, like a rename. Inferred from code + log (no cite is logged), not reproduced. UI asks: an X in the panel's top-right corner (moved out of the list header) and Escape closes the panel - registry entry `boxes.close`, bound only while open, skipped when a menu/overlay takes that press or a field is focused (Escape then blurs first); hotkeys page lists it. eslint clean, npm test 3552/3552. NOT live-checked: app:isolated died at ~2 s on the userData lock - another agent's instance (since 09:46) holds cubric-agent-profile; left alone.

Rework 20 (2026-10-23): Fabio's reload check passed (corner X, Escape, a name click no longer freezes the caption). Cue on the moodboard: MOSS-Image and FLUX.3 both laid out like the source (FLUX.3 added colons to "MOODBOARD:" / "oceanic:"; swatch colours drift). Storyboard (736x1308, Gemma 4): (a) panel 7B missing - the answer hit MAX_BOXES exactly (20 = title + 9 panels + their captions, in reading order); cap raised to 30. (b) panels left where the model drew them - joined ink chains each frame to the next through the captions and runs out of the window, and a window crossing grey panels as much as white paper takes a grey middle tone, so the paper reads as ink. `snapBoxes` now tries a second, frame-only pass when the first leaves a box: ink against the border's COMMONEST tone, unjoined, the box = the biggest block alone, accepted only if its whole outline is inked (a photo fragment's is not). Replay of the saved storyboard boxes: 8 of 9 panels on their frames (was 0; 4C still left). snapbench old -> new: Bazaar unchanged; Vogue Gemma 1 0.53 -> 0.55, Gemma 2 0.55 = 0.55, Qwen 4B 0.57 -> 0.56, Qwen 30B 0.60 -> 0.59 - the dips are photo boxes snapped to the photo's own edge (4B and 30B agree on it), where Fabio's truth boxes take in the text round the photo. orderbench 7/7. (c) A Cue pressed while Create boxes reads ran the LAST picture's prompt + boxes (a cloud read does not hold the local queue, by design). Cue/Ctrl+Enter now wait for the running Create boxes (`_analysis`, through its zoom pass and apply) and say so in a toast. Checks: new unit test (storyboard frame; fails on the old code, checked), cap test 30; boxes tests 38/38, eslint clean, npm test 3553 pass / 0 fail. NOT live-checked: the Cue wait (needs Fabio's reload).

Rework 21 (2026-10-23): Fabio, storyboard after the reload: all 10 panels in (7B too), panels on their frames, and a Cue pressed during the read waited for the new boxes (verified by Fabio). Both models printed a colon after lettering ("STORY BOARD:", FLUX.3 "MOODBOARD:" / "oceanic:") and MOSS printed quotes (“MOODBOARD”): the box desc `"WORDS": looks` reached them as written. Now, at prompt build only (saved boxes and the field keep their text, so older boxes are fixed too): FLUX.3 rows (`layoutRows`, also the enhancer's input) read `looks. The lettering reads "WORDS"`, nothing after the closing quote; a MOSS text item keeps `text: WORDS` and its caption is the looks alone. A desc not in that shape, or a box without kind text, is left as typed. Tests: 2 cases added (16/16 in layout-boxes-analyse), eslint clean, npm test 3554 pass / 0 fail. NOT yet seen: fresh renders without the colon (Fabio).

Rework 22 (2026-10-23): Fabio, moodboard re-run: no colon, no quotes on either model (fix verified). Vogue: layout close on MOSS + FLUX.3; missing the grey backing panels behind the left-column text (the describer never lists them), the eye close-up inset came out a face portrait. Cue pressed during a read: waiting ran EVERY waiting Cue on the model picked by the time the read ended (he cued MOSS, switched to FLUX.3, cued: two FLUX.3 runs). Now refused with a toast ("Create boxes is still reading the picture...") before the box marks itself generating; the Ctrl+Enter hotkey and a loop seed are refused the same way. Boxes panel drew no new box past 10 while Create boxes makes up to 30, so a missing backing panel could not be added by hand: one shared `MAX_BOXES` (30, exported from layoutBoxes.js). eslint clean, npm test 3554 pass / 0 fail. NOT live-checked: the refusal toast (Fabio's reload).
