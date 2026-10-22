# MPI-1212 validation

2026-10-20 prep (no GPU):
- `python research/flowbench.py dry` -> all 6 Klein Flow templates swap to FLUX.3 Turbo + base and pass the link/no-Klein check.
- `research/inputs.json`: 2 real past runs per Flow (Make Seamless: none on disk).

No bench run yet: waiting on the GPU-free go.

2026-10-22 Pod bench, run 1 (RTX PRO 4500, `research/flowbench.py run 53061 <graph> 111 222`;
sheets `research/sheets/<graph>.jpg`, cols today | FLUX.3 Turbo | FLUX.3 base). No LoRA active in
any captured graph, so the swap is like for like. Time per run: Klein ~13 s, Turbo ~16 s, base ~47 s.
50/60 runs success; cse1/cse2 cut off when the Pod disappeared (404 at ~04:03Z).
First read (Fabio has the final say):
- Draw It In: dii1 (squirrel) Klein wins - follows the brown drawing, fills the box; FLUX.3 draws a
  small grey squirrel. dii2 (cap) tie; base seed 111 makes the cap blue.
- Scribble: Klein wins clearly. FLUX.3 copies the doodle's flat paint (base keeps it painterly,
  Turbo bends the bed); Klein renders a real scene.
- Outpaint: FLUX.3 Turbo FAILS - leaves the black padding unpainted (pass 1 and 2, both inputs,
  both seeds). Base fills it, close to Klein. -> Klein stays; FLUX.3 base at best a tie at 4x the time.
- Character Sheet Editor (Klein slot), from Images, editor Qwen slot, Make Seamless: not run yet.
- Character Sheet from Images (vs Qwen-Image 2.1), csfi1_2 seed 111: Qwen wins. Turbo = plastic doll skin
  (Fabio 2026-10-22: "horrible"); base = 3D game-model render, A-pose, close-up loses the shirt. Both keep
  the source photo's pink backdrop instead of the Flow's grey. Turbo 31 s, base 107 s, Qwen 54 s.
- csfi1_2 seed 222 same picture: Turbo plastic, base game-model (A-pose).
- csfi2_1 (3D anime girl, no body picture): Qwen wins. Style held by all three. FLUX.3 breaks the Flow's
  rule that the close-up is three-quarter: Turbo frontal on both seeds, base on seed 111; base A-poses
  again. FLUX.3 dresses her in grey trousers/jumpsuit (Qwen: short dress), invented either way.
  Turbo 25 s, base 79 s, Qwen 41-47 s.
- Editor Qwen slot, beard (cseq1_0, "blue long Viking beard with braids", vs Qwen): FLUX.3 Turbo is the
  closest call yet - beard on front and close-up both seeds, real hair texture, braids; navy rather than
  bright blue, close-up face slightly more rugged than the input. Base misses the front view on seed 111.
  Qwen: bright blue, cleaner, identity tight. Turbo 30 s, base 105 s, Qwen 44 s. Fabio's call.
  (sheet.py now takes Output_Image_2 when Output_Image never ran - the editor's Qwen leg.)
  Fabio 2026-10-22: "the beards look decent" -> beard is a FLUX.3 candidate for the Qwen slot.
- Editor Qwen slot, tattoo (cseq2_0, body tattoo from a reference photo, vs Qwen): mixed. FLUX.3 copies the
  REFERENCE design far more faithfully (black panels, copper linework) where Qwen paints a generic ornamental
  pattern - but FLUX.3 also carries the reference's black bikini onto the sheet, and leaves the close-up
  bare (Turbo seed 111, base both seeds). Qwen covers all three views every time. Turbo 47 s, base 189 s,
  Qwen 66 s. Fabio's call; a FLUX.3 prompt saying "the tattoo only, none of the clothing" is the obvious retry.
- Character Sheet Editor, Klein slot (vs Klein 9B): cse1 tank top = tie Klein/Turbo, base misses the close-up
  both seeds (~270 s/run). cse2 basketball jersey = Klein wins; FLUX.3 only prints numbers on the existing
  white vest. -> Klein stays.
- Make Seamless (vs Klein 9B), first edit window of moss (seam2_1) + window 2 (seam2_3): Klein wins - FLUX.3
  leaves a visible darker strip down the join (base worst). seam1 (brick) dropped: the Pod input files
  win_N_img.png are shared by name, seam2's replay overwrote them. -> Klein stays.

Round 2, FLUX.3 with FLUX.3-shaped prompts (Fabio 2026-10-22: Flow wording is Klein/Qwen's; BFL-shaped
prompts are needed). bfl.py = per-case prompts written to BFL's i2i upsampler rules looking at the inputs:
- csfi1 (man): BFL prompt fixes the backdrop (grey) and softens the plastic skin on Turbo, but the full-body
  face drifts off the input man on both seeds. Base still a game-model render. Qwen still ahead.
- csfi2 (anime girl): BFL prompt makes FLUX.3 follow the outfit and the three-quarter close-up; style holds.
  Closest FLUX.3 got to Qwen on this Flow. Fabio's call.
- Scribble: BFL / F3-template prompt removes the flat-paint carry on Turbo (a real photograph, real river,
  rock, grass); the trees still keep the drawing's blob outline. Reference at 0.25 MP (s3lo) gives the most
  natural trees and the only unbroken bed on scr2 seed 222. Klein still renders the prettier picture but
  moves the layout; FLUX.3 now follows the drawing. Fabio's call.
- Template route (qwenprompt.py f3a/f3b, Turbo): csfi1 (photo) = grey backdrop, skin far less plastic, face
  holds - the best FLUX.3 result on this Flow. csfi2 (anime) = the photo clause leaks: skin turns semi-real,
  outfit turns to jeans/jumpsuit. Soft light (f3b) changes little. So the clause must branch on the medium.
- Spend: Pod 1 ~$0.57 + Pod 2 04:08-05:40Z ~$1.10 = ~$1.70 of the $5 cap; Pod still up at $0.72/hr.

FABIO'S VERDICTS 2026-10-22 (final for run 1 + round 2):
- Scribble: FLUX.3 FAILS - the sun stays a drawing, on every prompt. Klein stays.
- Character Sheet from Images: FLUX.3 Turbo PASSES (round-2 FLUX.3-shaped prompt); base does not.
- Editor beard: FLUX.3 Turbo PASSES, better than base.
- Editor tattoo: one Turbo run passed; base copied the full-body tattoo very well but missed the close-up.
  Not a pass yet - the close-up miss is the thing to fix.
- Pod: Fabio deletes it (and the volume) himself. Further tests run LOCALLY.
- From-images, which prompt (Fabio 2026-10-22): the hand-written BFL-style prompt (bfl.py, csfi*_bfl) gave the
  best result on every run, ahead of the template route (qwenprompt.py, csfi*_qp). Agent's first read had the
  template ahead on the photo man (csfi1); Fabio's look overrides it.
- PASS BAR (Fabio 2026-10-22): FLUX.3 adding a bikini (any clothing) to a nude character is a big fail and keeps
  it out of the Character Sheet Flows. Run 1 tattoo (Flow prompt): every FLUX.3 front view wore the black
  bikini, both seeds, Turbo and base; the reference photo wears that bikini, so copying vs censoring is not
  settled. Settled by: cseq2_0 BFL rerun (prompt says no bikini) and cseq7 undress on FLUX.3.
- Undressing on FLUX.3 (Fabio 2026-10-22, his own tests): FAILS without a LoRA, and no community nudity LoRA for
  FLUX.3 exists yet. 1-2 successes out of his tries, and those had breasts without nipples and no genitalia.
  -> Undressing stays on Qwen; cseq7 is NOT benched on FLUX.3. The same anatomy loss applies to ANY nude
  sheet FLUX.3 redraws (the tattoo case's sheet is nude), so a nude input fails every Editor category on FLUX.3.
  Revisit when a FLUX.3 nudity LoRA appears.
- Tattoo back view, run 1 (Fabio 2026-10-22, agent confirmed on hip crops): FLUX.3's view from behind draws a
  FRONT pelvis - a front bikini-bottom V over a groin shape where the glutes should be (Turbo both seeds, base
  seed 111); base seed 222 has glutes but flat, cleft barely there. Qwen draws real glutes. Anatomy fail on
  top of the bikini carry.

LOCAL BENCH 2026-10-22 night (Fabio asleep; GPU ok'd, everything under gpu_lease; agent's first read, Fabio judges):
- Tattoo fix, BFL prompt (sheet `cseq2_0_bfl.jpg`; Turbo ~80 s, base ~400 s locally). Close-up FIXED: all four
  runs tattoo the shoulders and chest. Bikini NOT fixed on Turbo: both seeds still wear the black bikini top and a
  thong V, despite the prompt naming it. Base seed 111: no bikini, nipples present, back view reads as glutes;
  base seed 222: black panels shaped like a bikini top over the breasts. The reference's CHOKER now comes over
  (both base runs, Turbo seed 111 close-up). -> Turbo fails Fabio's bar; base 1 of 2 at 5x Qwen's time. Fail.
Clothed Qwen-slot cases, Qwen vs FLUX.3 with hand-written BFL prompts, 2 seeds (sheets `cseqN_*_bfl.jpg`;
Qwen ~70-90 s, Turbo ~35-55 s, base ~155-220 s locally). Sheet columns 2 and 4 are empty on purpose (no Flow-
prompt FLUX.3 runs locally):
- Body, extremely overweight (cseq3_0): FLUX.3 goes FURTHER than Qwen - Turbo clearly heavier in all three views,
  dress, heels and bob kept, face stays her; base heaviest but the face drifts rounder/older. Qwen is only plump
  for "extremely". Agent: Turbo WINS on following the words.
- Hair, black-pink bob with fringe (cseq4_0): both deliver the cut on all three views. FLUX.3 (both) makes a
  blunt helmet bob, jet black top, hard pink band - reads as a wig; Qwen's gradient and fringe look natural.
  Agent: Qwen ahead, FLUX.3 a usable second.
- Makeup from a photo (cseq6_2, the face-crop leg; the mannequin leg ran on FLUX.3 too): all three put the
  spiderweb + orange eyeshadow + black lips on the close-up and the small front face. Qwen's is boldest and
  closest to the photo; FLUX.3 Turbo slightly lighter. Agent: TIE, Qwen by a hair.
- Child age 10, dressed (cseq8_3, the Qwen rebuild leg after Klein's two passes): FLUX.3 gives real child
  proportions (short body, bigger head, younger smiling face) on both seeds; Qwen's full bodies stay teen-tall.
  All three close-ups copy the input portrait (cardigan V neckline included). Agent: FLUX.3 WINS (Turbo).
  (sheet.py now takes Output_Image_2 first on cseq* graphs - Output_Image there is the mannequin helper.)
