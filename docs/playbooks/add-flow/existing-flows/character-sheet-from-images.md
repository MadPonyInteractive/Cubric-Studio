# Character Sheet from Images (`character-sheet-from-images`) — the character the user already has

> A face picture (boxed) and an optional full-body picture in, the same three-panel sheet as
> [character-sheet.md](character-sheet.md) out. No LoRA, no training: the pictures are references.
> MPI-1042. Bench record (25 batches, every number below): `.agents/mpi-kanban/tasks/MPI-1042/validation.md`.

## Shape

| | |
|---|---|
| id / title | `character-sheet-from-images` / **Character Sheet from Images** |
| requiredModels | `[{ label: 'Model', models: ['qwen-image-2-1'], loras: true }]` (the user's LoRA rack, `Input_Lora_Phase1_1..6`, MPI-1036) |
| operation | `flowCharacterSheetImages` (new, `appVersionIntroduced` 2.0.1), `injector: 'headSwap'` for the box |
| workflow | `flow_character_sheet_from_images.json` (60 nodes) |
| authoring source | `tasks/MPI-1042/research/bench-tools/build_bench_v2.py <dir> --flow` wrote the raw graph; it was edited in place since (the LoRA rack, MPI-1036), so a re-run drops that |
| inputs | `image1` face (required, box step `box1`, ratio 4:5), `image2` body (optional); `positive`, `Input_Remove_Head` |
| describe | `Input_Face_Pose` (FRONT / TURNED, on the BOXED face), `Input_Body_Clothes` (only with a body) |
| head removal | IN the graph since MPI-1153, the same nodes as Character Sheet's (the layout matches): `Output_Image_2`, landed as the card's Headless version by `outputVersions`; `Input_Remove_Head` only picks the version shown. Behind an `Input_Headless` gate (default on) because the Sheet Editor's child rebuild runs this graph mid-chain and sends `false` (its own last leg removes the head). `chain` keeps the leg as `inGraph: true`, for the toggle only. See [character-sheet.md](character-sheet.md) § Two versions, one run |
| agent | `agentOpens: 'box'` (below) |

## One model: Qwen-Image 2.1

- **One sampling** of the whole 1792x1120 sheet (~65-95 s): no squeeze, keeps a turned picture's turn and
  smile, turns a frontal one inside the same pass. It follows a body picture's build and clothes. Its
  licence leaves the IMAGES non-commercial (the gate and badge are the model's, MPI-936).
- **Fabio, 2026-10-16: Qwen-Image 2.1 only, until a model as good arrives under a better licence** — then it
  replaces Qwen; check the licence first. Only Klein 9B and Qwen 2.1 were benched on THIS Flow; Qwen Image
  Edit 2511, Krea 2 and Boogu were benched on sheet EDITS only (MPI-1041 batch 9, all weak there).
- Loads the app's `qwen3vl_8b_int8_convrot` encoder; the bench ran fp8.

## The face box

The portrait COPIES picture 1, so its shape must be the portrait panel's: a non-4:5 picture came back
stretched 7%. The step locks 4:5; the graph ALSO widens any box to 4:5 round its centre (`MpiFromBox` ->
four `MpiMath` -> `MpiBox` -> `MpiBoxCrop pad`), so a box of another shape still lands right. A 0 x 0 box
(none) passes the whole picture through. The step's overflow room is sized from its ratio
(`MpiStepBox._syncOverlaySize`): sized for a square, a 4:5 box on a square picture stopped at 0.8 of its
width and cut off a mascot's ears (MPI-1306).

## The describer, three times (flowEnhance.js § describe)

- **Person or not (MPI-1306).** `Input_Character_Kind`, asked on the BOX: PERSON or OTHER. Every person
  sentence (the ear, cheek, chin, hair, the clothes caption, "arms against the thighs") turned a boxy robot
  mascot into a person in "a pink jumpsuit" with an ear. OTHER takes `Sheet_Prompt_*_Other` (shapes,
  colours, parts and proportions; "not a person: no human features, anatomy, hair or clothing the pictures
  do not show") and drops the clothes caption; the turn question is ignored. Blank (no describer: the
  Sheet Editor's child rebuild, a raw call) and PERSON keep the person wording byte for byte. The back view
  needs the head NAMED ("in every view, the back view included", "from the top of its head to its feet"):
  without it the back came out headless 2/2, as image 2 is the body with its head removed. Bench: qwen3-vl
  4B describer 22/22 (six mascot pictures OTHER, five people incl. anime PERSON, twice each); sheets 4/4
  with heads; graph patch and bench in `tasks/MPI-1306/research/`.
  **With a body picture, image 1 is an "established design that must be copied exactly"; image 2 gives
  ONLY the build and proportions, "never its markings, logos or details"** (`ship_copy.py`). A mascot's
  body picture is often a different render of it: with "the body comes from image 2" the sheet blended the
  two and redrew the chest "C" as a hexagon nut (Fabio's 3 runs, reproduced); with this wording the "C"
  held 4/4 seeds and a change in words (antennas) still landed. Legs can still run long (2 of 4).
  Without a body picture a face box cut at the chest makes the model invent a tall humanoid body; the
  same "copy exactly" wording did not fix that, so `Sheet_Prompt_No_Body_Other` is unchanged.
- **Turned or not.** Fabio: the close-up is ALWAYS three-quarter — a frontal one leaves the video model to
  invent the turn. A turned picture is copied (turn and expression kept); a frontal one is turned by the
  prompt. The describer answers FRONT / TURNED; the graph checks the text for "turned". Asked on the BOX
  (`crop: 'box1'`): on a whole torso shot it called a turned head FRONT.
- **The body's clothes.** No wording alone dressed the sheet in the body picture's clothes, clothed AND
  nude; a caption of them did, 12 of 12. The graph builds "Below the chin the character wears <answer>, in
  every view." (or "... is nude ..." on "no clothing") and puts it ahead of the user's words.

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

**Klein 9B as a second arm** (MPI-1042 to MPI-1148, removed 2026-10-16). It needed two samplings (the
portrait alone, or it squeezed it and lost the turn) and stitched them. With a body picture it copied that
picture's pose into the portrait and drew big heads on child-sized bodies (Fabio). Dropping the body
reference from pass 1 and ending its prompt on a close-up sentence fixed the portrait, not the proportions.
Bench: MPI-1148 validation.md; the graph is in git history before the MPI-1148 removal commit.
Naming the turn's side from the picture — a fixed "toward the left side of the image" is reliable, a
side-neutral wording is not. A gutter or levelling node at the join — the faint step (<= 14/255, 1 in 3)
is fine (Fabio). Qwen at a 2 MP reference or a 2048 sheet — +40-70% time, no visible detail.
