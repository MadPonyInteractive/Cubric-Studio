# Character Sheet from Images (`character-sheet-from-images`) — the character the user already has

> A face picture (boxed) and an optional full-body picture in, the same three-panel sheet as
> [character-sheet.md](character-sheet.md) out. No LoRA, no training: the pictures are references.
> MPI-1042. Bench record (25 batches, every number below): `.agents/mpi-kanban/tasks/MPI-1042/validation.md`.

## Shape

| | |
|---|---|
| id / title | `character-sheet-from-images` / **Character Sheet from Images** |
| requiredModels | `[{ label: 'Model', models: ['qwen-image-2-1', 'klein-9b'] }]` — the user picks; Qwen is `models[0]`, the recommended arm |
| operation | `flowCharacterSheetImages` (new, `appVersionIntroduced` 2.0.1), `injector: 'headSwap'` for the box |
| workflow | `flow_character_sheet_from_images.json` (Qwen, 60 nodes) + `byModel['klein-9b']` = `flow_character_sheet_from_images_klein.json` (93) |
| authoring source | `tasks/MPI-1042/research/bench-tools/build_bench_v2.py <dir> --flow` writes both raw graphs; without `--flow`, Fabio's two bench graphs |
| inputs | `image1` face (required, box step `box1`, ratio 4:5), `image2` body (optional); `positive`, `Input_Remove_Head` |
| describe | `Input_Face_Pose` (FRONT / TURNED, on the BOXED face), `Input_Body_Clothes` (only with a body) |
| chain | `flowCharacterSheetHeadless` when `Input_Remove_Head` — the same leg as Character Sheet; the layout matches |
| agent | `agentOpens: 'box'` (below) |

## Two arms, two graphs

- **Qwen-Image 2.1 — one sampling** of the whole 1792x1120 sheet (~65-95 s): no squeeze, keeps a turned
  picture's turn and smile, turns a frontal one inside the same pass. It follows a body picture's build and
  clothes. Its licence leaves the IMAGES non-commercial (the gate and badge are the model's, MPI-936).
- **Klein 9B — two samplings, stitched** (~50-80 s). In one pass Klein squeezed the portrait (sx/sy
  0.92-0.96) and dropped the picture's turn; the portrait sampled alone on 896x1120 fixed both. Pass 2
  draws the body views on their own 896x1120 with the finished portrait as a reference. With a body,
  pass 1 also sees the body and pass 2 sees ONLY portrait + body (picture 1 there outvoted the body).
- Klein carries the app's word-triggered NSFW LoRA (`klein-9b-lora-nsfw`, a klein-9b dep) exactly as
  `klein_t2i_template.json` #43 does; the LoRA-off path is pixel-identical to the graph without it.
- The Qwen arm loads the app's `qwen3vl_8b_int8_convrot` encoder; the bench ran fp8.

## The face box

The portrait COPIES picture 1, so its shape must be the portrait panel's: a non-4:5 picture came back
stretched 7%. The step locks 4:5; the graph ALSO widens any box to 4:5 round its centre (`MpiFromBox` ->
four `MpiMath` -> `MpiBox` -> `MpiBoxCrop pad`), so a box of another shape still lands right. A 0 x 0 box
(none) passes the whole picture through.

## The describer, twice (flowEnhance.js § describe)

- **Turned or not.** Fabio: the close-up is ALWAYS three-quarter — a frontal one leaves the video model to
  invent the turn. A turned picture is copied (turn and expression kept); a frontal one is turned by the
  prompt. The describer answers FRONT / TURNED; the graph checks the text for "turned". Asked on the BOX
  (`crop: 'box1'`): on a whole torso shot it called a turned head FRONT.
- **The body's clothes.** No wording alone dressed the sheet in the body picture's clothes on both models,
  clothed AND nude; a caption of them did, 12 of 12. The graph builds "Below the chin the character wears
  <answer>, in every view." (or "... is nude ..." on "no clothing") and puts it ahead of the user's words.
  "nude" is deliberate: it is on the Klein NSFW LoRA's trigger list, "unclothed" is not.

## Prompts

Style-neutral ("the same visual style and medium as image 1"): a user's character can be any style. The
turn sentence says "nothing added that image 1 does not show" — naming piercings and tattoos made both
models ADD them to clean faces. The user's words replace `[CHARACTER PROMPT]` right after the reference
sentences; a haircut asked there beats the picture's hair on both models (risk 4, batch 24).

## The agent opens it at the box

`look`'s box gate (agentLoop.mjs) refuses a box over 0.6 of the picture as "the whole person" — Head
Swap's head-only bound. A head-and-shoulders box on a portrait picture is most of it, so the agent fills
the pictures and words and opens the box step. A per-step bound there is what would let it run.

## Dead ends (do not retry)

One-canvas inpaint orders for Klein (portrait then bodies on one 1792x1120) — the squeeze stayed. Naming
the turn's side from the picture — a fixed "toward the left side of the image" is reliable, a side-neutral
wording is not. A gutter or levelling node at the join — the faint step (<= 14/255, 1 in 3) is fine (Fabio).
Qwen at a 2 MP reference or a 2048 sheet — +40-70% time, no visible detail.
