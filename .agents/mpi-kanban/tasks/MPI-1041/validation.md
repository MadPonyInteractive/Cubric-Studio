# MPI-1041 validation

Bench log. Outputs and contact sheets stay OUT of the repo (nude sheets):
`G:/ComfyUi/ComfyUI/output/mpi1041_*/`.

## 2026-10-09 - batch 1, Q1: dress a naked sheet by words (agent-run under gpu_lease)

`research/bench-tools/q1_dress.py` -> `run_q1.sh`, 15 runs, all `success`. Sheet = MPI-1042's
`FK2_klein_PN_s42` (nude, 1792x1120: front | back | 3/4 close-up). App's Klein 9B graph, kleinEdit.
1 MP = 15 s (out 1296x816), 2 MP = 33-36 s (out **1824x1152**, not the sheet's 1792x1120: node 167
rounds to its 16-px steps - a Flow must size to the sheet exactly). Contact sheets
`G:/ComfyUi/ComfyUI/output/mpi1041_q1/contact_{W1,W2,N}.jpg`, face strip `face_check.jpg`.

- **Wrapped prompt (names the three views + what to keep): the outfit lands on ALL THREE panels,
  back included, 12 of 12** (both sizes, tee + jeans / biker jacket over a dress / armour + cloak,
  seeds 42 / 7). The back view shows the same outfit from behind every time (jacket back, jeans
  pockets, cloak with the hood down as asked). Layout, grey and lighting intact. Body shape kept by
  eye (legs, hips, shoulders where visible).
- **Naive "Dress her in X." = 1 of 3:** tee right; biker left the portrait NUDE; armour broke the
  layout (back panel became a second front view, portrait became a side-on full body, hood up).
  So the Flow's wrapper is load-bearing.
- **Drift, the part that is not right yet:**
  - portrait TURN: 1 MP seed 7 turned the 3/4 close-up to frontal **3 of 3**; 2 MP kept the turn 6 of 6.
  - back-view HAIR: the long ponytail tail came back short / tied at the nape at 1 MP **3 of 4**
    (armour excluded, the cloak hides it), 2 MP **1 of 4**.
  - portrait FRAMING: every run pulls the close-up back a little to show the neckline (head smaller).
  - FACE: the same person, but not pixel-held - the 2 MP s42 face reads slightly wider.
- ~~Verdict Q1: PASS at 2 MP with the wrapper~~ - **WITHDRAWN after batch 2** (below): the wrapper
  re-lays the sheet out. Outfit consistency across the three panels stands; the wording does not.

## 2026-10-09 - batch 2, Q4: mask-locked dress (agent-run under gpu_lease) - FAILED, and it exposed a layout bug

`q4_masklock.py` -> `run_q4.sh`: SAM3 "head, hair" (MPI-1042's settings) on the whole sheet, inverted
(white = edit everything but head and hair), then batch 1's six 2 MP jobs on the app's masked-edit
path (`Input_Mask` -> InpaintCrop, retitled `Edit_Crop` and set to 1792x1120 -> LanPaint -> stitch).
69-87 s each (2x the free edit). Out `G:/ComfyUi/ComfyUI/output/mpi1041_q4/`.

- **Mask:** SAM3 on the whole sheet found the front head and the back hair, and **missed the
  portrait's head entirely** (the big close-up) - a sheet mask must be built per panel, as the
  headless chain already confines SAM3 to quarter 1.
- **Output: a GHOST second head 6 of 6** on the front panel and a floating hair blob beside the back
  figure: LanPaint kept the locked pixels where they were, but the model drew the new bodies
  somewhere else.
- **Why - measured, not guessed (`layout.py`: head centres, seam band, portrait edge, in sheet px):**
  batch 1's free edits moved the figures too, the wrapper's fault, not the mask's.
  Wrapped (W, 12 of 12): back head **+200..+225 px**, front +8..+71, portrait edge +118..+157, and
  the body / portrait seam band 69-95% foreground (original 0%) - the back figure now crosses into
  the portrait half, which shrinks from 1/2 to ~1/3 of the sheet. Naive "Dress her in X." (N):
  front / back within **7 px**, seam 0% on tee and biker; armour broke it (portrait edge +195).
  So the wording "all three views: the front view, the back view, the close-up portrait" makes
  Klein re-space three panels evenly. A mask cannot fix that; the wording has to.
- **Verdict Q4 (this form): FAILED.** A whole-sheet mask-lock is only possible once the edit keeps
  the layout. Retry after batch 3 with per-panel SAM3 masks.

## 2026-10-09 - batch 3, Q1b: a wording that keeps the layout (agent-run under gpu_lease)

`q1b_layout.py` -> `run_q1b.sh`, 15 runs, 30-42 s at 2 MP, 15 s at 1 MP. Out
`G:/ComfyUi/ComfyUI/output/mpi1041_q1b/` (contact_L1 / L2 / L2_1mp).
- L1 = `Dress her in {outfit}. Dress her the same way in the close-up portrait on the right. Keep
  everything else exactly as it is.`
- L2 = names where each view sits ("the two full-body views in the left half ... the close-up
  portrait that fills the right half") + a keep list.

- **Layout: held 15 of 15** - heads within 6 px of the original, seam band 0-4% (L2 1 MP 9%).
- **Outfit on all three panels, back included: L1 6 of 6** (2 MP). **L2 4 of 6**: biker s7 left
  the portrait nude, armour s7 put a sleeveless halter in the portrait under a sleeved front.
  L2 at 1 MP seed 7: 3 of 3, and the portrait kept its 3/4 turn 3 of 3 (batch 1's frontal turn at
  1 MP was the re-layout, not the size).
- **Face held** - mean abs diff of the portrait face box vs the original (0-255): **L1 4.5-7.8**
  (one outlier, 36.8: biker s42 tilted the head down, eyes lowered), L2 4.2-10.3, the batch-1
  wrapper 41-72. Front-panel face 16-25 (small face, resampling).
- Back hair stays long on every visible back (tee, biker); the cloak covers it on armour.
- **Verdict Q1: PASS with L1 at 2 MP** - all three panels, back included, layout and face held.
  One residual: a head-pose change on the portrait, 1 of 6. Q4 (mask-lock) now only has to beat
  that, and it costs 2x the time.

## 2026-10-09 - batch 4, Q4b: mask-locked dress, per-panel mask + L1 (agent-run under gpu_lease)

`q4b_masklock.py` -> `run_q4b.sh`. Mask: SAM3 "head, hair" on EACH panel crop (front 0-448 | back
448-896 | portrait 896-1792), pasted back onto an empty sheet mask (`SolidMask` + `MaskComposite`
add), holes filled, grown 6, inverted - finds all three heads incl. the portrait's (whole-sheet SAM3
missed it, batch 2). Then batch 3's six L1 2 MP jobs on the masked-edit path. Mask 9 s, edits
72-78 s (free L1: 30-42 s). Out `G:/ComfyUi/ComfyUI/output/mpi1041_q4b/` (contact_ML1, seam_zoom).

- **6 of 6 right:** outfit on all three panels, back included; no ghost heads; layout within 4 px
  (seam band 0-12%: the armour cloak's edge); output exactly **1792x1120** (the stitch restores the
  sheet's size, unlike the free edit's 1824x1152).
- **Face and hair held to the pixel:** portrait face diff **0.3-1.5** / 255 (free L1 4.5-7.8),
  front face 0.8-1.2. Batch 3's head-tilt miss cannot happen. Long hair stays over the new jacket /
  cloak on the back view.
- **Seams clean** at full size: chin / neck into the collar, the hair tip over the jacket - no halo.
- **Verdict Q4: the mask-lock WINS for clothes** (identity guaranteed, exact size) at 2x the time.
  It can only lock what the field leaves alone: a Clothes edit locks head + hair; a Hairstyle edit
  would lock the face only; Age and story-state ("bruised face") must edit the head - free edit.

## 2026-10-09 - batch 5, Q2 + Q3 + "the character" wording (agent-run under gpu_lease)

`q23_state_body_age.py` -> `run_q23.sh`, 19 runs at 2 MP, 33-45 s, free edit (no mask), L1 shape:
`<change sentence> Make the same change in the close-up portrait on the right. Keep everything else
exactly as it is.`, "the character" throughout. Sheets: the nude one + MPI-1042's three clothed art
sheets (photo woman / 3D fisherman / anime girl). Out `G:/ComfyUi/ComfyUI/output/mpi1041_q23/`.
**Layout held 19 of 19** (heads within 7 px; the two portrait-edge moves are the "older" hair).

- **Q2 story state ("beaten up after a fight: a bruised, cut face and torn, dirty clothes"):
  6 of 6 on all three panels, back included** - bruised / cut faces on the front and the portrait,
  torn and dirtied clothes front AND back, on photo, 3D and anime. Expression kept (the photo woman
  still smiles - "keep everything else" is literal). One slip: anime s7's portrait eyes turned
  amber (blue on the front). **Q2 PASS.**
- **Q3b body shape: 1 of 6.** heavyset on the nude sheet is right on the two bodies (the portrait's
  neck and shoulders stay slim). Everything else fails: heavyset on the photo sheet changed only the
  BACK (and cut the jacket into a sleeveless vest); muscular stripped clothes to show muscle (photo:
  front vest, back shirtless) and added briefs on the nude front only; skinny changed nothing.
- **Q3a age: 0 of 4.** "Older" aged the PORTRAIT strongly (white hair, wrinkles) and left the small
  full-body faces young (nude) or aged the front but kept the back's red hair (photo). "Younger"
  changed nothing on the photo woman or the fisherman.
- So one whole-sheet sampling carries a change everywhere when it is ON the clothes (outfit, dirt,
  tears), and fails when it lives in the face or the body under the clothes: the big portrait takes
  it, the small full-body heads do not. **Q3 FAIL in this form** - next: name the panels for body /
  age, or two passes (portrait first, then the bodies with the edited portrait as reference, MPI-1042's
  Klein shape).
- **"the character" for "her" (LN, dress, seed 42): 3 of 3 outfits on all three panels**, layout
  held. biker repeats seed 42's head tilt (eyes lowered) - the free edit's known residual; the
  Clothes mask-lock (batch 4) removes it.

## 2026-10-09 - batch 6, Q3 round 2: body shape and age, two structures (agent-run under gpu_lease)

`q3r2.py` -> `run_q3r2.sh`, seed 42, 10 cases x 2 structures. Out `G:/.../mpi1041_q3r2/`.
**Exact size works:** `Edit_Scale` megapixels = w*h / 2^20 (1.914 sheet, 0.957 half) returns
1792x1120 / 896x1120 exactly. Layout held 20 of 20.
- **A** = whole sheet, wording names both halves (L2 shape) + "the same clothes stay on, refitted"
  (body) / "the same change to the face and the hair in every view, also seen from behind" (age).
- **B** = two passes on the halves: age = portrait first, then the bodies with it as image 2;
  body = bodies first, then the portrait with them as image 2; stitched at x 896. 12-24 s a pass.

- **Body shape: neither structure works.** skinny: no change 4 of 4. muscular: changes the CLOTHES
  (photo: sleeveless jacket + shorts, front only) and, on the nude sheet, INVENTS underwear - the
  "same clothes stay on" line is read as "put clothes on" when there are none. heavyset: the
  bodies fatten (A nude front + back, B photo mildly), but B nude left the back slim, and the
  portrait's neck / face never follows except B photo, slightly. Best case 1-2 of 10.
- **Age: older works only partly, younger never.** B older (portrait leads) is the best seen: nude
  - aged face on the portrait and the front, hair greying on all three; photo - aged + blond on the
  portrait and the front, but the BACK keeps the red hair. A older: either the portrait or the back
  stays young. younger: no visible change on the photo woman or the fisherman, A or B (4 of 4).
- **Verdict Q3: FAIL on Klein 9B edit** - body shape and age are not reliable by words in any of
  the three structures tried (plain, panels named, two passes). Klein edits what sits ON the body
  (clothes, dirt, tears) on all three panels; it does not re-sculpt the body or the face's age
  consistently across a front, a back and a close-up.

## 2026-10-09 - batch 7, Q5: dressing a HEADLESS sheet (agent-run under gpu_lease)

`q5_headless.py` -> `run_q5.sh`. The nude sheet through the app's own
`flow_character_sheet_headless.json` (6 s; front head -> grey plate, hair at the shoulders kept on
purpose), then dressed 3 outfits x 3 ways, seed 42, exact size, then the headless graph again.
Out `G:/ComfyUi/ComfyUI/output/mpi1041_q5/` (contact_dressed, contact_redone).

- **F, free L1: the head GROWS BACK on the front panel 3 of 3.**
- **FK, free L1 + "The front full-body view has no head; keep it without one.": headless 3 of 3,
  but the BACK view turns into a second headless FRONT view 3 of 3** (and armour's portrait put
  the hood up). Worse than F.
- **Re-running the headless chain on F (the brief's fallback): clean 1 of 3** - on armour and biker
  it leaves a grey face-shaped hole framed by the regrown hair, because the chain keeps hair by
  design (MPI-1042 decision). Not a fix.
- **M, batch 4's per-panel head + hair lock: headless 3 of 3, back view intact, plate untouched**
  (plate box diff 0.3-1.3 / 255 vs F's 65.5). SAM3 "head, hair" on the headless front panel covers
  89% of the head box (the plate + the hair left at the shoulders), so it locks the plate.
- **Verdict Q5: the Clothes mask-lock already solves it - no re-run.** One dependency to harden in
  the Flow: the lock covers the plate only because SAM3 reads plate + hair as a head; union the
  front panel's head box from the headless chain's own mask when the sheet is headless, or the
  head can come back on a sheet where SAM3 misses the plate.

## 2026-10-09 - batch 8, Hairstyle field: free vs face-lock (agent-run under gpu_lease)

`qhair.py` -> `run_qhair.sh`: `Give the character <haircut>. Make the same change in the close-up
portrait on the right. Keep everything else exactly as it is.` - short blonde bob / very short buzz
cut / long curly red hair, on the nude and the photo sheet, seed 42, exact size. H = free (31-33 s),
HF = masked path with batch 4's per-panel mask, vocabulary "face" (66 s). Head centres held 12 of 12
(the portrait-edge moves are the new hair outline). Out `G:/ComfyUi/ComfyUI/output/mpi1041_hair/`.

- **H free: 5 of 6 on all three panels, back included** - bob, buzz and long curls land on the
  front, the back and the portrait alike. Miss: photo + long curly, the back kept its short hair.
  Inner face drift 4.2-9.4 / 255.
- **HF face lock: identity held to the pixel (inner face 0.1-1.5); nude 3 of 3 right; photo 0 of 3
  on the BACK** - SAM3 "face" on the photo sheet's back panel marks the BACK OF THE HEAD as a face
  (mask checked), so the lock froze the old hair from behind.
- **Verdict Hairstyle: PASS, with the face lock and NO face vocabulary on the back panel** (a back
  view has no face by construction; run it on the front + portrait crops only). The free edit is
  the fallback at 5 of 6 and drifts the face slightly.

## 2026-10-09 - batch 9, Body shape + Age on other editors, 5 edits each (agent-run under gpu_lease)

`qba.py <model>` -> `run_qba.sh <model>`: Fabio's 5 cases, seed 42, batch 5's L1 wording
(`<change>. Make the same change in the close-up portrait on the right. Keep everything else exactly
as it is.`), the app's own graph per model as it injects the edit op. Out
`G:/ComfyUi/ComfyUI/output/mpi1041_qba/` (`pairs_<model>_<sheet>.jpg` = original above each edit).
New gate `width.py`: mean foreground width of the front / back torso + thighs and the portrait's
neck + shoulders, % vs the original (Klein's batch 5-6 numbers for comparison: skinny -2 to -7% front,
~0 back and portrait; heavyset +25-31% front, back 2-37%, portrait 0-6%).

- **9a Qwen-Image 2.1 edit** (`qwen_image_2_1.json`, wf_type 4, node 30 `resolution` 0 = the exact
  1792x1120, canvas follows reference 1; ~105 s an edit). **4 of 5.**
  - muscular (nude): PASS - abs, arms, shoulders, calves defined front AND back, no clothes invented,
    face kept; portrait shoulders barely change (widths -2 / +4 / 0%: muscle, not width).
  - heavyset (photo): PASS on all three - bodies fuller (+10 / +9%), the portrait's face and chin
    fuller; same clothes refitted.
  - skinny (nude): PASS on all three - front -22.5%, back -14.2%, portrait shoulders -13.4%; ribs show.
  - older (photo): PASS - forehead / eye lines on the front face AND the portrait; hair stays red
    everywhere, so the back agrees (not asked to grey).
  - younger (fisher): FAIL - no visible change (white beard, wrinkles kept) and the portrait
    re-framed (layout: portrait +49 px, hat smaller). Layout held on the other 4 (heads within 11 px,
    the photo portrait's +9 / +11 is the wider face / hair).
- **Krea 2 at the exact size (node 573 = 1.914 MP): 1 edit, then stopped.** The 16 GB card offloads
  (12.9 GB staged, 35 s a step): 992 s for ONE edit, ~80 min for five - unshippable in a Flow, so
  Krea 2 reruns at the app's 1 MP. That one edit (muscular, nude, `krea2x_muscular_nude.png`):
  FAIL - no muscle definition on either body, widths +11 / -4 / +3% (a re-render, not a change);
  layout held.
- **9b Boogu Edit balanced** (`boogu_edit_balanced.json` as shipped, 1 MP -> 1296x816; 30-48 s an
  edit). Layout held 5 of 5 (within 1 px). **1 of 5 clean** - it changes ONE panel, not three:
  - muscular (nude): FAIL - strong abs / arms on the FRONT only; the back is untouched.
  - heavyset (photo): FAIL - only the PORTRAIT fattens (fuller face, double chin); bodies 0%.
  - skinny (nude): PARTIAL - bodies -11 / -12%, portrait 0%.
  - older (photo): PASS - the strongest ageing seen yet on the portrait (lines, sagging neck), and
    the front face ages with it; hair stays red, back agrees.
  - younger (fisher): WEAK - brows darken from white to grey, fewer wrinkles on the front and the
    portrait, but the beard stays white: still reads as an old man. Better than Qwen 2.1's nothing.
- **Qwen Image Edit on Quality (tier 1, the app's default: raw 20 steps, cfg 2.5): 2 edits, then
  switched** - 17.8 s a step, ~6 min an edit (Fabio: too painful without a speed-up; rerun on
  Turbo). Kept as `qweneditQ_*`: muscular = a bodybuilder on ALL three panels (widths +5 / +13 /
  +21%) but overdone, skin tanned, underwear invented on the front, portrait re-framed +20 px;
  heavyset = FAIL - bodies +1 / +4%, the portrait zoomed OUT (+99 px) with a fuller face.
- **9c Qwen Image Edit on Turbo** (`qwen_edit.json`, tier 2 = 8-step Lightning, cfg 1, 1 MP; ~95 s
  an edit). **0 of 5** - it edits ONE panel and breaks it:
  - muscular: a glossy, plastic bodybuilder on the back + portrait (male chest on the portrait),
    front untouched. skinny: no thinning (widths +1 / -1 / -1%), a wet plastic sheen on the back
    and the neck. heavyset: bodies unchanged, the portrait zoomed OUT (+50 px) with a fuller face.
    older: heavy wrinkles on the portrait only. younger: the portrait becomes a DIFFERENT young man
    (no hat, no beard, new jacket), the bodies stay old.
  - Bench trap: `MpiAnySwitch` indexes the CONNECTED inputs by position, so a bench copy that
    deletes `any_1` makes `select 2` miss and returns an ExecutionBlocker - ComfyUI reports
    `success` in 3 s with no image. Rewire unused arms instead of deleting them.
- **9d Krea 2 edit at the app's 1 MP** (`krea2_t2i_sfw.json` as shipped, Raw 25 steps cfg 2):
  **0 of 5, and ~6.5 min an edit even at 1 MP** (388-425 s). muscular / skinny: bodies unchanged
  (widths within 2%) and the PORTRAIT re-framed - zoomed in, layout portrait -109 / back +134 px on
  both nude edits; heavyset: +3 / +7%, no visible fattening; older: no visible ageing; younger: no
  change (front re-rendered +17 px). Krea 2 is out for body / age.
- **Verdict batch 9 (per field, Fabio's multi-model rule):**

  | editor | muscular | heavyset | skinny | older | younger | s / edit |
  |---|---|---|---|---|---|---|
  | Qwen-Image 2.1 (exact size) | PASS | PASS (3 panels) | PASS (3 panels) | PASS | FAIL | ~105 |
  | Boogu balanced (1 MP) | front only | portrait only | bodies only | **PASS, strongest** | weak | ~33 |
  | Qwen Image Edit Turbo (1 MP) | broken | portrait only | FAIL | portrait only | wrong person | ~95 |
  | Krea 2 (1 MP) | FAIL | FAIL | FAIL | FAIL | FAIL | ~390 |
  | Klein 9B (batches 5-6) | FAIL | 1 of 2 | FAIL | partial | FAIL | ~33 |

  **Body shape -> Qwen-Image 2.1 (the only editor that passes it; Flow gated non-commercial).
  Older -> Qwen-Image 2.1 or Boogu (Boogu ages harder and is 3x faster). Younger -> nobody** (one
  case, a stylised old man with a white beard - the hardest one).
- **Age-slider LoRA search (2026-10-10, Fabio asked):** NONE for Qwen-Image 2.1 or Boogu - HF
  `base_model:adapter:` lists (Qwen 2.1: 106 adapters / 60 finetunes; Boogu Edit: 1 adapter) have
  no age LoRA; web + CivArchive find none (CivitAI's API answers 451 from the UK). Near misses:
  "Healthiness Slider" (CivitAI 2006663, "Qwen" base - pre-2.1 by its id, so probably Qwen-Image
  1.0; health + ageing, male-biased, untested on 2.1); **"THE age slider" by Loraholic** (CivitAI
  2533032, **Krea-2** version, rank 1, 6.87 MB, -3..8, "100% free"); **"Age Slider -
  Flux.2.klein.9B"** (tensor.art, trained on Klein 9B BASE, "early experiment"). Sliders only push a
  direction the base already knows.
- Download note: the first `qwen_image_edit_2511_int8_convrot` pull failed its sha256 - the stream
  dropped (no timeout, no resume). A resumable re-pull matched size AND sha, and HF's `lfs.oid`
  equals the dep's sha256: the R2 object is fine, nothing breaks for users.

## 2026-10-10 - batch 10, Krea 2 Turbo + Loraholic's age slider, 4 edits (agent-run under gpu_lease)

`qba.py krea2s` -> `run_qkslider.sh`: `krea2_t2i_sfw.json` edit (wf_type 4) on Turbo, the slider
(`age_krea2_loraholic.safetensors` in `G:/CubricModels/loras/`, sha256 `43fb1a7d...60a9c` matched the
CivitAI page, HF mirror `Kutches/Kr3a`; native `diffusion_model.blocks.*` / `txtfusion` keys, 0
"lora key not loaded") in `Input_Lora_1`, prompt `Keep everything exactly as it is.`, seed 42, 1 MP.
69-82 s an edit. Out `G:/ComfyUi/ComfyUI/output/mpi1041_qba/` (`pairs_krea2s_*.jpg`,
`faces_krea2s_*.jpg` = face crops at the sheet's size).

- **0 of 4. The slider is too weak inside an edit**: the same seed at +6 vs -3 (a 9-step swing)
  moves the portrait face 6 / 255 mean (front face 8), while Krea 2's own re-render moves it 39 /
  255 from the original. +4 vs +6 differ by 1.9. No visible ageing at +4 / +6, no visible
  de-ageing at -3; the fisher (-3) keeps the white beard, brows and wrinkles.
- The photo sheet's portrait re-frames on all three (zoomed in, layout portrait -39 px; the
  `back +121` on the two older edits is the back head's measure, not a visible move). Widths
  within 3% (no body change, as expected). Fisher layout held (front +14).
- Why, probably: the edit's reference conditioning (identity-edit LoRA + source patch) holds the
  face to the input, and a rank-1 slider trained for text-to-image cannot push past it.
- **Verdict: younger still has no editor.** The slider route is closed on Krea 2 edit.

## 2026-10-10 - batch 11, Age by EXACT target age on Klein 9B, 5 edits (agent-run under gpu_lease)

Fabio's own Klein edit ("Change the woman in this character sheet to be a younger version of herself
as a 5-year-old.") de-aged a sheet where batch 5's relative "about twenty years younger" did
nothing. `qage.py` -> `run_qage.sh`: his wording, no tail, Klein 9B edit as shipped (1 MP), seed
42, **clothed sheets only**, child cases add "wearing the same clothes"; NSFW LoRA off (no word of
node 43's list). 15-19 s an edit. Out `G:/ComfyUi/ComfyUI/output/mpi1041_age/` (its own folder,
away from the nude bench; `pairs_age_*.jpg`). Layout held on all 5 (heads within 12 px).

- **70 (photo): PASS, all three panels** - white hair front / back / portrait, wrinkles on both
  faces, clothes and pose kept. The strongest ageing on any editor so far.
- 25 (photo): PARTIAL - front + portrait read as a young woman, but the hair turns straight and
  browner, and the BACK keeps the original red curly bob: the panels disagree.
- 30 (fisher): FAIL - no visible change (white beard kept).
- 10 (photo): PARTIAL - front + back + portrait read young (portrait more teen than 10), fully
  clothed, but the hair turns red -> brown (identity drift) and the BODY keeps adult height and
  proportions, the same "body is not there yet" Fabio saw.
- 10 (fisher): PARTIAL - front + back become a boy (brown hair, no beard), the PORTRAIT stays the
  old bearded man.
- **Verdict:** exact-age wording fixes Older on Klein (better than Boogu: all three panels).
  Younger reaches the face on most panels, but misses a panel 3 of 4 times, drifts hair colour, and
  never changes the body's size; a child's proportions are a body-shape edit, which only Qwen-Image
  2.1 passed (batch 9). Next test: the same 5 prompts on Qwen-Image 2.1.

## 2026-10-10 - batch 12, the same exact-age prompts on Boogu + Qwen-Image 2.1 (5 each)

`run_qage.sh boogu qwen21` (`pairs_age_<model>_*.jpg`). Boogu ~32 s, Qwen 2.1 ~108 s an edit.

| case | Klein 9B (b11) | Boogu balanced | Qwen-Image 2.1 |
|---|---|---|---|
| 70 photo | **PASS, all 3 panels** (white hair) | faces age, hair stays red | weak (hair a little lighter) |
| 25 photo | back disagrees, hair drifts | **PASS, identity kept** (red curls, freckles) | weak |
| 10 photo | young on 3 panels, hair red -> brown | young faces, **identity kept** | barely younger (reads ~30) |
| 10 fisher | front + back a boy, portrait old | front: brown hair + WHITE beard (broken) | portrait a child, front old; portrait re-framed +157 px |
| 30 fisher | no change | slight | slight; portrait re-framed +112 px |

No editor changes the body to a child's size (widths within 3% on Klein / Boogu; Qwen -3 / -6%
thinner, not shorter). Layout: Boogu held; Qwen re-frames the fisher portrait. **Qwen 2.1 is out for
age.** Older -> Klein; younger (photo) -> Boogu for identity, Klein for reach; the stylised old man
(beard, white hair) stays the hard case. Next: tune the wording on Klein + Boogu.

## 2026-10-10 - batch 13, exact-age wording v2 on Klein + Boogu (5 each)

`SET=v2 run_qage.sh klein boogu` (`pairs_age_<model>v2_*.jpg`): Fabio's sentence + batch 5's L1
tail ("Make the same change in the close-up portrait on the right. Keep everything else exactly as
it is."), and at 10 a second arm adding ", with a child's height and body proportions". Layout
held (within 16 px; the fisher `back -128` is the measure, no visible move).

- **Boogu photo: PASS at 10 and 25** - all three panels agree, red curls + freckles kept, fully
  dressed; reads ~13-15 rather than 10. The best photoreal younger so far.
- Klein photo: young on all panels but the hair drifts (red -> brown), and with the body clause the
  portrait keeps red curls while front / back go brown; at 25 the back keeps the old bob again.
- Fisher, both editors: no fix. Klein: front + back a boy, the PORTRAIT stays the old man (L1 tail
  or not). Boogu: young faces under a white beard on every panel.
- **The body clause changes nothing** (widths within 1.5%, same height) on either editor: an edit
  keeps the sheet's figure size, so a child's proportions are not an edit-model job.
- **Per-field verdict so far:** Older -> Klein exact age. Younger, photoreal -> Boogu + exact age +
  L1. Younger, stylised / bearded -> unsolved (Klein's portrait). Child proportions -> needs a
  rebuild, not an edit (idea: de-age the portrait, then MPI-1042's from-images sheet).

## 2026-10-10 - batch 14, the fisher at 10: two-pass vs a no-beard clause (5 edits)

`qage2p.py` -> `run_qage2p.sh` (`pairs_age_b14_fisher.jpg`). Layout held on all 4 sheets (within 4 px).

- **`nb` = one whole-sheet pass + ", with a child's smooth face, no beard and no wrinkles, wearing the
  same clothes." + L1: PASS on Klein (18 s) AND Boogu (36 s)** - the same boy on all three panels,
  brown hair under the same hat, the same jacket; the first full pass on the hard case.
- Two-pass on Klein (body half leads at 0.957 MP, then the portrait half): FAIL both ways - alone,
  the portrait keeps the beard and the big nose; with the pass-1 boy as image 2, a boy's face UNDER
  a white beard. Two passes cost more and do worse - dropped.
- So the beard was the blocker, not the panel: the model needs to be told what a child lacks.

## 2026-10-10 - batch 15, NEUTRAL wording (the Flow never knows the pronoun), Klein + Boogu (3 each)

`SET=v3 run_qage.sh klein boogu`: `Change the character in this character sheet to be a younger
version of themselves as a 10-year-old child, with a child's smooth face, no beard and no wrinkles,
wearing the same clothes.` + L1; and at 30 `... as a 30-year-old, with a younger face, smooth skin
and no grey hair.` + L1. Layout held (within 4 px), widths within 2%.

| case | Klein 9B (~16 s) | Boogu (~37 s) |
|---|---|---|
| 10 photo | **PASS, all 3 panels, red curls kept** (the clause also fixed batch 11's hair drift); reads ~13 | portrait the most convincing 10 yet, FRONT stays adult |
| 10 fisher | **PASS, all 3** (the same boy, hat, jacket) | **PASS, all 3** |
| 30 fisher | **PASS, all 3** - clean-shaven, dark hair, nose smaller | **PASS, all 3** - keeps the big nose (closer identity) |

**Verdict: Age -> Klein 9B with the neutral template, 3 of 3** (fast, already the Flow's editor for
clothes / hair / condition). Boogu 2 of 3. Still open: a child-SIZED body (no edit shrinks the
figure), and "reads ~13" at 10 on photoreal.

## 2026-10-10 - batch 16, a child-SIZED body in concrete words (6 edits)

Fabio asked for concrete wording (shorter limbs, small height). Batch 15's neutral template with
clothes "in a child's size", plus `v4limbs` (", with a child's small body: shorter arms and legs, a
shorter torso and a larger head for the body.") or `v4height` ("The child is much shorter than the
adult was: in the two full-body views the child stands smaller, with empty grey space above the
head, the feet on the same floor line."). New gate `height.py` (head top to feet per body panel;
batch 15's children measured +0.3-0.5% = adult height).

- v4limbs, Klein: no change (height +0.4% on both sheets) - the same adult-sized figure.
- **v4height, Klein: BROKEN** - figures 24-36% shorter, but by ERASING heads: photo front = a faded
  headless body, the back panel turned into a front-facing boy; fisher = two headless bodies. Klein
  reads "empty space above the head" as "remove the head".
- v4height, Boogu: ignored (height +0.0-0.2%).
- **Verdict: an edit cannot give a child's body size** - it either keeps the figure or breaks the
  sheet. A child-sized body needs a REBUILD: de-age the sheet (batch 15 template), then generate a
  new sheet from its portrait with MPI-1042's from-images Flow, which draws the body fresh.

## 2026-10-10 - batch 17, a child-sized body by REBUILD (2 runs, Fabio's go)

`qrebuild.py` -> `run_qrebuild.sh` (`pairs_rebuild_*.jpg` = original / batch 15 Klein edit /
rebuild). MPI-1042's from-images graph as shipped (`flow_character_sheet_from_images.json`, the Qwen
arm, one sampling), face picture = the right half of batch 15's `kleinv3_age10_<sheet>.png`, box =
the whole half, `Input_Face_Pose` TURNED, NO body picture (Qwen copies a body picture's build), and
in `Input_Positive`: `A 10-year-old child with a child's height and body proportions: a short, small
body with shorter arms and legs, a shorter torso and a larger head for the body.` + a hand-written
caption of the sheet's own clothes. ~80 s a run, out 1792x1120.

- **PASS on both** (by eye): a CHILD's build at last - a bigger head for the body, shorter limbs,
  narrow shoulders, the clothes roomy (trousers rolled at the ankle on the photo). Photo: her red
  curls, freckles, jacket over the mustard jumper, olive trousers, boots. Fisher: the same boy, suit,
  tie, red beanie, shoes. The portrait matches the bodies on both.
- `height.py` reads +3-6% - the sheet always draws a full-height figure, so pixel height is not the
  measure for a rebuild; the PROPORTIONS changed (judged by eye; no head-to-body gate yet).
- **Verdict: young ages = edit (batch 15 template) then rebuild.** The Flow's age step for a child
  is two runs (~16 s Klein + ~80 s Qwen); the clothes caption comes from the Flow's describer.
  Untested: the Klein arm of the rebuild (commercial-safe, two samplings), the age cut-off where the
  rebuild starts to matter (a 16-year-old is near adult size), more seeds.

## 2026-10-10 - batch 18, the rebuild on the KLEIN arm (6 runs, Fabio's go: commercial-safe child ages?)

`ARM=<klein|kleinshort|kleinviews> run_qrebuild.sh` (`pairs_rebuild<arm>_*.jpg`): batch 17 as is, on
`flow_character_sheet_from_images_klein.json` (two samplings: portrait, then the body views). ~50-64 s a
run. Three wordings, because Klein's PORTRAIT pass reads `Input_Positive` too (graph nodes 59 + 66):
`klein` = batch 17's words; `kleinshort` = "A 10-year-old child." + clothes; `kleinviews` = the body
words tied to "In the full-body views ...".

- **FAIL, layout, every wording:** the right panel is no longer a close-up portrait - a full standing
  figure (`klein`, `kleinviews`, both sheets) or a crouching one (`kleinshort`, photo). The bodies read
  as a child's build on `klein` / `kleinviews`, and the photo's back hair turns long on `klein`.
- **Verdict: the rebuild stays on the Qwen arm** (batch 17), so a child age at 12 and under makes a
  non-commercial picture, like Body shape. Fabio's fallback rule (2026-10-10). A Klein rebuild would
  need a graph change (size words to the body pass only) - not v1.

## 2026-10-10 - batch 19, Fabio's STEPWISE shape on Klein: portrait first, then the bodies by reference (19 runs)

Fabio: these are edit models - change the big portrait first, then use it as the reference for the bodies, on the
halves, as MPI-1042 does; the front-body face is usually removed by the user (not scored). `qp2b.py` /
`PHASE=1..4 run_qp2b.sh` (`pairs_p2b_*.jpg`, out `mpi1041_age/`). Two body arms: **ref** = an EDIT of the bodies half
with the portrait as image 2; **p2b** = the bodies half DRAWN FRESH by MPI-1042's Klein graph with its pass-1
portrait swapped for the given one (node 77 -> a LoadImage), so only the body pass reads the body words (the batch
18 fix). ~16 s a portrait edit, ~35 s a p2b. Phase 1's child runs fed a mis-cropped portrait (batch 15's sheets are
1 MP, not 1792 wide) - re-run in phase 2.

| case | portrait step (Klein edit, right half) | bodies | verdict |
|---|---|---|---|
| child 10, photo | batch 15 de-age | ref: adult size kept; p2b (2 wordings): slimmer, reads ~13-14 | weak - Qwen rebuild (b17) stays |
| child 10, fisher | batch 15 de-age | p2b: a child's build, hat, suit, tie | **PASS** |
| heavyset, photo | fuller face, double chin | p2b: +17 / +20% width, jacket + jumper + boots kept | **PASS** |
| muscular, fisher | v1 cut the beard; v2 took the jacket OFF; v3 (caption in it) drew a whole body | p2b: muscular, sleeves kept once told "full-length sleeves" | bodies PASS, portrait FAIL |
| skinny, photo | v1 "any beard" ADDED a beard; v2 (caption in it) pasted legs + boots on her chest | p2b: -6 to -8% width, modest | FAIL |

- **The p2b bodies work** (build + clothes, from the portrait alone, a full-height figure). **The portrait EDIT is the
  weak link for body shape:** Klein reads every word literally there - a garment named lands in the frame, "beard"
  adds one, "muscular" strips the jacket. Only heavyset passed clean.
- An EDIT of the bodies keeps the figure's size whatever the reference (as batch 16) - redrawing is what changes it.
- **Verdict:** Body shape stays on Qwen-Image 2.1 for v1 (3 of 3, batch 9) and a photoreal child's body on the Qwen
  rebuild (batch 17). Klein stepwise is the commercial-safe road for both later: heavyset and a stylised child pass
  now; muscular / skinny need portrait wording that names only what the close-up shows (open).

## 2026-10-10 - Phase C: picture checks + card name (session 89967af0)

- `node --test tests/character-sheet-editor.test.cjs` 17/17: which checks each run asks (checks first; Clothes skips the DRESSED
  check; hidden words ask nothing), NOT DRESSED / "I cannot tell" / YES refuse with `CHILD_SAFETY` before any other
  question, "Dressed." / "No." pass; a REAL `submitFlowGeneration` (hand), `routineDeps.submit` (routine) and a
  `generation.submit` job off a fake connector stream (agent) refuse with the same code + message (mutation check:
  dropping `d.code` in flowService fails it); card name + `sourceCardName`.
- `tests/flow-describe.test.cjs` source pin updated. The "could be under 18" check (and its `exposingWords` helper) was
  then REMOVED on Fabio's word (CP Gate 1's job); suites re-run 61/61.
- `npm test` 2973/2975 pass, 0 fail (2 skipped); eslint clean on the six source files.
- Split on CP Gate 1's word to the gate's current rule: 1-15 DRESSED, 16-17 "nude or topless, in underwear or lingerie,
  or in revealing swimwear?" refuse unless NO. Suites 87/87.
- NOT benched yet (Phase E): the DRESSED ask gained "Swimwear or underwear is NOT DRESSED." (A4 pinned it without);
  the 16-17 ask is new.

## 2026-10-10 - Phase D: racks, optional model, docs (session fe4cb412)

- Raw rack insert diff (`git diff -U0`): only `last_node_id` / `last_link_id`, the loader's link list and the consumer
  links' origin changed besides the six added nodes; fresh single-file conversions vs the committed API graphs differ
  by the six `MpiLoraModel` nodes and the consumers' `model` input only (50, 54 / 2).
- `node --test` flow-lora-rack 21/21 (three new rows), character-sheet-editor 18/18 (new: per-leg phases, rebuild leg
  gets no Klein rack), flow-licence-surface 7/7 (new: optional model listed for its licence, out of install keys; the
  install-key assert fails on the old `flowInstallKeys`), flow-field-constraints, flow-legs, flow-model-choice,
  inject-params-titles: 125/125 together. agent-corpus / prompt-budget / recipe-registry green after the agent paragraph.
- `npm test` 2983/2985 pass, 0 fail (2 skipped). `npm run lint` + `lint:components` clean.
- Desktop spec tests/desktop/flow-optional-model-row.spec.js PASS (Klein installed: two labelled slots, Qwen row = name +
  enabled Install, one cogwheel; download:started -> Installing, disabled; installed -> no Install row, two cogwheels,
  the second "LoRAs for Qwen-Image 2.1"). flow-lora-button, flow-chain-toggle, flow-clear-slot-advances: 5 passed.
- NOT seen by eye yet: the Library's Optional models list (Phase E).
