# MPI-1041 - Character Sheet Editor - plan

Bench-phase plan. Direction and the five bench questions are in `brief.md`; the Flow plan
(`/mpi-create-plan`) is written from the bench verdicts, not before.

## Current State

**2026-10-10 (session 98aec79c) - batches 12-14 DONE, AGE IS SOLVED BY WORDS (except body size).**
Template that passes: `Change the <man|woman> in this character sheet to be a <younger|older> version
of <himself|herself> as a N-year-old[ boy|girl]` + for a child `, with a child's smooth face, no beard
and no wrinkles, wearing the same clothes.` + L1 tail (`Make the same change in the close-up portrait
on the right. Keep everything else exactly as it is.`). Older -> Klein (70 passes on all panels);
younger photoreal -> Boogu (identity kept); the fisher at 10 passes on Klein AND Boogu with the
child clause (batch 14). Qwen 2.1 is out for age; two-pass is worse. **A child-SIZED body: no edit
does it** (idea: rebuild via MPI-1042's from-images sheet). **Batch 15: the NEUTRAL template
passes 3 of 3 on Klein** (`Change the character in this character sheet to be a younger version of
themselves as a 10-year-old child, with a child's smooth face, no beard and no wrinkles, wearing the
same clothes.` + L1; adult target: `..., with a younger face, smooth skin and no grey hair.`). So
**Age -> Klein 9B**; only Body shape needs Qwen-Image 2.1. NEXT: Fabio's field call (v1 fields +
whether a child-sized body is a v1 need), then `/mpi-create-plan`. Untested: an older-direction
neutral template, more seeds, a male photo sheet, the anime sheet. **Batch 16: concrete body-size
words fail** (limbs: no change; "stands smaller, space above the head": Klein erases the heads) - a
child-sized body = REBUILD via MPI-1042's from-images sheet, not an edit. **Batch 17: the rebuild
WORKS on both sheets** (de-age edit on Klein, then the from-images Qwen arm on its portrait, no body
picture, child size + a clothes caption in the words; ~80 s): a real child's build, identity and
clothes kept. So the Flow's young-age step = edit + rebuild. **Fabio 2026-10-10: rebuild at age 12
and under; above 12 the edit alone.** Open: Klein arm of the rebuild, more seeds. **MPI-1056 is built**
(a word-and-age check on EVERY generation, `docs/child-safety.md`): the Flow's child template must
get a test proving the gate lets it through (and the gate's under-16 "fully dressed" rule holds).

**2026-10-10 (session 98aec79c) - batch 11 DONE: EXACT-age wording (Fabio's "a younger / older
version of herself as a N-year-old") works on Klein where relative wording failed.** 70 passes on
all three panels (best ageing yet); younger reaches the faces but misses a panel 3 of 4, drifts hair
colour, and keeps the adult body size (`validation.md` batch 11). Fabio wants child ages for films
(same character at several ages), always DRESSED, and proposed an age SLIDER that drives the
prompt and forces clothing below 18. App-wide safety gate = **MPI-1056** (research; must land
before any Flow ships a child age). **NEXT (agent pick): the same 5 `qage.py` prompts on
Qwen-Image 2.1** (body proportions are a body-shape edit, which only Qwen 2.1 passed) - ~105 s an
edit. Tools: `qage.py <klein|qwen21|boogu>` / `run_qage.sh <models>`, out
`G:/ComfyUi/ComfyUI/output/mpi1041_age/`. **Fabio 2026-10-10: GPU free to use for this bench (still
~5-edit runs); the loop now = tune the exact-age wording on the proven editors (Klein, Qwen 2.1,
Boogu).** Age slider is OPTIONAL (the Flow already runs the Enhancer, which is the MPI-1056 gate):
if built, Off = keep the age, 1-100 = target years (1 = a baby). Field call later.

**2026-10-10 (session 98aec79c) - batch 10 DONE: Loraholic's Krea 2 age slider FAILS (0 of 4).**
Krea 2 edit on Turbo, slider in `Input_Lora_1`, neutral prompt, seed 42: +6 vs -3 moves the
portrait face only 6 / 255 while the re-render itself moves it 39; no visible ageing or de-ageing,
fisher unchanged (`validation.md` batch 10). Slider is in `G:/CubricModels/loras/` (sha checked);
tools `qba.py krea2s` / `run_qkslider.sh`. **Younger still has no editor. NEXT: Fabio's field call**
- agent pick: v1 ships Body shape -> Qwen-Image 2.1, Older -> Boogu, and drops Younger; the
Healthiness Slider fallback (likely Qwen-Image 1.0; unchecked whether its keys load on 2.1) is
health + ageing, male-biased, and today's run says a slider is weak inside an edit - not worth a run.
Then `/mpi-create-plan` for the Flow.
**HARD LIMIT (2026-10-10):** Fabio's own Klein edit ("younger version of herself as a 5-year-old")
turned a swimwear sheet into a CHILD on a body sheet. Fabio's rule: child ages are for films and
are ALWAYS dressed. The Age field is a slider that writes the prompt; below 18 it forces fully
clothed wording, runs only on a clothed sheet, and the Clothes / Accessories fields refuse swimwear
/ underwear / nude. Bench child ages on clothed sheets only. Gate for MCP / Cosmo / the Enhancer =
MPI-1056, which lands before the Flow ships a child age.

**2026-10-10 (session adf9de68) - batch 9 DONE: body / age on four other editors, 5 edits each.**
Table in `validation.md` batch 9. **Body shape -> Qwen-Image 2.1** (only editor that passes: 3 of
3 on all three panels, exact size via node 30 `resolution` 0, ~105 s; non-commercial gate - Fabio
OK). **Older -> Boogu balanced** (Apache-2.0, ages hardest, ~33 s, 1 MP) or Qwen 2.1. **Younger ->
nobody** (one hard case: stylised old man, white beard; Boogu weak, Qwen 2.1 nothing). Qwen Image
Edit (Turbo) and Krea 2 are out. Fabio's rule: the Flow routes each field to its editor (memory
`project_flows_chain_best_model_per_job`). **Age sliders (Fabio 2026-10-10): no age LoRA exists for
Qwen 2.1 or Boogu. NEXT: test Loraholic's "THE age slider" on Krea 2 edit** (CivitAI 2533032,
version 3067659, `age_krea2_loraholic.safetensors`, 6.87 MB, rank 1, sha256
`43fb1a7dc734f99df01add68c15a1bddb9bfdbca0a8773afa9b4968c03f60a9c`, -3 younger .. +8 older, no
trigger, "100% free"; HF mirror e.g. `huggingface.co/Kutches/Kr3a/resolve/main/age_krea2_loraholic.safetensors`
- check the sha). Idea: a slider is GLOBAL, so it may age every face on the sheet alike where words
fail. Try older (photo) + younger (fisher, and the photo woman), neutral "keep everything" prompt
(a commenter: age words weaken it), Krea 2 Turbo (`Input_is_Turbo` true - Raw was ~6.5 min an edit)
via a free `Input_Lora_N` slot. Fallback if it fails: the "Healthiness Slider" (CivitAI 2006663,
`sHealthy_-2to2.safetensors`, 70 MB, likely Qwen-Image 1.0). Fabio ruled out the tensor.art Klein
"Age Slider" (el_chupanibre): not a real age slider by its images, and no commercial use.
Then Fabio's field call and `/mpi-create-plan`.** Tools: `qba.py` / `run_qba.sh <model>`,
gates `layout.py` + `width.py`, `pairs.py` for original-vs-edit sheets. Out
`G:/ComfyUi/ComfyUI/output/mpi1041_qba/` (nude - never the repo).

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

- 2026-10-10 (session 98aec79c): Age is NOT dropped and NOT Boogu/Qwen - Fabio's exact-age wording
  (batches 11-15) makes it a Klein field; a child's body (12 and under) is a from-images REBUILD
  (batch 17). Child ages are wanted (films), always dressed; the MPI-1056 gate checks every prompt.
- 2026-10-09 (session adf9de68): Fabio - **the Flow may use 2-3 editors**, each field routed to the
  model that passes it (e.g. Klein for clothes / hair / condition, another editor for body / age).
  So batch 9 is a per-field model pick, not a hunt for one editor that does everything. Each step
  runs its own model's graph (not one giant graph). If Qwen-Image 2.1 is the only editor that passes
  body / age, the Flow ships gated non-commercial - Fabio: better than no Flow.

- 2026-10-09: the brief's "Fabio authors, no worker sub-agent" predates Fabio handing the bench
  to the agent (MPI-1042 handoff): the agent runs every batch under `gpu_lease`.
- 2026-10-09: Fabio - **Klein only**, no Qwen 2.1 edit arm (Qwen follows clothes better per MPI-1042,
  but non-commercial). Do not re-raise. **Superseded later the same day:** Fabio asked for the
  body / age bench on Qwen 2.1 + three other editors, and for per-field model routing (above).
