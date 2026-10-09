# MPI-1041 - Character Sheet Editor - plan

Bench-phase plan. Direction and the five bench questions are in `brief.md`; the Flow plan
(`/mpi-create-plan`) is written from the bench verdicts, not before.

## Current State

**2026-10-09 late (session 308d9f00) - BENCH DONE (validation batches 1-8). Waiting on Fabio's
field call, then `/mpi-create-plan`.** Verdicts:
- Clothes / Accessories (Q1, Q4): PASS - L1 wording, whole sheet, ONE Klein edit at the exact size
  (`megapixels` = w*h/2^20), per-panel SAM3 "head, hair" lock on the masked path (72 s).
- Story state (Q2, "beaten up"): PASS 6 of 6 free (it edits the face, so no lock).
- Hairstyle: PASS - per-panel SAM3 "face" lock on front + portrait ONLY (the back of a head reads
  as a face); free edit 5 of 6 as fallback.
- Headless sheet (Q5): the Clothes lock keeps it headless 3 of 3; free regrows the head; union the
  headless chain's plate mask to harden it.
- **Body shape and Age: FAIL** on Klein 9B in plain / panels-named / two-pass (batches 5-6).
  Agent pick: drop both fields from v1. Fabio's call.
- Untested: two fields in one prompt (clothes + hair -> face lock only?), more seeds, a male sheet.

**NEXT (Fabio 2026-10-09): bench Body shape + Age on OTHER editors before dropping the fields, in
this order: 1. Qwen-Image 2.1 edit, 2. Boogu Edit balanced (`boogu-edit-balanced`), 3. Qwen Image
Edit (`qwen-edit`), 4. Krea 2 edit.** All so far was Klein 9B only (SAM3 only builds masks).
**EXACTLY 5 edits per model, no more** (Fabio: "don't try 10 or 20 or 8 batches") - one run per
model, seed 42, these 5 cases: muscular (nude), heavyset (photo), skinny (nude), older (photo),
younger (fisher). Batch 5's L1 wording; `layout.py` gate. Find each model's app graph + edit op
titles first (models.js / comfy_workflows); Boogu takes ONE image only. Qwen 2.1 is
non-commercial - fine for a bench.

**Earlier the same day - Q1 PASSED (batch 3), Q4b running (batch 4).** The wording that
works is **L1**: `Dress her in {outfit}. Dress her the same way in the close-up portrait on the
right. Keep everything else exactly as it is.` - whole sheet, one Klein edit at 2 MP: outfit on all
three panels 6 of 6, layout held (heads within 6 px), portrait face diff 4.5-7.8 / 255. Batch 1's
wrapper ("all three views: ...") re-laid the sheet, which is what broke batch 2's mask-lock.
**Q4 DONE (batch 4):** per-panel SAM3 "head, hair" lock + L1 = 6 of 6, face diff 0.3-1.5, exact
1792x1120, clean seams, 72 s vs 33 s free - the lock wins for Clothes. **Batch 5:** Q2 story state
PASS 6 of 6 (photo / 3D / anime); "the character" wording works; **Q3 FAILS in one plain sampling**
(body 1/6 - strips clothes, front / back disagree; age 0/4 - the big portrait takes it, the small
body faces do not). Running: batch 6 (`run_q3r2.sh`: A = whole sheet naming both halves, B = two
passes on the halves, lead half as image 2) and batch 7 (`run_q5.sh`: dress a HEADLESS sheet free /
free + "keep it without a head" / masked, then the headless graph again).
Size trick: `Edit_Scale` megapixels = w*h/2^20 (1.914 sheet, 0.957 half) = the input's exact size.
**Gate every batch with `layout.py`** - a contact sheet hid a 210 px re-layout once. Run any batch as:

    python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Git/bin/bash.exe" <run_qN.sh>

Outputs + contact sheets stay on G: (nude - never the repo).

## Bench

Sheet: `G:/ComfyUi/ComfyUI/input/mpi1041_nude_sheet.png` = MPI-1042's `FK2_klein_PN_s42.png`
(1792x1120, AI-made: front body | back body | 3/4 portrait, nude). Graph: the app's own
`comfy_workflows/klein_9b_t2i.json`, `Input_wf_type` 4 (kleinEdit), as the app injects it.

### Q1 - dress a naked sheet by words (`research/bench-tools/q1_dress.py`)

- Arms: **W 1 MP** (kleinEdit as shipped: node 167 scales the input to 1 MP, so a 1792x1120 sheet
  comes back ~1264x790) vs **W 2 MP** (the sheet's own size), 3 outfits (tee + jeans, biker jacket
  over a dress, armour + cloak) x seeds 42 / 7, plus **N** = a naive "Dress her in ..." at 1 MP.
- W prompt names all three views and what to keep (face, hair, body shape, pose, framing, grey, light).
- Score per output: front dressed as asked / back shows the SAME outfit from behind / portrait
  neckline matches / body shape kept / face and hair unchanged / layout and grey intact.
- Fail -> brief's fallback: per-panel edit (crop, edit, stitch), the front result as a reference.

### Q2-Q5

Not built yet. Q4 (mask-locked) can use the same graph: `Input_Mask` switches node 592 onto the
InpaintCrop + LanPaint path.

## Remaining Work

- Run Q1 (waits on Fabio's GPU go), score it, log it in `validation.md`.
- Q2 story-state, Q3 body shape / age, Q4 free vs mask-locked, Q5 head growing back.
- `/mpi-create-plan` for the Flow from the verdicts.

## Plan Drift

- 2026-10-09: the brief's "Fabio authors, no worker sub-agent" predates Fabio handing the bench
  to the agent (MPI-1042 handoff): the agent runs every batch under `gpu_lease`.
- 2026-10-09: Fabio - **Klein only**, no Qwen 2.1 edit arm (Qwen follows clothes better per MPI-1042,
  but non-commercial). Do not re-raise.
