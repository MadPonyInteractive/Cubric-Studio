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
