# LTX 2.3 Reference to Video (Ingredients IC-LoRA)

> Op `ref2v_ms` ("Reference to Video") on BOTH LTX 2.3 cards (`ltx-23`, `ltx-23-balanced`), shipped by
> MPI-1060 (2.1). Several pictures go in, the app composes them into ONE reference sheet, and Lightricks'
> Ingredients IC-LoRA makes a clip whose people, places and props look like that sheet. Evidence:
> `.agents/mpi-kanban/tasks/MPI-1060/research/results.md` (bench) and `validation.md` (live app runs).

## What it is, and what it is not

- **A look-alike adapter, trained on IMAGES.** One composite sheet, repeated to the clip length, enters as a
  full-clip IC guide. The clip borrows what things LOOK like; the prompt says what HAPPENS.
- **Not a video reference.** A clip as the guide comes back as a near frame-for-frame copy of that clip
  (bench `ref_video`). So the LTX op has no video slots (`multiRefMedia` gates them to H3).
- **Not keyframe interpolation.** Landing on several given pictures in turn is a different technique; not built.
- Composes with the shipped graph's other paths: a **start frame** (opens on that picture, identity holds),
  a **supplied audio** (lip-sync to it), a **voice clone** (talkvid ID-LoRA after the Ingredients LoRA).
- Runs on our int8 distilled transformer as-is: no dev checkpoint, no distilled LoRA.

## The weight

| Field | Value |
|---|---|
| Dep id | `ltx23-lora-ingredients` (`js/data/modelConstants/loraDeps.js`) |
| File | `loras/ltx-2.3/ltx-2.3-22b-ic-lora-ingredients-0.9.safetensors` |
| Bytes / sha256 | 1,308,778,338 / `515e4e13...abeed19559` (equals upstream HF lfs sha) |
| Hosting | R2 `vision/models/loras/ltx-2.3/` + HF re-host `Mad-Pony-Interactive/cubric-studio` (upstream repo is gated) |
| Licence | LTX-2.x community licence (same as the base) |

A **flat dep on both LTX cards** (decision D1): the graph names the LoRA on every run, and a LoRA a graph
names but the disk lacks fails EVERY LTX op at validation. Existing installs fetch the 1.31 GB once, like
talkvid and transition. Per-op install groups (download only when the op is used) were retired 2026-08-07;
reviving them is the scalable answer once LTX 2.5's 17 IC-LoRAs arrive.

## The graph (one template, two variants)

`comfy_workflows/raw/ltx_i2v_t2v_template.json` -> `generate_ltx.py` -> `ltx_i2v_t2v.json` (High, bf16) and
`ltx_i2v_t2v_int8.json` (Balanced). The branch is nodes **900-915**, spliced by
`research/bench-tools/raw_insert.py` as its own group; no existing node moved.

- **Fill-driven, not op-driven.** Everything keys off `Input_Image` (MpiLoadImage, `block_if_empty` False)
  `loaded`. With no sheet the branch is a true no-op: t2v and i2v ran **byte-identical** (framemd5) to the
  pre-change graph on the same seed.
- IC LoRA sits after `191` (Transition LoRA) behind an MpiIfElse and re-points `Set_model #522`, so both
  stages and the ID-LoRA path get it. `latent_downscale_factor` is baked to 1 (the file's metadata says 1).
- Sheet -> resize (pad, black) -> `RepeatImageBatch`, **amount = `#76` frames** (must match, or the guide is
  short).
- **Variant A (the shipped one):** stage-1 guide on `212`/`143` at the source, crops `46`/`334` remove the IC
  frames before `568`/`123`; the guide is **re-added at stage 2** on the upsampled latent (`586`/`123`, the
  lipdub pattern) and a new `LTXVCropGuides` feeds `349.false` before decode. Variant B (IC model at stage 2,
  no guide) is cheaper but loses exactly the fine detail (freckles, smile lines) the sheet is for.
- Traps: `#70` LTXVNormalizingSampler scales guide frames by 1.1; a continue run must re-inject the sheet;
  mode-4 bypass is not a runtime toggle; the latent preview's tail shows one reference frame (cosmetic).

**LTX 2.5 prep:** the branch is model-agnostic. The LoRA filename and the loaders are the only 2.3-specific
values, so 2.5 is a re-point, not a rebuild.

## The sheet composer

`routes/ingredientsSheet.js` (sharp), served by `POST /engine-sheet` (`routes/projects.js`, writes
`<uuid>.sheet.png` into ENGINE_SCRATCH, 24 h sweep). The renderer calls it from
`_composeReferenceSheet(params, modelDef)` in `js/services/commandExecutor.js`, before the fit steps, so the
local engine and a Pod both receive ONE `Input_Image` file. Gate: `capabilities.referenceSheet` on the model
plus a filled `Input_Image`; Picture 2-9 carry `compositorInput: 'referenceSheet'`.

Layout = a slicing-tree search over WHOLE pictures, stretched to the canvas. Each rule below is a failed clip:

| Rule | What broke without it |
|---|---|
| Tile the canvas: grey cards, black only in 12 px gutters (76-79% picture coverage) | big black areas -> the clip COPIES the sheet layout (split screen) |
| A character stays in ONE cell with all its views | a back-view cell became a SECOND person |
| Characters >= 45% of the sheet (soft score term), no picture under 60% of its fair share | identity drifts |
| Only a SETTING may be centre-cropped (>= 60% kept); characters and props never | lost detail |
| Sheet takes the clip's shape, long edge 1920 (`Input_Width/Height`) | |

The 45% floor is soft: a PORTRAIT sheet can give a prop a slightly bigger cell than the character (37% vs 35%
on the live 9:16 run). The clip held anyway.

One picture still runs the prompt rewrite; the file passes through untouched.

## The prompt shape (decision D5)

The user (or Cosmo) writes one line per picture, then the scene in plain words with no tags:

```
<Picture 1> Maya, a woman in her early 30s with dark curly hair and faint freckles, mustard-yellow sweater
<Picture 2> setting: a narrow mountain hiking path at dusk, golden light through pines
<Picture 3> prop: a blue-framed canvas backpack with a brown leather patch

She tightens the backpack straps and keeps climbing as the light goes.
```

The app rewrites it into the Ingredients two-section prompt: `### Reference Sheet Description` with the
composer's cell names (`**Left Panel (Character):** ...`), then `### Target Description` with the scene. The
card keeps the user's words; only the run gets the rewrite.

- **Role words are optional** (`character:`, `setting:`, `prop:` and synonyms). `sheetRoles`: an unlabelled
  Picture 1 is the character unless another line says `character:`. Before this rule the help example left
  Picture 1 outside the character set, and the 16:9 and 9:16 runs copied the sheet layout.
- **Every picture needs a real description.** A bare tag gets drawn as a web-page collage of labelled cards;
  two-word labels ("the backpack") lose the prop. Described lines make it rare, not impossible: 1 of Fabio's 9
  live clips (`ref2v_007`, MPI-1084) still opened on ~0.75 s of collage. Not the length: the same pictures at 3 s
  and 5 s (`ref2v_008`/`009`) opened clean. Seed-bound, like the bench's; a reroll is the user's fix.
- A prompt that already holds `### Reference Sheet Description`, or has no described line, goes as written.
  An undescribed picture stays on the sheet with no line. `<Picture n>` inside the scene is left as typed.
- Taught in the prompt box's ? help (`help.byModel.ltx`), the agent guide `docs/agent/models/ltx-2.3.md`, and
  the enhancer recipe's `r2v` mode (`js/data/recipes/ltx-2.3.recipe.js`). The enhancer is text-only: it
  fills a missing description only from the user's words, never from the picture.

## Start frame

On an op with an `inputStartFrame` slot, each picture's tag in the prompt box is a toggle: click it and that
picture becomes **Start frame** (role `inputStartFrame` -> `Input_Start_Frame`), click again and it is
Picture n again; one at most. The start frame is NOT on the sheet. Agents pass role `inputStartFrame`.
Desktop spec: `tests/desktop/prompt-box-start-frame-toggle.spec.js`.

## Measured (RTX 4060 Ti 16 GB, Balanced int8)

| Run | Shape | Time |
|---|---|---|
| Bench, variant A, sheet only | 960x512, 5 s | 170 s |
| Bench, variant A + start frame | 960x512, 5 s | 126 s (encode cached) |
| Live app, prompt box, 3 pictures | 512x512 (medium tier), 3 s, audio | 169 s |

Same seed reproduces frame-exact (two live runs, equal md5).

## Where the evidence lives

- Bench scripts: `.agents/mpi-kanban/tasks/MPI-1060/research/bench-tools/` (`ingredients_run.py`,
  `two_stage_run.py`, `layout_run.py` = the composer's Python original, `raw_insert.py`).
- Clips (bench + Phase 5 previews): `C:\AI\MPI-1060-out\` on Fabio's machine, not in the repo.
