# MPI-1148 validation - Klein pass 1 of Character Sheet from Images

Bench: G:\ComfyUi (engine 0.39.0), the SHIPPED runtime graph with title-addressed inputs (MPI-1042
`run_api.py`), under `gpu_lease.py`. Builder `research/variants.py <dir> <round>`, runner `research/bench.sh`,
contact sheets `research/contact.py`. Outputs and pictures stay OUT of the repo: `G:/ComfyUi/ComfyUI/output/mpi1148/`.

Fabio's case (2026-10-15, Qwen 2.1 project flowCSFI_009 / _010): a face picture of one man (turned, bare
shoulders) + a full-body picture of another (grey tee, sweatpants, hands in pockets), caption "a grey t-shirt
and black sweatpants", box 614x768, his seeds 3034548662 ("Freakishly large arms, Army boots") and 452508749
("Army boots"), plus seed 42 with no words / "A short buzz cut, Army boots".

## Steps (Fabio's first ask)

Already 25: `flow_character_sheet_from_images.json` #56 KSampler steps 25 since MPI-1042, raw and runtime, and
nothing injects steps at run time. No change.

## Round 1 - A shipped, B framing first + chest crop, C no body ref in pass 1, D = B + C

- **A reproduces the bug 3 of 3:** the portrait panel is the body picture's pose - full length with boots
  (arms, boots), waist-up with hands in pockets (no words); the face drifts toward the body picture's man.
- B: full / 3/4 body on boots, waist-up on the rest. Framing first does not hold.
- **C, no words: a real close-up, the closest likeness of the run.** With "Army boots" still full / 3/4 body.
- D: worse than C (no words went waist-up; a ghosted arm on boots).
- Two causes: the body reference sets the framing; words naming the lower body set it again.

## Round 2 (on D) - E + a framing sentence AFTER the words, F no user words in pass 1

- E close-up on boots and buzz cut, chest-up on arms. F waist-up / a seated pose. The sentence after the words works.

## Round 3 (on C) - G no user words, H + the closing sentence

- **H: close-up 3 of 3** (arms chest-up with the big arms - what was asked), no boots in any portrait.
- G: close-ups but a stray waistband band across the portrait 3 of 3. Out.
- Buzz cut: partly taken (a shorter fade) on C and H; not a regression - D / E / F all kept the long top.

## Round 4 - regression, A vs H, MPI-1042's batch-22 pictures

- PF (phone face + white tank / jeans body), seeds 42, 7: **H white tank on the portrait 2 of 2** with no body
  reference - the caption carries it. Body views unchanged (tank, jeans, heavy build).
- PN (nude body), seed 42: H bare shoulders, nude body views - same as A.
- No body (3/4 man, frontal man), seed 42: portraits match A; turn and smile kept, piercings unchanged.

## Shipped

`research/apply_fix.py` applied H to both Klein graphs (raw + runtime): #53 #54 #71 #72 removed, #52 ends on
the close-up sentence. The runtime graph equals the tested H node for node. `npm test` 3331 pass, 0 fail.

Open: Fabio's eye on his own pictures in the app (the bench is the G: engine, not his).
