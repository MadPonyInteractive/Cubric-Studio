# MPI-1306 validation

## Box room (MpiStepBox)
The overflow padding is sized so a box of the step's ratio can cover the whole picture
(`coverH = max(H, W / ratio)`). No ratio = 1, the same room as before, so Head Swap's box step is unchanged.
Not eye-tested in the app yet: Fabio's look on a square picture is the remaining check.

## Person-or-not wording
- Describer (qwen3-vl 4B, the local one, temperature 0.2, each picture asked twice): the six mascot
  pictures OTHER 12/12; five people (front, phone, smoker, three-quarter, anime) PERSON 10/10.
- Sheets (Qwen-Image 2.1, 25 steps, Fabio's robot face + body, box widened to the whole head):
  - v1 wording: jumpsuit, ear and human proportions gone, but the back view was headless on 2/2 seeds
    (`research/v1_headless_back.jpg`). The old wording on the same seed kept the head (control).
  - v2 wording (head named in every view): head on the back view 3/3 seeds (2342348518, 42, 7) plus the
    camera mascot with no body picture (`research/v2.jpg`). Seed 7 drew its back view smaller than the front.
  - Human (PERSON, front face, seed 42): the person wording, byte for byte as before (Output_prompt checked).
- Before/after on Fabio's own run: `research/before_after.jpg`.

## Iteration 3: it drew variations of the design (Fabio, 3 runs)
Fabio's runs turned the chest "C" into a hexagon nut and added a back panel. Bench on his seed and box
(`research/fidelity.jpg`): A = shipped wording with the body picture reproduces it; B/C = no body picture,
either wording, invent a tall humanoid (his box stops at the chest); D = "image 1 is an established design,
copy it exactly; image 2 only for build and proportions" keeps the "C". D on seeds 42, 7 and his antenna run
(`research/fidelity_seeds.jpg`): "C" held 4/4, antennas landed, legs ran long on 2/4. Shipped D for the
with-body case only (`research/ship_copy.py`).
- Tests: flow-describe, inject-params-titles, flow-model-choice, flow-legs 86/86.

## Iteration 4: head-only box gives long human legs (Fabio, 2026-10-27)
Lingo (imported_001 + frame_ace45617), head-only box, seeds 42 and 7 (`research/headonly.jpg`: picture 2 as the
sampler sees it, then the sheet; head removed vs kept). SAM3's head removal took the robot's neck and most of its
torso with the head, leaving a stub: the sheet invented a human body, a mannequin with hips and long jointed legs on
seed 7. Kept whole, picture 2 gives a blocky robot body on both seeds, speech-bubble tail kept; legs still longer
than Lingo's. Shipped for OTHER only (`research/patch_keep_head.py`): a lazy MpiIfElse (node 103) on "not a
person?" sends Input_Image_2 whole to Reference 2, so the head detection on picture 2 (nodes 31-37) does not run; the wording became KEEP_WB, then MERGE_WB in round 2 (below). A person
keeps the head removal. Flow tests 308/308.
- KEEP_WB ("copy image 2's body") brought the chest hexagon back on the "C" robot 2/2 (`research/closeup1.jpg`, bottom row).
- Close-up "head alone" (HEAD_CU): floating head, no body, 3/4 (`research/closeup1.jpg`).
- Round 2 (`research/closeup2.jpg`, shipped by `ship_round2.py`): MERGE_WB (image 1 wins on every part it
  shows; image 2 gives build plus the parts image 1 lacks) + CHEST_CU ("head and the top of its chest").
  Close-up head + top of chest 4/4; Lingo keyboard and bubble kept; "C" held 1/2 (seed 42 hexagon again).
  Flow + workflow tests 308/308. Fabio in the app, 2026-10-27: "this is better" (camera, clapper and headphone
  mascots); typing the build in Changes ("short tiny legs, boxy") helps further.

## Status bar during "Drawing the sheet"
One sampler bar per run (Fabio's runs in app.log), recorded as `single: 1` in `js/data/progressStages.js`. The
"Stage 1, no latents" before it was the agent bench posting to the app's own engine: stdout bars are engine-wide,
and that bench's previews went to the bench, not the app.
