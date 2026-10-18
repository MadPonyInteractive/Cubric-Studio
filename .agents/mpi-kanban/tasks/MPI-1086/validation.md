# MPI-1086 validation

Bench images (adult renders, some near-nude): G:/ComfyUi/ComfyUI/output/mpi1086/, never in the repo.

## Phase A round 1 (`qh1.py`, `h1_*`): the fringe, Fabio's sheet flowCSFI_002, shipped Hairstyle string

`h1_mask` (lock 2's final mask): SAM3 "face" runs from the HAIRLINE down on the front and the close-up - the whole
forehead is locked, exactly where a fringe falls. Back: no lock.

| case | fringe (front / close-up) | notes |
|---|---|---|
| R lock 2 fab / s42 / s7 (repro) | 0/3 | fab bare forehead; s42 thin strands pasted along the hairline; s7 stops at the hairline |
| F lock 0 fab / s42 / s7 (control) | 3/3, front and close-up | same string, nothing else changed |

Root cause = the lock, not the wording. Every run (R and F) also turned the back's halter top into a tube top (the
back is free at lock 2 and the new bob covers the neck): separate from the fringe, noted for Fabio.

## Phase A round 2 (`qh2.py`, `h2_*`): lock 2's face lock cut at the brow line

Patch (lock 2 only, an IfElse on node 12 keeps lock 1 whole): front and portrait SAM3 "face" masks each x a box from
`face top + h // k` down. Masks (`h2_*_mask`): forehead open, brows / eyes / face below locked, on both panels.

| cut | fringe front | fringe close-up | face |
|---|---|---|---|
| B4 `a + b // 4` (above the brows) | 2/3 (fab kept a side part) | 3/3 | same |
| **B3 `a + b // 3`** (brows free) | **3/3** | **3/3** | same |

B3 wins. Next: B3 regression on Fabio's other hair words + lock-1 mask identity (`qh4.py`), then phase B on B3.

`qh4` K1: lock 1's mask through the B3 graph vs the shipped graph: **pixel-identical** (diff bbox None) - Clothes
runs cannot change.

`qh4` G (B3, Fabio's words-only hair cases, s42 / s7):
- "Two thick large Viking braids": pass 2/2, forehead and face unchanged.
- "Blonde French braids": pass 2/2; s7's brows went lighter with the hair (B3 frees the brows); the back's braids still
  end in dark tips on s7 (Fabio's original report, unchanged by this card).
- "Black and pink Bobcut" (no fringe asked): now draws a FRINGE 2/2 - the locked forehead used to forbid one. Trade-off
  for Fabio: "no fringe" in the words is the user's way out.

## Phase B round 1 (`qh3.py B3`, `h3_*`): a Hairstyle from a Reference picture, lock 2 + B3 brow cut

Ref = Fabio's curly blonde buns with a fringe (a face PHOTO, knit top + necklaces), P = the photo, H = a head-only crop.
N1 = only the close-up named; NA = every figure named (back "seen from behind"); WA = NA + "in pink". fab / s42 / s7.

| case | colour all panels | close-up buns + fringe | front / back bodies | leak (ref top, necklaces) |
|---|---|---|---|---|
| N1 P | 3/3 | 1/3 (s42) | long loose hair 3/3 | close-up s42; back s42 knit top |
| N1 H | 3/3 | 1/3 (s42) | long loose 3/3 | none |
| NA P | 3/3 | 3/3 | long loose 3/3 | close-up 3/3; back s42 knit top |
| NA H | 3/3 | 3/3 (s7 one bun) | long loose 3/3 | none |
| WA P "in pink" | pink 3/3 | 3/3 | long loose 3/3 (s42 front half-up) | close-up 3/3; back s42 |

- Naming every figure carries the style to the close-up (3/3 vs 1/3); the colour reaches every panel either way.
- The full bodies keep the OLD long hair, only recoloured: 0/15 buns. Same lesson as the bikini (MPI-1041 F2 rounds
  4-7): the old thing must be taken away in words, or Klein keeps it.
- A photo leaks its clothes and jewellery into the close-up; the head crop does not. No extra figure, no layout break.

## Phase B round 2 (`qh8.py`, `h8_*`): take the old hair away in words, keep her own face and clothes

R1 = "Replace the character's hairstyle with ... The old hairstyle is gone from every figure." + every figure named +
keep own face and clothes; R2 = R1 + the bodies told to match the close-up. Photo P, fab / s42 / s7.

| case | close-up buns | bodies | leak |
|---|---|---|---|
| R1 P | 1/3 (s42) | long loose 3/3 | s42 knit top + necklaces, back knit top; s7 a necklace |
| R2 P | 0/3 | long loose 3/3 | s42 back knit top |

WORSE than NA (close-up 3/3). The bodies never take the picture's style (0/21 over rounds 1-2), while WORDS change them
(qh4: bob 2/2, Viking braids 2/2, French braids 2/2). Next: the picture turned into words (the describer's job), benched
with a hand-written description first (`qh10.py`).

## Phase B round 4 (`qh10.py`, `h10_*`): the picture described in WORDS (hand-written, standing in for the describer)

DESC = "messy platinum blonde hair tied up in two curly space buns on top of the head, with a wispy curly fringe and
loose curly strands framing the face". Photo P, fab / s42 / s7.

| case | front buns | back buns | close-up | leak | layout |
|---|---|---|---|---|---|
| D1 shipped Hairstyle string, DESC as the words, picture ON | 2/3 | 1/3 (fab, s7 kept long brown) | 3/3 | 2/3 | held |
| **D2** "the hairstyle and hair colour from the reference picture: DESC" + every figure named, picture ON | **3/3** | **3/3** | **3/3** | close-up 3/3 | held |
| D0 = D1, picture OFF (words only) | 3/3 | 3/3 | 3/3 | none | **s7 back figure drawn with a FACE** |

Words are what move the bodies; the picture keeps the colour/texture and, with every figure named, the layout. D2 leaks
the photo's knit top and necklaces into the close-up: next D3 = D2 + the keep line (`qh11.py`).

## Phase B round 5 (`qh11.py`, `h11_*`): stop the photo's clothes leaking

D3 = D2 + "Keep the character's own face and clothes.": buns front 3/3, back 3/3, close-up 3/3 - but the close-up
still wears the photo's knit top and necklaces 3/3. The keep line that stopped AW3's leak does not stop it here (the
photo is a portrait framed like the close-up). Next: D4 (words forbid it) and D3 on the head crop H (never leaked).

| case | hair (front / back / close-up) | leak | her own top in the close-up |
|---|---|---|---|
| D4 "Take only the hair ... no clothes or jewellery." + keep line, photo | 9/9 | none | **0/3**: white tank (fab), bare shoulders (s42, s7); s42 BACK top turned skin-coloured |
| D3 on the head crop H | 9/9 | none | 2/3 (s42 bare shoulders) |

Removing the clothes from the PICTURE works; forbidding them in words strips hers too. A fixed crop would bring the
chest back for long hair, so round 6 cuts the reference out to head + hair in the graph.

## The real describer on the hair refs (`qh12.py`, the app's imageDescribe graph, Qwen3-VL 4B)

Ask: "Describe only the hairstyle of the person in this picture: its length, its shape, how it is worn (loose, tied
up, braided, in buns or bunches), the fringe if there is one, and the hair colour. Answer with one phrase that starts
with the hair colour, and nothing else."

| ref | answer |
|---|---|
| buns photo | Blonde hair styled in two high buns with loose, wavy strands and a fringe. |
| pin5 pink buns | pink hair styled in two high buns with bangs |
| pin6 curly fade (man) | Dark brown, curly, textured, short on sides, long on top, worn loose with a faded undercut. |
| pin7 braids | dark brown, long, intricately braided into multiple thick plaits that cascade down the shoulders with loose, natural movement and no fringe. |
| pin8 pigtails | brown, long, loose, in two high pigtails with bangs |
| pin9 textured fade (man) | Black, short on sides with textured top, styled upward and back, no fringe. |
| pin10 puff buns (boy) | black, styled into two distinct buns on top of the head |
| pin11 fringe + updo | black, tied up in a high bun with bangs |

All right and usable as the words. Round 6 (`qh13.py`) runs them all through D3 with the reference CUT OUT to head +
hair on grey inside the graph (lock 2 only).

## Phase B round 6 (`qh13.py`, `h13_*`): describer words + D3 + the reference cut out (SAM3 "head, hair" on grey)

Cut-outs (`h13_cut_*`): no clothes or jewellery-on-the-body in any. Buns, pink buns, braids, fringe+updo = hair ONLY;
the two men, the pigtail girl and the boy = head WITH the face (a grey hole at the mouth).

| ref | Fabio's sheet s42 / s7: hair front / back / close-up | leak | other |
|---|---|---|---|
| buns photo | 2/2 all three | none | her halter kept |
| pin5 pink buns | 2/2 | none | |
| pin7 braids | 2/2 (braided to the waist on the back) | none | |
| pin8 pigtails + fringe | 2/2 | s42 close-up wears HER hoop earrings | |
| pin10 puff buns | 2/2 | none | s42 close-up straps faint |
| pin11 fringe + updo | 2/2 | none | |
| pin6 curly fade (man) | 2/2 (s42 shaved side, s7 curly bob) | none | |
| pin9 textured fade (man) | 2/2 | s42 close-up STUBBLE on her jaw | |
| pin6 / pin9 on the fisherman (cartoon) | 1/1 each, beanie gone, style stays cartoon | none | |

Hair on every panel 18/18 runs; no clothes leak anywhere (was 3/3 on the photo). The two leaks both come from a cut-out
that KEPT the face (earrings, stubble). Next: SAM3 "hair" alone on those four refs (`qh14.py`).

## Phase B round 7 (`qh14.py`, `h14_*`): SAM3 "hair" alone for the cut-out

Cut-outs: hair only on all four (pin8 keeps faint outlines of the hoops). Results, Fabio's sheet s42:
pin6 curly fade - undercut + curls on all three, no stubble; pin8 pigtails - all three, NO earrings; pin9 textured fade
- all three, NO stubble; pin10 puff buns - all three (a small hair clip in the close-up). Her halter kept 4/4.
**SAM3 "hair" ships.** (The other four refs' "head, hair" cut-outs were already hair only, so they are unchanged.)
Shipped graph = B3 brow cut + this cut-out (`patch_raw_cutout.py` -> raw -> one-file convert, injection gate passed),
proved node-for-node equal to `qh14.graph` (102/102). Builder hair+picture = `qh11.d3` + the describer's words,
byte-identical (checked). Tests: character-sheet-editor + inject-params-titles + flow-legs + flow-chain 77/77.

## Phase B round 8 (`qh15.py`, `h15_*`): the user's OWN words on top of a hair picture

D3 + "Change only this about the hairstyle: <words>." on the shipped graph, s42 / s7:
- pin5 pink buns + "in blue": close-up blue (s7 half pink), both BODIES STAYED PINK 2/2 - the describer's "pink hair"
  outvotes the words on the bodies. FAIL.
- pin11 high bun + "with the bun lower, at the nape of the neck": a nape bun ADDED to the top bun 2/2. FAIL.
Round 9 (`qh15.py ... round9`): W2 = the words lead ("the hairstyle from the reference picture, changed like this:
<words>. The hairstyle in the reference picture: <desc>. Make it <words> on every figure ..."); W3 = "<desc>, but <words>".

| case | W2 (words lead) | W3 ("<desc>, but <words>") |
|---|---|---|
| pin5 + "in blue" | **blue on all three panels 2/2** | pink and blue mixed 2/2 |
| pin11 + "with the bun lower, at the nape of the neck" | a nape bun ADDED to the top bun 2/2 | same |

**W2 ships** for words with a hair picture. Moving part of a style fails in every wording (3 shapes, 6 runs): words
recolour and add, a different shape needs a different picture - say so in the hint.

## Phase C round 1 (`qh5.py`, `h5_*`): an Accessory from a Reference picture, lock 0, shipped accessories tail

Refs made with Klein t2i (seed 42, `G:/ComfyUi/ComfyUI/input/mpi1086_ref_*.png`): brown leather backpack and gold
hoops (product shots), a young man in a red paisley bandana, a black rose forearm tattoo. AN = "the accessory from the
reference picture"; AW = the words name it ("the large gold hoop earrings from the reference picture"). s42 / s7.

| ref | AN (no words) | AW (words) |
|---|---|---|
| backpack | back 2/2; front wears it on the CHEST 2/2 | back 2/2; front chest 1/2, straps only (right) 1/2 |
| earrings | **FAIL 2/2**: hoops became a necklace pendant, bracelets, a ring on the belt | **pass 2/2** (front + close-up; back hidden by hair) |
| bandana (worn by a person) | close-up 2/2, front 0/2, back knot 1/2; s42 close-up took his white tee and a softer face | close-up 2/2, front 0/2, back 1/2; s42 face drifts to HIS, white tee |
| tattoo (on an arm) | **FAIL 2/2**: tattoos on the FACE and chest | **pass 2/2**: forearms, front + back |

- No words: a product shot does not say WHERE it is worn (hoops -> necklace, a rose -> the face). Words fix it.
- A person in the reference leaks his face and clothes into the close-up on a free edit (bandana s42, both shapes).
- The small front figure misses head items (bandana 0/4).

## Phase C round 2 (`qh7.py`, `h7_*`): the fails left with words

AW2 = every figure named, "worn the same way", + "Keep the character's own face, hair and clothes."; AW3 = round 1's
AW (the shipped accessories tail) + that keep line only. s42 / s7.

| ref | AW2 | AW3 |
|---|---|---|
| backpack | chest on the front 2/2 (worse) | right 1/2 (s7), chest 1/2 (s42); back 2/2 |
| bandana (worn by a man) | **close-up BECAME THE MAN** 2/2 (his face, white tee); back bow 2/2 | front 2/2, back 2/2, close-up HER face 2/2, no tee |
| earrings | pass 2/2 | - |
| tattoo | pass 2/2 (arms front + back, none on the face) | - |

AW3 confirmed on the rest: earrings 2/2 (front + close-up), tattoo 2/2 (forearms front + back, none on the face).
**AW3 wins** (8 runs, 4 refs): the keep line stops the reference person leaking in (round 1: 1/2 leaked, AW3 0/2); naming every figure
"worn the same way" pulls the reference PERSON in. Left: a backpack worn on the chest 1/2 - the words can say "on her
back". No words with a product shot fails (round 1: hoops -> necklace, rose -> face) - words required with a picture.

## Custom (`qh6.py`, `h6_*`): the new free edit in the user's words, lock 0, accessories tail

C1 = the words as typed + the tail; C2 = "Change the character in this character sheet: <words>." + the tail. s42 / s7.

| words | C1 | C2 |
|---|---|---|
| "a vampire with pale skin and red eyes" | 2/2 on all three, clothes kept | 2/2, but redressed in long sleeves 2/2 |
| "make her a robot with metal skin" | bodies 2/2, close-up face stays human 2/2 | same |
| "holding a sword" | **LAYOUT BROKEN s42** (front figure redrawn as a back view); s7 ok | 2/2 ok |

C2 wins (no broken layout; the redress is arguably part of "a vampire"). Both miss a whole-body change in the close-up
(robot): the close-up only shows the head and shoulders and keeps a human face - noted for Fabio.

## CI (2026-10-12)

`85f96744a` Tests run 38258557951: success (11m11s). Awaiting Fabio's eye test in the app.

## Fabio eye test 1 (2026-10-12): FAILED - hairstyle from a picture

- Pink space buns (reference has dark roots): style taken, roots lost - colour wrong.
- Same + "in blue": back figure kept PINK buns; front + close-up blue. Figures disagree.
- Man + short textured crop with fade, "gradient purple top, black bottom": back of head unlike the reference, no fade.
- Same + "in purple": back view differs from reference.
- Same, no words: long wavy hair - nothing like the short crop. Morphing (two ears).
- Woman + box braids, no words: braids ok, close-up face out of place.
- Same + "in silver white": FRONT figure kept dark hair; back + close-up silver.

Verdict (Fabio): picture route is less consistent than words alone; hard pictures fail. Accessories parked; nail hairstyle first.
Fabio testing his own approach (extract the hair, remove the character) - STAND BY for it before any new approach.

Asks: (1) label "Reference picture (optional)" then the rest on a NEW line (flowsRegistry.js:1744, MPI-1101 claim);
(2) carry the beard - optional switch, or a new "Beard" entry.

## Fabio approach test (2026-10-12)

- Hair cut out on grey (= what our lock-2 graph does today): proportions wrong, colour off.
- Klein edit "replace the woman with a mannequin, keep the hair" in the image workspace, then that as the reference: proportion + colour closer; close-up face OUT OF PLACE, double ears.
- Fabio: Beard = a SEPARATE "Beard" entry (not a switch on Hairstyle).
- Suspect: lock 2 freezes the SAM3 face (brows down) and stitches it back; when the new hair changes the head outline (up-do, ears bared) the frozen face no longer sits on the redrawn head -> shifted face + a second ear. Lock 0 control on words was 3/3 (top of this file).

## Round 16 (`qh16.py`, `h16_*`): Klein mannequin of the photo as the reference, no cut-out, face lock A / B / C

Mannequin ("Replace the person with a mannequin but keep the hairstyle.", s735724985): hair kept 3/3, roots kept;
pin7 keeps her earrings, necklaces, white blouse and the leafy background; pin6 keeps the 3/4 head turn.
Describer on the pin5 mannequin: "pink" only (Fabio's edit_004 got "Pink and dark brown") -> roots lost.

| sheet | A lock 2 (shipped) | B lock 0 | C lock 2 "eyes, nose, mouth" |
|---|---|---|---|
| W buns | 2/2 hair on all three, face ok | identity lost 2/2 | s42 ghost double face |
| M man (pin6, 3/4 photo) | s42 face OUT OF PLACE + second jaw/ear; s7 seam at the eyes, a different man | s42 back figure DOUBLED; identity lost 2/2 | s42 mangled face; s7 identity lost |
| B braids | close-up takes the reference scene, blouse, jewellery 2/2; backpack lost | ref person leaks 2/2; s7 MANNEQUIN face | s42 front redrawn as a back view |

Root cause of Fabio's double ear: Klein copies the REFERENCE'S HEAD POSE / head shape; lock 2 pastes the old face
(brows down) onto the turned head. B and C dropped. Round 17: the mannequin turned to FACE THE CAMERA, bare (no
jewellery, no clothes), plain grey; describer asked for roots / two-tone; lock A only.

## Rounds 17-18 (`qh17.py`, `qh18.py`)

r17 mannequin M2 (facing the camera, bare, head and shoulders): roots kept and described ("Pink hair with dark roots",
ASK2); braids CUT to a crown braid. Man s42 still broke (back figure doubled, head tilted under the kept beard) with the
picture AND with words only (`h17_N_M_s42`) -> the LOCK, not the reference. Words only on buns: three figures agree,
but the roots became black streaks and the buns lost their shape -> words alone lose the style. Fabio: do NOT force the
camera view - a cut reads better at 3/4.

Lock-2 mask on the man (`h17_maskM`): face from the brows down; jaw outline, ears, neck FREE -> Klein swings the head,
the kept beard patch stays (double jaw / second ear). "face top + a third" lands MID-EYE on his close-up.

r18 L18 lock = "face, neck" + brow line = SAM3 "eyes" top minus the eyes height (`h18_maskM`: jaw + neck held, cut
just above the brows): man s42 + s7 face in place, identity kept; buns s42 clean on all three. FIXED the double jaw.
r18 mannequin M3 (3/4, "showing the full length of the hair"): GREW the man's crop into a long mullet, pink strands
long and straight; braids right. Left: an EXTRA BACK FIGURE (man s42, braids s42; also h16 M_B s42, h17 M s42) - the
back panel has no lock at lock 2.

r19 (`qh19.py`): mannequin M4 (Fabio's string, 3/4, "keep the hairstyle exactly as it is: the same length, shape and
colour", bare, grey) = RIGHT 3/3, describer (ASK2) right 3/3 (roots, fade, plaits). L19 = L18 + back-panel background
held outside the padded SAM3 "person" box: braids s42 no extra figure (but her BACKPACK lost front + back, braids in
its place); man s42 close-up right but a half figure squeezed between the held strip and his wide box; man s7, buns
s42 clean on all three. Round 20: hold the back background outside the person SILHOUETTE grown 40 (not a box);
keep line + "and anything they wear or carry".

r20 (`qh20.py`): L20 = back background held outside the back figure SILHOUETTE grown 40 (SAM3 "person" leaves the
backpack out, so its middle is held too) + keep line "...and anything they wear or carry". Braids s42: backpack KEPT on
the back (front straps lost); buns s42, man s7 clean; man s42 STILL two back figures, overlapped inside his outline.
Man s42 fails under every hold tried (r16-r20) and passed words-only (h17_N) -> the picture + that seed. Next: the
failure RATE of the r20 setup, 4 fresh seeds x 3 sheets (`qh20.py rate`).

r20 RATE (`qh20.py rate`, s1-s4): man 2/4 (s2 double jaw - a second beard drawn BELOW the kept one; s4 extra back
figure + double jaw); braids 2/4 (s1 front figure redrawn as a back view; s4 ghost second jaw); buns 3/4 (s4 a small
extra figure pasted into the close-up). 7/12; with s42/s7 about 11/17. The paste-back lock is the weak point: Klein
redraws the head bigger or lower and the kept face does not move with it. Mannequin + describer are right 3/3.

## Round 21 (`qh21.py`, `h21_*`): hair from a PICTURE on Qwen-Image 2.1 (Fabio 2026-10-14: Qwen for the picture, Klein for words)

The Editor's Qwen graph (no lock) + the M4 mannequin as images.image_2; string "Give the character in image 1 the
hairstyle and hair colour from image 2: <describer>, with the head uncovered and no hat." + ALL + OWN + KEEP.
**6/6 clean** (man, braids, buns x s42/s7): the hairstyle on all three figures, faces kept, no double jaw, no extra
figure, backpack kept (braids: front + back), the buns' DARK ROOTS kept (first time). 111-145 s an image. Next: rate s1-s4.

r21 RATE (`qh21.py rate`, s1-s4): man 4/4 (crop + fade all three, own face, backpack); braids 4/4 (backpack front +
back; braids end SHORTER than the picture's cascade); buns 3/4 (s3 front figure kept some of her old long hair down
beside the buns). **Qwen 17/18 vs Klein ~11/17 (r16-r20).** DECISION (Fabio 2026-10-14): hair FROM A PICTURE ->
mannequin M4 on Klein -> describer ASK2 -> Qwen edit (image_2 = mannequin, the r21 string); hair in WORDS stays Klein.
Grids: session scratchpad h21_grid.jpg, h21r_{M,B,W}.jpg (not repo).

## Round 22 (`qh22.py`, `h22_*`): qh21 WITHOUT the mannequin - raw photo as images.image_2, ASK2 on the raw photo

Describer on the raw photos: buns "Pink hair with darker roots, two high buns with loose bangs"; man "Dark brown with
lighter highlights and a faded root" (the CUT is not named - the mannequin's read was "textured, curly top and a faded
undercut"); braids "multiple intricate braids that cascade down the shoulders". Qwen took the cut from image 2 anyway.
**5/6.** Man s42 + s7: crop + fade on all three, own face and beard, backpack, no sweater or street (s7 curlier, closer).
Braids s42 + s7: braids on all three (looser, closer to the photo than r21), own face, no hoops, necklaces or blouse,
backpack front + back. Buns s42 clean. **Buns s7 FAIL: the FRONT figure wears the photo's make-up** (dark red lipstick,
heavy brows and contour); close-up and back her own; r21 (mannequin) s7 clean. The face leak the mannequin exists to stop.
Grids: session scratchpad h22_{M,B,W}.jpg, h22_Wfaces.jpg, h22_Bfaces.jpg (not repo).

## Round 23 (`qh23.py`, `h23_*`): the mannequin INSIDE the Qwen graph - one graph, the shipping shape

Input_Image_2 (raw photo) -> Klein 9B free edit (M4, seed MSEED, 1 MP, 4 steps lcm cfg 1, no LoRA) -> MpiClearVram ->
TextEncodeQwenImage21 images.image_2; describer words = r22's (raw photo, ASK2), as the app would give. In-graph
mannequins: a bare white bust with the hair only (crop + fade, braids, pink buns + dark roots) - cleaner than M4 on the
generic graph. **6/6 clean**: man crop + fade on all three (s7 curly, close to the photo), own face and beard,
backpack; braids on all three, own face, backpack front + back; buns + roots on all three, her own face both seeds -
**the r22 s7 make-up leak is GONE**. Time 111-244 s an image, but M s7 took 2534 s (once; cause not known - check RAM
with both models in one prompt before shipping). Grids: session scratchpad h23_{M,B,W}.jpg, h23_faces.jpg.

r23 RATE (`qh23.py rate`, s1-s4): man 4/4 (crop + fade all three, own face and beard, backpack); braids 4/4 (braids
all three, backpack front + back, own face); buns 3/4 - **s3 the FRONT figure kept her old long brown hair, no buns**
(the same seed failed the same figure in r21: old hair left down beside the buns). **r23 = 17/18, equal to r21**: the
mannequin inside the graph costs nothing. 108-177 s an image (first of a run ~160-245 s, loading). RAM log (scratchpad
mem23.log): commit charge 81-83 of 82-84 GB across the whole window with MPI-1101's bench + Fabio's app + ComfyUI
loaded, at the limit; the one 2534 s image (M s7) ran beside that bench = paging, not the graph. The 16 GB tester:
Klein + Qwen in one prompt is the same total as the two jobs back to back on a machine that keeps models resident.

## Round 24 (`qh24.py`, `h24_*`): the user's OWN WORDS with a hair picture, r23 graph, the builder's with-words string

Fabio's eye-test words: buns "in blue", man "gradient purple top, black bottom", braids "in silver white"; string =
the shipped W2 shape with image 1 / image 2 (`buildChangePrompt('hair', words, true, refHair)`). **6/6**: blue buns +
bangs on all three, her own face (s42, s7); purple top with black faded sides on all three, own face, beard, backpack;
silver-white braids on all three (eye test 1 left the FRONT figure dark), backpack front + back, own face. The fixes
for eye test 1's colour disagreements (back kept pink, front kept dark) hold. Grids: session scratchpad h24_{M,B,W}.jpg.

## Round 25 (`qh25.py`): the SHIPPED graph file, both switch sides

`comfy_workflows/flow_character_sheet_edit_qwen.json` (patch_raw_qwen_ref.py + one-file convert, 45 nodes, injection
rules OK) injected as the app does. Buns s42 with the photo + Input_Reference on = **pixel-identical to h23_W_s42**
(PIL difference bbox None). Body shape "heavyset" with no picture, Input_Reference off: heavier body on all three, same
face, hair, dress and layout - the old one-picture edit still works. Tests: character-sheet-editor 21/21, related flow
suites 118/118, full `npm test` 3313 pass / 0 fail; eslint clean on the three changed js files.

## Eye test 2 (Fabio, in the app, 2026-10-14): hair from a picture on Qwen

Sheet flowCSE_031 + a photo of a girl with two high pigtails, Headless front body ON. Run 1, no words: the describer
(raw photo) said "two high bunches" - our own ask listed "in buns or bunches" - and Qwen drew BUNS in the close-up,
half-tails on the full bodies. Run 2, words "Double ponytail": pigtails on all three, own face, own clothes = PASS.
The blank white front face both runs = the Headless SAM3 pass (toggle on), not the edit; the new pigtails stick out
past its head cut and float round the empty face (a Headless limit with wide hair, not chased here). Run 2 REBUILT the
in-graph mannequin although only the words changed: the Headless job ran between the two runs (separate prompt) and the
engine's default RAM-pressure cache evicts an older prompt's results first; which of the two did it is not proven
(Fabio re-runs with Headless off). Fix: the ask now lists "in buns, ponytails or pigtails". Fabio OK'd next: save the
mannequin (second output + Save to gallery) and skip the mannequin step when the reference already is one.
Run 3 "pink highlights", Headless OFF: pink pigtails on all three, own face = PASS. The SAM3 job STILL ran after it
(log 19:11:24): the Headless leg ALWAYS runs (MPI-1087, flowService keepShown - lands a hidden version), so every
Editor run has a second prompt after it and Headless off cannot separate the two causes. A saved mannequin file is the
cache-independent fix.

## Round 26 (`qh26.py`, `h26_*`): the one-graph-per-route files as shipped (patch_raw_versions.py)

Six runs on :8188 under the lease, every capture saved. STRUCTURE 6/6: q_photo (Qwen, sheet W + pink-buns photo,
Headless on) -> Output_Image mannequin + _2 edit + _3 headless; q_words (only the words changed, ", dyed blue")
-> the mannequin sampler + decode SERVED FROM CACHE (154/155 in execution_cached), 175 s vs 347 s; q_mann (a given
mannequin, Input_Is_Mannequin) -> _2 + _3, no mannequin capture; q_body (no picture) -> _2 + _3; k_words (Klein,
bob in words, lock 2) -> Output_Image + _3; k_off (Headless off) -> Output_Image only, 0.24 s (edit cached).
PICTURES: clean white mannequin with the pink buns + dark roots; buns on all three, her own face (photo + given
mannequin alike); blue partly taken (bangs + streaks, buns stay pink); heavier body; blonde bob on all three; head
removal works on the front of each. Headless with buns: the buns float round the removed face (the Headless pass's
limit with wide hair, as in eye test 2 - not this card). FOUND: the engine log shows Klein LOADED AND SAMPLED in
q_mann and q_body: node 156 MpiClearVram is an OUTPUT_NODE (ComfyUI always runs it) and pulled the whole mannequin
leg into every Qwen run - since r23, so the committed 0a38cfef4 Body shape also paid ~20 s + a 9 GB Klein load.
FIX `patch_raw_clearvram.py`: 156 now takes the gate 165's out_b (the mannequin when built, else a blocker).
Re-check r26b (`qh26.py <out> recheck`, cache flushed first): see below. Grids: session scratchpad h26_{a,b}.jpg.
r26b (`qh26.py <out> recheck`, cache FLUSHED, after patch_raw_clearvram.py): Body shape 123 s and a given mannequin
181 s (was 247) load ONLY Qwen + SAM3 - no Flux2 in the engine log; the photo route loads Klein and lands all three.
Fabio: one MpiClearVram at the very END only -> `patch_raw_one_clear.py` removed Klein 60/120 and Qwen 115/156/184 and
added one fed by a lazy MpiIfElse on Input_Headless (head removal when on, else the edit), so it runs last.
r26c (`qh26.py <out> final`): Qwen photo s3 -> 3 outputs; Klein bob s3 -> 2, clean on all three + headless. Qwen s3:
the FRONT figure kept her old long hair - the same seed failed the same figure in r21 and r23 (the known 17/18),
not this change. Grid: session scratchpad h26c.jpg.

## Eye test 3 (Fabio, app, 2026-10-15, project "Qwen 2.1")

PASS 1 hair from a picture: flowCSE_036 = ONE card, 3 versions (mannequin flowCSE_035, edit, headless), 158 s.
Stopped words re-run ("Pink tips", interrupted 23/30): the cached mannequin landed as its own card flowCSE_037 (the
executor lands what a Stop already saved, MPI-901). Fabio: fine, keep it.
PASS 3 given mannequin: flowCSE_037 as the Reference on sheet flowCSE_013 -> describer refIsMannequin "Yes",
Input_Is_Mannequin true, flowCSE_038 = 2 versions (edit + headless), engine log loads ONLY Qwen (no Flux2), 136 s.
The staff in that result is the sheet's own accessory ("wizard staff" in its name), not the mannequin stand.
Not yet seen by Fabio: 2 (words-only re-run run to the end), 4 Body shape, 5 Klein hair in words, 6 Age + hair.
PASS 5 structure (Klein hair in words): flowCSE_041 = 2 versions (edit + headless), Klein + SAM3 only, 78 s.
FAIL 5 look: "silver Mohawk" on flowCSE_013 (two Viking braids), seed 2585967065 -> braids recoloured silver and
loosened, no shaved sides, no strip on top. Words spelled right. Klein lock 2 changes colour/length but keeps the
old hair's shape when the new style needs hair TAKEN AWAY. Needs a bench (Klein spelled-out vs Qwen words).
Fabio: the silver hair also reads very 3D/CG. Source flowCSE_013 is itself render-like (smooth plastic skin), and
Klein matches the picture's look; silver/white hair is also the hardest colour to keep photo-real (specular). Bench
should add a photo-real sheet to tell the two apart.

## Round 27 (`qh27.py`, `h27_*`, app engine :48188 - the :8188 bench was down): "silver Mohawk", words only

Sheets R (photo-real flowCSFI_006, s42) and C (render-like flowCSE_013, s2585967065); grid: scratchpad h27.jpg.
k_ship (Klein, shipped string): R half (close-up spiky, long tail; front a ponytail), C FAIL (silver braids) = eye test.
k_spell (Klein, shaved sides + one strip spelled out): C clean on all three; R mohawk but DRAWN GUIDE LINES on the
body and neck (an artefact). q_ship (Qwen, shipped string): close-ups perfect, but the FRONT figure keeps the old
hair on both (the known Qwen front-figure miss; R back too). q_spell (Qwen, spelled out): CLEAN on all 6 figures.
Finding: a short style NAME is not enough when the cut removes hair; spelled out it works, best on Qwen.
Fabio (before the bench): do not chase every hairstyle; a picture from online is the user's route for a rare one.
Eye test 3, Fabio spelled it out on Klein (R sheet): "Strip of hair at the top with stubble on the sides. Black roots
with pink tips gradient" -> colour right; close-up half-shaved side but the ponytail kept; front + back keep long hair.
Fabio: "Klein basically sucks at this." Matches r27: Klein cannot take hair away reliably; Qwen spelled out 6/6.

## Round 28 (`qh28.py`, `h28_*`, app engine :48188): hair in words on Qwen, every figure named

q_fig (the string now in buildChangePrompt hair) on R + C, W1 "silver Mohawk" and W2 Fabio's spelled words:
ALL THREE FIGURES changed 4/4 (r27 q_ship with L1 missed the front on both). R W1 a true mohawk; C W1 shaved
sides + silver top; R W2 strip + stubble, black roots to pink tips; C W2 shaved sides, the old braids as pink
cornrows on top. ~105-114 s. Boogu: 8/8 NODE ERRORS, not installed in the app (ae.safetensors missing) - not
benched; MPI-1041 had it change one panel of three. SHIPPED: hair -> Qwen always (Fabio: "try Qwen").
Grid: scratchpad h28.jpg.

Eye test 3, after 05e76d391 (Fabio, app): Hairstyle in words "Bob cut with fringe With black and pink gradient"
on Qwen -> bob + fringe, black-to-pink gradient on all three figures, the hint shows under the dropdown.
Fabio: "Very nice." Checks 2 (words re-run to the end), 4 Body shape, 6 Age + hair still not eye-tested.

## Eye test 4 (Fabio, app, 2026-10-15, session "New character sheets 27")

PASS Body shape on Qwen: "Extremely overweight" and "Extremely muscular, bodybuilder", all three figures (Fabio: passed,
do not ask again).

Accessories + a Reference picture, Klein lock 0, the shipped AW3 string, sheet flowCSE_044 (sidecars flowCSE_047-050):

| words | reference | result |
|---|---|---|
| Mask | woman in goggles + gas mask, green hair (imported) | close-up mask PASS but took her GREEN hair; front figure REDRAWN AS A BACK VIEW; no mask on the bodies |
| Mini gun | product shot of a minigun | front REDRAWN AS A BACK VIEW, gun strapped on its back; close-up none |
| Earrings and necklaces | a woman's neck in silver chains (imported_014) | close-up PASS; front REDRAWN AS A BACK VIEW |
| Piercings and Choker | a woman's face, silver bob, choker (imported_015) | close-up BECAME THE REFERENCE WOMAN (face, hair); front REDRAWN AS A BACK VIEW |

- Front figure -> second back view 4/4 (qh7 bench: 0/8 on flowCSFI_002 + Klein-made refs). The headless version then
  cut the head off that back view.
- Graph is not the cause: the Klein edit path is unchanged since 85f96744a (586fb133e only added the headless nodes and
  moved MpiClearVram after them). Differences from qh7: the sheet, real photos as refs (3 of 4 a person), bare words
  with no article ("Give the character Mask from ...").
- Fabio: maybe split the option into Accessories, Weapons, Jewellery, Makeup, Tattoos.

## Round 29 (`qh29.py`, `h29_*`): Fabio's four, his seeds, sheet flowCSE_044, app engine :48188

k_ship = AW3 as shipped (repro); k_front = AW3 + "The front view on the left still faces forward, showing the
character's face."; q_raw = Qwen-Image 2.1, the reference straight in as image 2 (Input_Is_Mannequin true: NO mannequin
pass), every figure named, "Take only the <thing> from image 2, not the person: keep the character's own face, hair,
skin and clothes." Klein 48 s, Qwen 117-147 s. Contact sheets: scratchpad r29/c_*.jpg.

| case | k_ship | k_front | q_raw |
|---|---|---|---|
| Mask | front -> back, close-up green hair (repro) | front ok, mask front + close-up, hair turned LIME (leak) | **pass**: mask front + close-up, own pink hair |
| Mini gun | front -> back, gun on its back (repro) | **pass**: front holds it | **pass**: front holds it at her side |
| Earrings and necklaces | front -> back (repro) | front ok but one small pendant; close-up pass | **pass**: layered chains + earrings, front + close-up |
| Piercings and Choker | front -> back, close-up = the ref woman (repro) | front ok; close-up = the ref woman (FAIL) | choker front + close-up, own face; piercings faint (brow studs only, no lip ring) |

- Repro 4/4: the AW3 string redraws the front figure on this sheet. k_front fixes the layout 4/4 but the reference
  person leaks 2/4 (hair, face) - Klein copies the picture's person.
- **Qwen wins**: layout 4/4, own face + hair 4/4, the thing placed where it belongs with no "where" words (gun in the
  hand, mask on the face), 3 full pass + piercings partial. No mannequin needed (Fabio's guess).
- Not benched yet: Makeup, Tattoos (Fabio), Accessories in words only (no picture; same "seen from behind" sentence).

## Round 30 (`qh30.py`, `h30_*`): steps, and Accessories in words only. Same sheet, words and seeds as r29

q25 = r29's q_raw at 25 steps (r29 ran 30, same seeds); k_words = the SHIPPED words-only `accessories` string, Klein
lock 0; q_words = Qwen, every figure named, no picture. Contact sheets: scratchpad r30/c_steps_*.jpg, c_words_*.jpg.

| case | q25 vs q_raw 30 | k_words (shipped) | q_words |
|---|---|---|---|
| Mask | same picture, pass | front -> BACK VIEW, no mask anywhere | FAIL: whole sheet a purple matte, figures erased ("mask" read as a matte) |
| Mini gun | same, pass | front -> BACK VIEW, no gun | a pistol in the front + back hands ("mini gun" read as a small gun) |
| Earrings and necklaces | same, pass | front -> BACK VIEW, jewellery on the close-up only | **pass**: front + close-up |
| Piercings and Choker | same, piercings still faint | front -> BACK VIEW, choker on the close-up only | **pass**: choker front + back + close-up, ear piercings |

- **25 steps = 30** for an edit: same composition and items 4/4, 99-126 s vs 117-147 s (~15% faster). Fabio was right.
- **The shipped words-only Accessories path breaks on this sheet 4/4**: front redrawn as a back view, the item on the
  close-up only or nowhere. Not released (the Flow landed 2026-10-10, after v2.0.1): it would have shipped in 2.1. MPI-1041 F1 had it 7/8 on another sheet, so it depends on the
  sheet, but Klein loses the front figure on this one with or without a picture.
- Qwen words-only keeps layout, face and hair 4/4; one wording failure (a bare "Mask"). Arm qw2 ("this accessory to
  wear or hold: <words>", 25 steps) tests the fix.
- **qw2** (Qwen, 25 steps, "Give the character in image 1 this accessory to wear or hold: <words>. The front view, the
  character seen from behind and the close-up portrait on the right all show it wherever it can be seen. Keep the
  character's own face, hair, skin and clothes."): layout, face and hair 4/4, no matte. Mask = a white surgical mask on
  the close-up only, none on the front figure (partial: a bare "Mask" is ambiguous); Mini gun = a pistol in the front +
  back hands; Earrings and necklaces **pass**; Piercings and Choker **pass** (choker front + clasp on the back +
  close-up, ear cuff). Contact sheet: scratchpad r30/c_qw2.jpg. 96-112 s.

## Round 31 (`qh31.py`, `h31_*`): Makeup + Tattoos through the shipped Accessories route (Qwen, 30 steps)

Fabio's 13 pictures (imported_020-033), sheet flowCSE_044, r29 q_raw / r30 qw2 strings. Contact sheets: scratchpad
r31/c31_*.jpg (reference left of each result).

| case | words | result |
|---|---|---|
| t_neck (020) | Neck and chest tattoos | **pass**: front + close-up; took her small heart pendant too |
| t_back (021) | Back tattoos | **pass**: on the back view only, as it should |
| t_body (022) | Full body tattoos | **pass**: all three figures, own face |
| t_all (023) | Tattoos | **pass**: all figures + face tattoos on the close-up; front legs bare where the back legs are inked |
| t_leg1 (030) | Leg tattoo | partial: front on her LEFT leg, back view on her RIGHT (mirrored) |
| t_leg2 (031) | Leg tattoo | partial: back view only, front leg bare |
| m_spider (024) | Makeup | makeup **pass** front + close-up; face hidden by paint |
| m_liner (025) | Makeup | makeup pass; her nose ring leaked; face drifts toward the reference (lips) |
| m_glitter (026) | Makeup | makeup pass; close-up face = the REFERENCE woman's (lips, nose, no smile) |
| m_glam (027) | Makeup | makeup pass; close-up face = the reference's (lips, jaw) |
| m_gems (028) | Makeup | makeup pass; face drifts to the reference; her septum ring + choker leaked |
| m_goth (032) | Makeup | makeup pass; face drifts; nose ring leaked |
| m_lashes (033) | Makeup | makeup pass; close-up face = the reference's (lips, moles, nose stud) |
| w_makeup | dark gothic makeup with smoky eyes and black lipstick (no picture) | **pass**: own face and smile; adds a gothic pendant |
| w_tattoo | a full sleeve tattoo of black roses on the left arm (no picture) | partial: front on her left arm, back view on her RIGHT (mirrored) |

- **Tattoos work through Accessories**: 4 pass + 2 partial with a picture. The miss is SIDE: the back view mirrors the
  limb (2 of 3 one-limb cases), or one view is left bare.
- **Makeup copies 7/7 but the picture's FACE comes with it** (5 of 7 close-ups drift to the reference woman; nose ring /
  septum / choker leak 3 of 7). "Keep the character's own face" loses against a face-borne thing. In words only the
  face holds. Round 32 tests (a) a face-keeping makeup string with the picture, (b) the picture put into words (as
  Hairstyle does) and run with no picture, (c) a same-limb sentence for tattoos.
- 25 steps set in the shipped Qwen editor graph (raw + API, the API = a fresh convert of the raw, 78/78 nodes).

## Round 32 (`qh32.py`, `h32_*`): fixes for r31, on the SHIPPED graph at 25 steps

mA = makeup WITH the picture, a face-keeping string (the makeup named part by part, her own face named part by part,
"Take nothing else from image 2: no piercings, jewellery, moles or hair"); mB = the picture put into words by hand (a
stand-in for a describer, no paid call) and run with no picture through the shipped words string; tS = r31's one-limb
tattoos + "Seen from behind, a tattoo is on the same arm or leg as on the front view...". Sheets: scratchpad
r32/c32_m*.jpg (ref | r31 | mA | mB), c32_t.jpg.

| case | mA (picture, keep-face) | mB (words, no picture) |
|---|---|---|
| spider | own face + smile; orange eyes + black lips, the WEB paint lost (partial) | **pass**: web painted on the close-up |
| liner | **pass**, no nose ring | **pass** |
| glitter | **pass**, own face | **pass** |
| glam | **pass**, own face | **pass** |
| gems | **pass**, no septum or choker | **pass** (looser: fewer rhinestones) |
| goth | **pass** | **pass** |
| lashes | **pass**, no nose stud or moles | **pass** (orange eyeshadow stronger than the picture) |

- **Makeup's face leak is the WORDING**: mA keeps her own face and smile 7/7 and takes no piercings 7/7 (r31's string:
  5/7 faces drifted, 3/7 piercings). mB holds too, but needs a describer call per run and matches the picture less.
  r30 showed 25 = 30 on the same seed, so the steps change is not what fixed it.
- mA ignores the user's words (all "Makeup" here) and is makeup-only: the generic Accessories string cannot carry it.
  So **Makeup needs its own string** - an own option, or the builder spotting makeup words (Fabio's split call).
- **tS is worse, dropped**: "arm or leg" ADDED sleeve tattoos to both arms on both leg cases, and the words case got
  both arms inked on the back view. The mirrored back-view tattoo stays a known partial.

## Round 33 (`qh33.py`, `h33_*`): Makeup with a picture, firming up mA (shipped graph, 25 steps)

mA2 = mA + "copied exactly: the same colours, shapes and patterns of ..."; mAs = mA on the four pictures whose face
leaked worst in r31, two new seeds each (7, 1234567). Sheets: scratchpad r33/c33_a*.jpg (ref | r32 mA | mA2),
c33_s*.jpg (ref | seed 7 | seed 1234567).

- **mA2: makeup 7/7, own face 7/7**; the spider-web paint mA lost is back (web, orange eyes, black lips). One leak: the
  gems picture's black choker on the front figure (mA had it too). No piercings 7/7.
- **mAs: own face 7/8** on new seeds - glitter, glam, gems hold on both; lashes seed 1234567 drifted (the reference's
  over-lined pout, no smile). With r32: own face 14/15 across mA runs.
- **Pick for Makeup with a picture: mA2.** It ignores the user's words, so it needs its own option (or makeup words
  spotted) - Fabio's split call.

## Round 34 (`qh34.py`, `h34_*`): Makeup and Tattoos as their own options (shipped graph, 25 steps)

Fabio split both out of Accessories (2026-10-15). tP = tattoos from the picture with NO words, "copied exactly: the same
designs, colours and size, in the same place on the body" + "Add no tattoos that are not in image 2", no limb named;
tW = tattoos in words; mW = makeup in words, her own face named part by part; mP = qh33.mA2 + "Change only this about
the makeup: <words>". r31's pictures and seeds. Sheets: scratchpad r34/c34_*.jpg.

| case | result |
|---|---|
| tP t_neck | **fail**: neck + chest copied, but INVENTED sleeves on both arms and both legs (r31 with words: pass) |
| tP t_back | **fail**: back copied, invented arm sleeves front + back (r31: pass, back only) |
| tP t_body | pass (= r31) |
| tP t_all | pass, legs now inked front and back (r31 left the front legs bare) |
| tP t_leg1 | **fail**: the leg tattoo moved to BOTH ARMS, legs bare |
| tP t_leg2 | **fail**: arm sleeves added, legs inked on the back view only |
| tW roses (left arm sleeve) | partial: front on her left arm, back view on her right (mirrored, as r31) |
| tW koi (whole back) | **pass**: back view only |
| mW goth (smoky eyes, black lipstick) | **pass**: own face + smile, front + close-up |
| mW pink (glitter shadow, white liner, pink lips) | **pass** |
| mP goth + "red lipstick" | **pass**: the picture's smoky eyes, red lips, own face |
| mP glam + "blue eyeshadow" | **pass**: the picture's liner, contour and lips, blue shadow, own face |

- **Makeup: every route holds** - words 2/2, picture + words 2/2, picture alone 7/7 (r33). Ship mW / mA2 / mP.
- **Tattoos from a picture ALONE fail (2/6)**: a cropped photo does not say where on the body it is, so the model inks
  everything; "Add no tattoos that are not in image 2" does not stop it. r31's words ("Neck and chest tattoos") are
  what placed them. So a tattoo picture needs words saying where, as Accessories does. r35 tests r31's string + "Add
  no other tattoos." on the same six.
- tPw (tP + "Change only this about the tattoos: in red ink / in blue ink") ran too, but on the failed tP base: not read.

## Round 35 (`qh35.py`, `h35_*`): Tattoos with a picture AND words saying where (shipped graph, 25 steps)

tQ = r29 q_raw(words) + "Add no other tattoos." after the figures sentence; r31's pictures, words and seeds. Sheets:
scratchpad r35/c35_t*.jpg (ref | r31 q_raw | r35 tQ).

| case | words | result |
|---|---|---|
| t_neck | Neck and chest tattoos | **pass**: front + close-up, no invented ink |
| t_back | Back tattoos | **pass**: back view only |
| t_body | Full body tattoos | **pass**, all figures |
| t_all | Tattoos | **pass**, front legs inked too now (r31 left them bare) |
| t_leg1 | Leg tattoo | partial: front her left leg, back view her right (mirrored, = r31) |
| t_leg2 | Leg tattoo | partial: back view only, front leg bare (= r31) |

- **tQ ships for Tattoos with a picture**: 4 pass + 2 partial, no tattoo invented anywhere (r34's picture-only: 4 of 6
  invented). Words required with the picture (`REF_NEEDS_WORDS`). The one-limb side miss is the known partial.
- Builder strings byte-identical to the bench, 13/13 (mA2, mP x2, mW x2, tW x2, tQ x6): scratchpad `cmp34.py`.
- npm test 3324 pass / 0 fail; eslint clean; `tests/desktop/flow-optional-model-row.spec.js` passes on the new label.

## Round 36 (`qh36.py`, `h36_*`): a side-keeping line for one-sided tattoos (Fabio: her LEFT leg in front, her RIGHT from behind)

A = "Each tattoo stays on the same side of the character's body in every view: seen from behind, the character's left
side is on the left of the picture, so a tattoo on the right of the front view is on the left of the character seen
from behind."; B = "The character seen from behind is not a mirror image of the front view: anything on one side of the
character's body stays on that side, so seen from behind it is on the other side of the picture." No limb named.
Sheets: scratchpad r36/c36_*.jpg. Sides eye-read (front figure: her left = picture right; back: her left = picture left).

| case | r35/r34 shipped | A | B |
|---|---|---|---|
| t_leg1 picture | mirrored | **back side right**, but an arm sleeve INVENTED (front + back) | front leg bare, back her right (wrong) |
| t_leg2 picture | back only | front her right, back her left (wrong) + arm sleeve INVENTED | front bare, back only |
| t_neck picture | pass | pass | pass |
| t_back picture | pass | arm sleeve INVENTED on the front | pass |
| roses, her LEFT arm (words) | mirrored | **both views her left arm: correct** | front right; back on BOTH arms |
| snake, her RIGHT leg (words) | - | front right, back her left (wrong) | front bare, back her left (wrong) |
| watch, LEFT wrist (Accessories words) | **correct both views** (shipped) | - | correct both views |

- **Neither ships.** A gets the back side right 2 of 4 but invents arm sleeves 3 of 4 tattoo-picture runs (any talk of
  sides invites ink, as r32's limbs did); B drops the front tattoo 3 times. Builder unchanged (tQ / tW).
- Accessories does not need it: the shipped string put a left-wrist watch on her left wrist in both views.
- NEXT (Fabio 2026-10-15): two-pass, so no single pass sees two views of a side - edit the front figure + close-up only,
  then hand the EDITED front body to Qwen as "this character seen from behind" and paste the result into the back
  panel. A graph patch (crop front body -> Qwen back pass -> composite), ~+100 s per run.

## Round 37 (`qh37.py`, `h37_*`): Fabio's two-pass for the tattoo side flip (shipped graph, 25 steps)

Pass 1 = the shipped edit (tQ picture / tW words) on the whole sheet (r35/r34 outputs reused: same graph, same seeds;
w_snake run fresh). Pass 2 = the EDITED front figure alone (left 25% of the 8:5 sheet, upscaled to 640 x 1600) through
the same Qwen graph, "Turn the character in image 1 around so the character is seen from behind ...", pasted over the
back panel. B1 = no tattoo words; B2 = + the tattoo picture as image 2 (picture cases) or the tattoo words (words
cases). Pass 2 = ~40-70 s. Sheets: scratchpad r37/c37_0.jpg, c37_1.jpg (p1 front | p1 back | B1 | B2). Sides: back
figure faces away, her left = picture left.

| case | pass 1 front | pass 1 back (shipped) | B1 | B2 |
|---|---|---|---|---|
| t_leg1 picture | her left leg | her right (mirrored) | **her left: correct** | her left, but an arm sleeve INVENTED |
| t_leg2 picture | bare (missed) | her right | bare: tattoo lost | arm sleeves INVENTED, leg bare |
| t_neck picture | neck + chest | none (right) | none (right) | INVENTED upper-back ink |
| t_back picture | none (right) | back piece | back tattoo LOST (not on the front) | **back piece: pass** |
| roses, her LEFT arm (words) | her left | her right (mirrored) | **her left: correct** | **her left: correct** |
| snake, her RIGHT leg (words) | bare (missed) | her right | bare: tattoo lost | **her right: correct** (front still bare) |

- **The two-pass fixes the flip** wherever the front has the tattoo: t_leg1 and roses land on the right side from
  behind (B1), and words-B2 is right 2/2, even when pass 1 missed the front (snake).
- **But it costs**: (1) pass 2 REDRAWS THE OUTFIT'S BACK in 12/12 - the sheet's open strappy back became a halter back
  (the front's halter, turned round); (2) B1 loses anything not visible from the front (t_back, and the snake/t_leg2
  that pass 1 missed on the front); (3) a tattoo picture in pass 2 (B2) invents ink 3 of 4 again, as r34/r36 did.
- Best split if it ships: words -> B2 (words in pass 2), picture -> B1 (no picture in pass 2) - sides right on 3 of
  the 4 flip cases (t_leg2 lost: pass 1 never drew it on the front); picture B1 still drops a back-only tattoo (t_back: ship would need the picture's own
  "where" words, e.g. "Back tattoos", to pick the one-pass path). Not built: Fabio's call (outfit-back redraw).

## Round 38 (`qh38.py`, `h38_*`): the SHIPPED back pass (Fabio 2026-10-15: "ship the two-pass for Tattoos, words go into pass 2, a picture does not")

BUILT: `research/bench/patch_raw_back_pass.py` patched the Qwen raw graph (14 nodes: `Input_Back_Pass`,
`Input_Positive_2`, crop the edit's left 25% -> ~1 MP -> Qwen edit, same model + seed -> back to the panel -> pasted at
x = width // 4 -> a lazy MpiIfElse every reader of the edit now reads) + one-file convert (92 nodes, injection rules OK).
Builder `buildBackPassPrompt` (Tattoos only; words into the pass, a picture not) -> `Input_Back_Pass` +
`Input_Positive_2` on the change leg. Sheet: scratchpad r38/c38.jpg.

- **Shipped graph = r37 bench pixel for pixel**, 6/6 cases (front, back and close-up max diff 0: ComfyUI's lanczos IS
  PIL's). **Off = r35 pixel for pixel** (t_neck): the pass never runs when off.
- Time: on 123-168 s vs off 108 s (~+35-50 s per tattoo run).
- Picture cases WITH their where-words in pass 2 (`h38_w_*`, not shipped): t_leg1 same; t_neck INVENTED upper-back
  ink; t_back and t_leg2 got small made-up tattoos, not the picture's design. So a picture case keeps no words in the
  pass, as Fabio chose.
- npm test 3327 / 0 fail; eslint clean; `tests/character-sheet-editor.test.cjs` pins the strings + the graph wiring.

## Eye test 1 (Fabio, 2026-10-16, in progress)

- **Makeup from a picture, MALE sheet: FAIL** - flowCSFI_011 -> flowCSE_051, reference a white-haired woman with
  spider-web face paint: the paint, orange eyeshadow and black lips landed, but the face took the reference's traits
  (feminised, lashes). Every makeup bench (r31-r35) used the woman's sheet flowCSE_044: cross-gender never benched.
- **Tattoos from a picture, MALE sheet: back-pass GHOST** - flowCSFI_011 + a woman's neck/chest tattoo picture ->
  flowCSE_052: the tattoo landed (front, back of neck, close-up), but a sliver of the ORIGINAL back figure's arm shows
  between the back panel and the close-up. Cause (measured, column occupancy): the back pass assumes the editor's own
  25 | 25 | 50 layout (crop the left 25%, paste at x = width // 4, 25% wide); Character Sheet from Images (Qwen 2.1)
  places figures where it likes - flowCSFI_011 = front 7-24%, back 33-51%, close-up 60%+, so the old back arm past 50%
  survives the paste. Of CSFI 007-011 the quarter lines cut a figure on 007, 009, 010 (the FRONT arm crosses 25%) and
  011; the woman's flowCSE_044 fits the quarters, which is why r37/r38 never saw it. Fabio's stitch idea (rebuild
  front | new back | close-up from pieces) cuts at the same fixed lines, so alone it keeps the sliver: the cuts must
  land in the sheet's own empty gaps.
- **Spider-web picture through TATTOOS, MALE sheet: same FAIL** - flowCSFI_011 -> flowCSE_053: paint + orange
  shadow + black lips landed, face feminised again (lashes, softer jaw, stubble gone). So the leak is the reference
  FACE, not the Makeup string: both options redraw the face at denoise 1.0. Fabio: makeup reshapes a face by colour,
  a mannequin will not help. NEXT r39: denoise 0.75 / 0.85 from the sheet's own latent vs a gender-neutral own-face
  line ("keeps their own face shape, eyes, eyelashes, eyebrows, lips and facial hair; only the paint from image 2").

## Round 39 (`qh39.py`, `h39_*`): face leak on the MALE sheet (flowCSFI_011), app params (Headless on, no back pass)

Refs m_spider (imported_024, flowCSE_051's seed) + m_glam (r31's worst leak). Sheet: scratchpad c39_face.jpg.

- **base (shipped mA2) reproduces the leak 2/2**: spider = slimmer face, stubble mostly gone, black lips; glam = full
  drag glam: heavy contour, lashes, fuller lips (beard kept).
- **F (firm own-face line, lashes out of the paint list) = no better 2/2**: same faces as base. Words do not win this.
- **d85 / d75 / Fd80 = NOISE 6/6** (birds and branches): the KSampler's `latent_image` is TextEncodeQwenImage21's
  latent output, which is NOT an encoding of the sheet, so a partial denoise starts from garbage. Re-run as r39b with a
  real VAEEncode of the sheet.
- **r39b (`qh39b.py`, VAEEncode of the sheet -> main KSampler)**, sheet scratchpad c39b_face.jpg: partial denoise
  KEEPS HIS FACE 6/6 (jaw, nose, stubble, lip shape) - the leak is gone. Cost: the paint weakens with denoise.
  e85: glam right (wing liner, contour, nude lip, still him); spider = orange shadow + black lips + only a little web
  on the forehead/eye. e75: glam faint, spider almost gone. Fe80 ~ between. Next: e90 / e95 for the full spider web.
- **e90 / e95** (scratchpad c39c_face.jpg, c39c_sheet.jpg): spider web FULL at both (white base, black lips, orange
  shadow), but the face starts to drift back toward the reference (stubble hidden under the white base, slimmer at
  0.95); glam at 0.90/0.95 = fuller lips + lashes again, close to base. Layout and the front figure held at every
  value. **Denoise is a dial between paint strength and his own face; no one value wins both pictures.** Subtle
  makeup is right at 0.85; a bold full-face paint needs 0.90+. Fabio's call (look and feel): fixed 0.85, fixed 0.90,
  or a strength choice in the option. Shipping it = a VAEEncode of the sheet into the main KSampler + an
  `Input_Denoise` the builder sets (1.0 for every other change). Tattoos at < 1.0 not benched yet.

## Round 40 (`qh40.py`, `h40_*`): prompt approaches on the MALE sheet (Fabio: "have you tried different prompts?")

Each at 1.0 and at 0.90 (encoded sheet). Sheet: scratchpad c40_face.jpg.

- **W = words only, NO picture** (qh34.mW + qh32.DESC, the hand-written describer answer): **HIS FACE KEPT 4/4**, even
  at full redraw - jaw, stubble, brows, lips. Spider = bold full-face web, orange shadow, black lips, but a CLASSIC
  web, not the reference's dripping-strand design; glam = wing liner, contour, nude lips, still a man. The picture's
  face is the whole leak: with no face in the input there is none to copy.
- **M = mA2 naming him "the man"**: leaks 4/4 like base (glam M100 = full drag face). Naming the gender does nothing.
- So two working routes: (a) picture -> describer -> words, the Hair route (`refHair`): face safe at any strength,
  design approximated; (b) picture at partial redraw (r39b): exact design, face vs strength trade-off. The real
  describer's makeup answer not benched yet (DESC was hand-written).
- **Cosmo's result (Fabio, edit_007): EXACT spider design + HIS face** (stubble, jaw). Chain from the cards + app.log
  02:38-02:41: Fabio's Qwen 2.1 edit of imported_024 "Replace the head of the woman with a mannequin and Keep only the
  makeup" -> edit_005 (bald mannequin, makeup kept; edit_006 = "male mannequin" variant); Cosmo described edit_005 and
  the man's photo imported_009, then Klein 9B Edit (4 steps, 30 s): image 1 = the man, image 2 = the mannequin, prompt =
  the makeup in detailed words + "Keep his hair, beard, face shape, earring and pose exactly as they are; only the
  makeup changes." A single portrait, not a sheet. Bench r41 = that recipe on the editor's Qwen graph.

## Round 41 (`qh41.py`, `h41_*`): Cosmo's recipe on the editor's Qwen graph, MALE sheet, denoise 1.0

In-graph Klein mannequin with a MAKEUP prompt (`qh41.MANN`, node 147 overridden; Input_Is_Mannequin false). Sheets:
scratchpad c41_peek.jpg, c41_face.jpg.

- **The makeup mannequin is faithful 2/2**: bald head, spider web / glam wing + bronze lips copied exactly.
- **KW = mannequin + makeup in words (`qh41.mK` + DESC): HIS FACE + the design 2/2** (spider: exact dripping-strand
  web, stubble and jaw kept = Cosmo's edit_007; glam: wing liner, contour, still him). **The winner.**
- K = mannequin + shipped mA2: glam right and his face; spider design right but the face slims, stubble fades.
- FQ / FQW = Fabio's Qwen mannequin edit_005 (ready mannequin): FQ slims like K; FQW close to KW.
- So the mannequin removes most of the leak (glam 2/2), and the words hold the face on bold full-face paint. Fabio
  2026-10-16: "These work. Same approach as for the haircuts, creating mannequins for the makeups." -> BUILD.

## Round 42 (`qh42.py`, `h42_*`): r41's KW with the REAL describer (image_descriptor, Qwen3-VL 4B, `ASKM` on the raw picture)

Answers (`h42_describe.json`): spider "Black spiderweb face paint with orange eyeshadow, black eyeliner, false lashes,
and black lipstick"; glam/goth/glitter all name "voluminous false lashes" and add "no face paint" / "no contour".
Sheet: scratchpad c42_face.jpg.

- **Own face 6/6.** MALE: spider (exact dripping web, stubble), glam (wing + contour), goth (smoky + purple lips),
  glitter (silver lids + black lips) - all still him. WOMAN (flowCSE_044, regression): glam passes with her smile;
  spider keeps her face but CLOSES her smile under the black lips (expression changed, partial).
- Mannequins faithful 6/6 (goth's came out frontal; glitter's lips a dark red where the describer said black, the edit
  followed the words: black).
- The describer's "no face paint" / "no contour" did no harm. "False lashes" did not feminise him (light lashes).
- **r42b (`qh42b.py`): the user's words on top**, man's sheet, spider + glam. Words LEAD ("..., changed like this:
  <w>. The makeup in image 2: <d>. Make it <w> on every figure."): "red lipstick" red 2/2, "no lashes" lashes gone /
  fewer 2/2. Words AFTER the description: red 1/2 (spider stayed black), lashes kept. His face 8/8. Ship LEAD (= hair).
- BUILT: `patch_raw_mannequin_prompt.py` (node 147's text <- MpiText `Input_Mannequin_Prompt`, default = the hair
  prompt; one-file convert, 93 nodes, only 147 + 211 changed; injection rules OK); builder `MAKEUP_MANNEQUIN`, makeup
  out of `RAW_REF`, `buildChangePrompt(..., refMakeup)` = qh41.mK / qh42b.lead byte for byte 12/12; registry describe
  `refMakeup` (ASKM) + `refIsMannequin` for makeup too; tests + playbook. character-sheet-editor tests 21/21, npm test
  3332 / 0 fail, eslint clean.
- **r43 (`qh43.py`): the SHIPPED graph** with the builder's injection (Input_Mannequin_Prompt, Input_Is_Mannequin
  false, the r42 words) = r42's h42_M_m_spider PIXEL FOR PIXEL: mannequin, edit and headless max diff 0.

## Round 44 (`gaps.py`, `qh44.py`, `h44_*`): the back pass STITCHED at the sheet's own gaps (Fabio's stitch)

- **Cut finder** (`gaps.py`, then `flowEnhance.sheetCuts` + `shrinkGray`): a column is empty when it barely changes
  along it AND stays near one colour (activity alone cut through a plain red dress, CSE_001/011). On Fabio's 121
  sheets in "Qwen 2.1": every real sheet cut in a gap (contact sheets scratchpad gaps1/gaps3.jpg); 7 give no cuts
  (CSE_014-017 broken sheets with an extra figure, 035/037/039 mannequin pictures) -> the default cuts. The JS port
  = Python 121/121 within 2% once the app AVERAGES pixel blocks (`shrinkGray`); a plain resize's aliasing lost
  flowCSFI_010's narrow front-arm gap.
- **Graph** (`patch_raw_back_stitch.py`, 100 nodes): `Input_Cut_1/2` (px, 0 = 25% / 50%); front = edit [0, cut1),
  rest = edit [cut2, W), result = ImageStitch(front | new back | rest); the stamp is gone. Sheets whose back panel
  is wider or narrower than the front come back a little narrower or wider, never squashed (Fabio's "appropriate
  dimensions"). App: describe entry `{ to: 'sheetCuts', measure: 'sheetCuts' }` (Tattoos only, no describer) ->
  builder `Input_Cut_1/2`.
- **ghost52** = Fabio's flowCSE_052 exactly (cuts 510 / 1002): **the ghost arm is GONE**, neck tattoo kept, 1810 px
  wide. **w10** (flowCSFI_010, cuts 448 / 1018): the front arm stays whole, no ghost, 1670 wide (the snake went on
  the arms, not "his right leg": the known words-tattoo placement partial, r34, not the stitch). **def44** (cuts 0)
  = r38's h38_on_t_neck PIXEL FOR PIXEL. **m44** (measured 448 / 882 on the woman's sheet): same picture, 1806 wide.
  Seams: the backdrops differ by ~5 grey levels at the close-up edge (as the stamp's did).
- Scratch convert = shipped; injection rules OK; npm test 3334 / 0 fail; eslint clean.
- Noticed (same layout assumption as the back-pass ghost): the child-safety CLOTHES checks read the sheet at fixed
  quarters too (`region.x` 0 / 0.25, width 0.25): on a "from Images" sheet the back figure spans 33-51%.
- Layout fix agreed in principle (Fabio's stitch): rebuild the sheet from pieces (front | new back | close-up), the
  pieces cut in the sheet's own gaps, measured app-side before dispatch.

## Round 45 (`qh45.py`, `h45_*`, scratchpad r45/): LOCALISED face edits (Fabio 2026-10-16), app engine :48188
SAM3 "face" PER PANEL (front = left 30%, close-up = right half; on the whole sheet SAM3 returns ONE face only) ->
square box = face + half a face all round -> both crops side by side on one 1448 x 724 canvas -> one edit -> each half
pasted back through its own face mask (grown side/25, feathered). Inputs = r42's makeup mannequins + describer words.
Times (each run reloads models: MpiClearVram ends every graph): Qwen crop ~54 s (words-only 40 s) vs the same edit on
the whole sheet 124 s = **2.3x faster**; Klein crop ~27 s (18 s words) vs whole sheet 48 s.
- **Makeup, Qwen 4/4**: spider, glam, goth on the MAN keep his face (stubble, jaw); the same makeup on both faces; the
  woman's spider KEEPS her smile (r42 whole-sheet closed it). **Klein 1/4**: spider ok, goth partial (lashes), glam
  FAIL (front face barely made up, close-up feminised, stubble gone), W spider ok but front/close-up differ.
- **Face tattoos in words** (teardrop under the left eye + tribal on the right temple): Qwen consistent on both faces
  but small and on the MIRRORED side; Klein bold but inconsistent (two teardrops front, tribal only on the close-up).
- **Face tattoos from a picture** (imported_023): FAIL both - the Klein tattoo mannequin of a full-body photo keeps the
  face ink too small to read, the describer said "markings on forehead and cheek", both models invented generic glyphs
  (Klein also added NECK ink). No face leak on either (the crop + mannequin hold the face).
- Stitch: seams invisible for makeup; ink outside the face mask (K tp neck) comes through the feather as a GHOST -
  tattoos would need a wider paste mask (the square, feathered) or SAM3 "face, neck".
- Verdict: localised Makeup on Qwen = same quality or better, 2.3x faster, nothing outside the faces can change
  (no back view involved at all). Face tattoos: words route promising on Qwen, picture route needs a head-crop
  mannequin (crop the reference to its head before the mannequin) - not benched.

## Round 46 (`qh46.py`, `h46_*`, scratchpad r46/ of session 7a96d4b1): the SKIN line, G: bench :8188
Fabio 2026-10-16: his shipped spider run (flowCSE_055, whole sheet) took the MANNEQUIN's cream skin, full lips and black
nose tip. B = one sentence after the describer's words: "Image 2 is a mannequin: take only the painted makeup from it,
not its pale skin, its face or the shape of its lips. Where there is no paint, the skin stays {each face's / the
character's} own colour." Inputs = HIS mannequin (flowCSE_054) + his describer words, seeds 31024/46001/46002.
Skin warmth = mean saturation of the unpainted skin inside the SAM3 face masks (before 0.38 front / 0.39 close-up):
- shipped A whole (055): front **0.27** (the pale mask), close-up 0.33.
- crop A: front 0.34 / close 0.36-0.38; crop B: the same within 0.01. **The crop cures most of the leak on its own;
  the line adds nothing measurable.** Eye: crop A and B indistinguishable, his stubble + jaw kept 6/6.
- whole B: front 0.29-0.32, visibly pale front face 2/3 (s46001, s46002), close-ups fine. The line does not fix
  the whole-sheet route either.
- Regression, crop B glam + goth (r42 mannequins): own face, stubble, own skin 2/2.
- Left in every spider crop: the web's pale FILL on the forehead (the reference's own pale skin inside the web).
- Verdict: skip the skin line; the fix for the leak is the localised crop route itself.

## Round 47 (`qh47.py` + `qh47_params.mjs`, `h47_*`, scratchpad r47/ of session 7a96d4b1): the SHIPPED face-crop graph, :8188
BUILT (Fabio 2026-10-16, "no skin line"): `patch_raw_face_crop.py` -> raw + api Qwen graph (153 nodes): `Input_Face_Crop`
(ships false) -> SAM3 face per panel of the sheet ([0, cut 1), [cut 2, W), Input_Cut rule) -> `MpiMaskSquareBbox`
(padding = half the longer face side) -> 724 squares stitched = picture 1 of BOTH Qwen encodes -> the edit cut in
halves, scaled back, pasted onto the untouched sheet through each face mask (grown 29 + ImageBlur 31/10 in the 724
half). Lazy MpiIfElse both ends; everything that read the sheet-sized edit reads the switch. App: `Input_Face_Crop`
= change leg + Makeup; both Makeup strings say "Image 1 shows the same person's face twice ... both faces".
Run as the app injects it (the raw photo + in-graph mannequin, the app's own strings, Headless on):
- Fabio's spider, 3 seeds: mean pixel diff to r46's Python crop 1.47-1.72 (= the bench); the in-graph mannequin =
  his flowCSE_054 (diff 1.5). Own tan skin, stubble, jaw 3/3. Seams invisible at full size.
- + words "red lipstick": red lips 1/1. Words only ("dark gothic ... black lipstick"): 1/1, own face.
- glam, goth (r42 photos): own face 2/2. Woman's sheet (flowCSE_044) spider: both faces, smile kept, 1/1.
- Only the faces change: 2.1-3.8% of the sheet's pixels. Times 45-48 s warm (headless included), 81 s with loads.
- npm test 3340: 3338 pass, 0 fail; eslint clean.

2026-10-16 (New character sheets 34): Fabio eye test, child sheet + makeup picture, STILL refused (app.log 08:11:11 picture answer=YES). Cause reproduced: fixed text passes, the refMakeup describer word "nude" (lipstick) trips UNCLOTHED -> look -> child refused. Fix (my pick, gate unchanged): buildChangePrompt renames nude/nudes in refMakeup to skin-toned; user words still refused. Test added; character-sheet-editor + child-safety 49/49. Needs Fabio re-test in app.
Re-test 08:20 still refused: the rename only reached the prompt; flowService stores the RAW describer answer as injectionParams.refMakeup, and configTexts reads every string param. Fix: the builder re-emits refMakeup renamed (built params merge after the describe answers, flowService.js:682 vs 711). Test now mirrors that merge (fails on the old code). 316/316 (sheet + gate + flow suites). Unproven that "nude" is the word: the log does not print the describer answer.
Both stopgap edits (the "nude" -> "skin-toned" rename in the prompt and in the refMakeup param) REVERTED on Fabio's call, 2026-10-16: no more patching the gate per Flow. Makeup eye tests BLOCKED on the child-safety redesign card (the gate reads only typed words; picture verdicts cached per file).

## Beard bench bd1 (2026-10-16, session "New character sheets 39"): Qwen words, seed 42, G: bench :8188

Fabio: Beard is its own option. `b_fig` = the Hairstyle shape (every figure named); `b_face` = front view + close-up
only. Scripts + outputs in that session scratchpad (`bd1.py`).

| case | b_fig | b_face |
|---|---|---|
| fisher, clean-shaven | PASS all views | FAIL: close-up shaved, front beard kept |
| fisher, short grey goatee | PASS | FAIL: front full beard kept |
| man (flowCSFI_011), long red braided beard | close-up PASS, FRONT bare (stubble lost too) | same |
| man, black handlebar moustache | PASS | PASS |

b_fig wins 3/4; a big beard ADDED misses the small front face. bd2 tries firmer front-view wording.

## Beard bench bd2 + bd3 (same session): firmer front-view wording, seeds 42 + 7

- `b_each` ("The full-body front view and the close-up portrait on the right both show this beard on the face, and the
  character seen from behind shows it wherever it can be seen."): long red beard on the man FRONT 2/2, grey goatee 2/2,
  shave the fisher 1/1, handlebar moustache 1/1 = 6/6; layout and back views kept.
- `b_fig` seed 7: long beard front bare again (0/3 overall). `b_lead` (front + close-up named first): 0/2 man, 1/2 fisher.

SHIPPED (uncommitted at write): option `beard` -> flowCharacterSheetEditQwen, words only; builder = b_each byte for byte
(test); Qwen row label + description name it; row spec updated and passing; npm test 3375/0. UNRELEASED.md line waits
for its claim (Cosmo + MCP card-import session). NEXT: Fabio eye test of Beard in the app.

## Beard bench bd4 (2026-10-17): Beard with the box EMPTY (Fabio: "it's a beard, what do I write?")

Default words "a full, neatly trimmed beard and moustache in the same colour as the hair" in the shipped b_each string:
the man (flowCSFI_011) seeds 42 + 7 = dark trimmed beard on the front face AND the close-up, 2/2; the photo woman
(flowCSFI_006) = a brown beard matching her hair, front + close-up, 1/1. SHIPPED: empty box = that default (no refusal),
Beard option `note` says so with examples; UNRELEASED.md line names the beard.

## Beard from a PICTURE, bench bp1 (2026-10-17, session "New character sheets 40", G: bench :8188)

Fabio: a beard picture alone must be enough (words-only Beard is fine). Pictures = his imported_034 (long grey), 035
(dark full), 036 (handlebar + trimmed) in Qwen 2.1. Describer (local image_descriptor, free) named all three right.
Arms, seed 42, no words: A = in-graph beard MANNEQUIN (bald head, only the beard) + describer words; B = RAW picture
(Is_Mannequin) + words; C = mannequin, no words. Scripts bp1.py / gridbp.py in session c98bcfa0's scratchpad.

| case | A mann+words | B raw+words | C mann |
|---|---|---|---|
| man b1 long grey | PASS all views, own face | FAIL front face = the picture's old lined face, grey hair | PASS |
| man b2 dark full | PASS | PASS | PASS |
| man b3 handlebar | FAIL front face pale/mannequin-ish, hair thinned | FAIL picture's face | FAIL front head = the bald mannequin |
| fisher b1/b2/b3 (a swap) | PASS 3/3 close-up, cartoon face kept | b3 PASS | - |

Raw picture is out (face leak, as Makeup r31). Mannequin wins, but the small front face can take the mannequin head
(b3). bp3: "Take only the beard and moustache from image 2, not the head" (P) vs a WHITE mannequin (W) vs both.

## Beard bench bp3 (same session): the mannequin head on the small front face

Man (flowCSFI_011), no words, describer words in. Front-face crops (bp3.py, heads_bd.py):

| case | A (bald, bp1) | P (take only the beard) | W (WHITE mannequin) | PW |
|---|---|---|---|---|
| b3 seed 42 | FAIL | FAIL (same pale face) | PASS own face + hair | PASS |
| b3 seed 7 | FAIL | borderline (lighter brows) | PASS | PASS |
| b1 seed 42 | PASS (bp1) | - | PASS | PASS |
| b2 seed 42 | PASS (bp1) | - | PASS | - |

W 4/4: the mannequin's skin-coloured bald head was what Qwen put on the front figure; a white one cannot pass for
skin. SHIPPED: `BEARD_MANNEQUIN` = bp3 MANN_W byte for byte (test pins it); the edit string = bp1 arm A.

## Beard bench bp2 (same session): picture + the user's words, WHITE mannequin

Shipped words string (`changed like this: <w>. The beard in image 2: <d>. Make it <w>.` + BEARD_ON), man, seed 42:
b1 + "in dark brown" = the long beard brown PASS; b2 + "trimmed short and neat" = short neat edges PASS; b3 + "with a
grey streak" = grey mixed through, not a streak (partial). Own face + hair 3/3. Fisher + b3, no words, white
mannequin = his white beard swapped for the handlebar, cartoon face kept PASS. npm test 3383 / 0 fail, eslint clean.
NOT eye-tested in the app yet (Fabio).

## Accessories benches ac1 / ac2 (session "New character sheets 41", 2026-10-17): the back pass for Accessories

Fabio's eye test: "Holding a G3 machine gun with both his hands" on flowCSFI_011 (flowCSE_068, seed 4210442743)
added a thigh pouch + belt + sling on the front, and the back view's gun stuck out at his side. Scripts ac1.py,
ac2.py, ac3.py, gridac.py in session 06a78559's scratchpad; G: bench :8188.

- ac1 (shipped one-pass string, seeds 42 / 2512058707): no pouch either seed (the pouch is seed-dependent); from
  behind the gun pokes out both sides / one side. Fabio: a fail; do it the Tattoos way (front first, then turn round).
- ac2, pass 1 = shipped, Input_Back_Pass on, cuts measured (gaps.py: man 510,1002; woman cs44 448,882):

| case | B1 (pass 2 sees the edited front only) | B2 (+ image 2 = the sheet's ORIGINAL back figure) |
|---|---|---|
| g3 Fabio's seed | pouch reproduced (pass 1); back consistent, gun mirrored right | same |
| g3 seed 42 | pass | pass |
| jewel (cs44) | back redrawn as a HALTER (straps + ankle straps lost) | straps + heels kept; PENDANT drawn on her back |
| cap | pass | pass |
| katana right hand | keyhole back; sword on her right from behind | straps kept; sword right |

- B2NH = B2 + pass 1 "Add nothing else: no other gear, bags, belts or straps." + pass 2 "Show only the parts of it
  that can really be seen from behind: anything on the front of the body, such as a pendant, is hidden by the body,
  and only a chain or strap shows at the back. Hair hides what is under it." (Fabio caught the pendant): 5/5 -
  Fabio's seed = the G3 only, no pouch/belt/sling; jewel = chain at the nape + earrings, no pendant, straps kept;
  cap, katana, G3 seed 42 pass.
- BUILT: `patch_raw_back_ref.py` (graph: Input_Image cropped at cut 1..cut 2, ~1 MP -> back pass encoder
  `images.image_2`; API = the bench graph node for node), `accessories` + "Add nothing else", `buildBackPassPrompt`
  for accessories + tattoos with image 2 (Tattoos: "the skin and its tattoos as in image 1", unbenched -> ac3),
  `sheetCuts` measured for accessories too. Tests updated, 38/38 in the two files.

## Tattoo pictures: back-only and the bare face (session "New character sheets 42", 2026-10-17, ac4-ac8)

Sheet flowCSE_044, cuts 448,882, shipped Qwen graph, app strings via qh47_params.mjs. Scripts ac4.py, ac5.py,
ac8_desc.py in session a1962251's scratchpad; G: bench :8188.

- **Back-only (t_back, 021, "Back tattoos", seed 31021)**: ac3's back pass LOST the back piece (pass 2 turns round a
  front that cannot show it). One pass (back pass off): the piece on the back view only, straps kept - **pass**.
  SHIPPED: tattoo words naming the back and no front-view part (`BACK_ONLY` / `FRONT_PART`) take no back pass.
  Shipped params = bench `ac4_back_1p` exactly.
- **Bare face, full-body picture with no face (t_body, 022, "Full body tattoos")**:

| line after "Add no other tattoos." | t_body 31022 | t_body 7 | t_all 023 (picture HAS face ink) | t_neck 020 |
|---|---|---|---|---|
| none (shipped) | cheek + jaw piece INVENTED | bare | face ink (as the picture) | - |
| F "No tattoos on the face unless image 2 shows tattoos on a face." | cheek piece | - | face ink | - |
| F2 "The face stays bare skin, with no tattoo on the cheeks, jaw or forehead, unless image 2 shows a tattooed face." | cheek piece | - | - | - |
| F3 "Image 2 shows no face, so the face stays bare: no tattoo on the face." | **bare** | - | - | - |
| **F4 "The face stays bare: no tattoo on the face."** | faint line at the jaw edge | **bare** | face ink kept | - |
| F5 "The face stays bare skin: no tattoo on the face, cheeks or jaw." | cheek piece (worse) | - | more face ink, legs lost | - |
| F6 "Image 2 shows no tattoo on the face, so ..." | faint jaw line (= F4) | - | - | **bare** |

- "unless image 2 shows ..." is not evaluated (F, F2); naming the cheeks/jaw primes them (F5). F3 is a claim about
  the picture; F6 (the same claim, true when a describer says "no face ink") came out = F4, so no describer
  question (and no `flowsRegistry.js` change). The app's describer graph also returned `{}` on the bench (ac8),
  not chased.
- **SHIPPED F4** (`NO_FACE_INK`) in the tattoo-picture string, left out when the words name the face (face, cheek,
  forehead, jaw). Builder = bench string byte for byte (body_F4, all_F4). Partial on seed 31022 (faint jaw line).
- Noticed, not this card's ask: on t_body seed 7 the back pass left the BACK view's legs bare (front legs inked),
  shipped and F4 alike.
- npm test 3385 tests, 3383 pass / 0 fail; eslint clean.

## Face tattoos fa1-fa3 (session "New character sheets 43", 2026-10-17, G: bench :8188)

Shipped Qwen graph with `Input_Face_Crop` on (the two faces only, as Makeup r47), back pass off. Sheets M = flowCSFI_011,
W = flowCSE_044. Words TW = r45's (teardrop under the LEFT eye + tribal across the RIGHT temple), TS = "a small black
star tattoo on the left cheekbone". Scripts fa1.py, fa2.py, fa3.py, gridfa.py in session 3051ae9e's scratchpad.
The close-up turns to the picture's left on both sheets, so it shows the character's LEFT cheek.

- **Words, fa1/fa2: the side cannot be steered, and a one-sided tattoo lands on BOTH cheeks of the front face.**
  | arm | star, front face | teardrop + tribal |
  |---|---|---|
  | W0 r45 string | two stars 2/2 | everything on one side, mirrored or grouped |
  | W1 + "Left and right are the character's own: ... on the right of the picture." | two stars 2/2 | all on the close-up's visible side |
  | W2 left/right swapped in the words | two 1/2, one (wrong side) 1/2 | same as W1 |
  | W3 + "Each tattoo is drawn once, on that one side of the face only." | two stars 4/4 | same |
  | W5 W3 + W1's sentence | two stars 4/4 | same |
  The close-up is right 16/16 (one star, on its visible cheek); the FRONT face copies it onto both cheeks.
- **Picture, fa1 (imported_023, words "face and head tattoos", seed 45002)**: the picture cropped to its head first
  (SAM3 face, the face + half a face all round, = `patch_raw_ref_head_crop.py`), then
  - P1 the head crop RAW: M = the glyphs read, but his temple SHAVED; W = the picture's black eye makeup and white face
    paint put on her. FAIL (the raw-picture leak, as r22/r31).
  - **P2 the head crop through the mannequin (r45's TAT_MANN)**: the glyphs and cheek marks readable on both faces, own
    face, no makeup; r45's full-body mannequin made them unreadable. Left: W front face has them on BOTH cheeks; the
    picture's NECK ink came along (the mannequin keeps it) as a faint mark at the paste edge.
- **fa3, words: the side said as the PICTURE's** ("under the left eye" -> "under the eye on the right side of the
  picture"; a face looking at the viewer shows its left on the picture's right): **W6 one star, on her/his left, on
  both faces 3/4** (M seed 7 still two). W7 = W6 + fa2's once line: the same 3/4, so no once line. TW (two designs on
  OPPOSITE sides) stays muddled in every arm: the close-up shows one cheek only, so Qwen puts both designs there.
- **fa3/fa4, picture**: P2 seed 7 one side 2/2, seed 45002 W both cheeks; **P3 (+ "on the same side of the face as in
  image 2") one side 2/2; P4 (P3 + "none on the neck") one side 4/4, the neck ink 2/4** (P2/P3 4/4).
- **SHIPPED** (builder = W6 / P4 byte for byte, tests pin both): Tattoos whose words name the face and no other part
  (`_faceInk`: face, cheek, forehead, jaw, temple, eye, brow, chin, nose, lip; none of back, arm, leg, neck, chest ...)
  -> `Input_Face_Crop`, no back pass; with a picture `Input_Ref_Head_Crop` + the head mannequin (`TATTOO_MANNEQUIN` =
  r45's TAT_MANN), `Input_Is_Mannequin` false. Graph: `patch_raw_ref_head_crop.py` (11 nodes: SAM3 face on
  Input_Image_2 -> the square -> crop; no face = the whole picture; lazy, its own switch so Makeup's picture is
  untouched). Words naming the face AND the neck or a limb keep the whole-sheet route.
- **fa5, the shipped path** (qh47_params.mjs -> the patched shipped graph, the RAW full-body photo in): the graph's head
  crop = fa1's (its mannequin identical in content); M seed 45002 + W seed 7 = one side, both faces, own face; star =
  one, on her left, both faces. A picture with NO face (imported_021, a back) runs (whole-picture fallback) but its
  mannequin invents face designs - garbage in, not a crash.
- Partial left: the neck mark from a picture whose neck is inked (2/4); two designs on opposite cheeks.
- npm test 3386, 3384 pass / 0 fail; eslint clean. NOT eye-tested in the app (Fabio).

## Cosmo picks the character Flow (agent bench, 2026-10-17)

Four cases in `services/agentBench.mjs` (`npm run agent:test -- --case <id>`), DeepSeek-V4-Flash-0731 on
DeepInfra, fake tools, graded on the calls the model made:

| case | ask | asserted | final 3 runs | bite (flip must FAIL) |
|---|---|---|---|---|
| `sheet-from-words` | "Make a character sheet of a grizzled old sea captain ..." | `character-sheet`, the character in `positive` | 3/3 (and 3/3 earlier) | fails: "Make an image of ..." ran krea2/t2i |
| `sheet-from-face-picture` | head-and-shoulders photo + "Make a character sheet from this picture." | `character-sheet-from-images` OPENED, never run; picture as `image1`; opens at "Box the face" | 3/3 (and 3/3 earlier) | fails: words only ran `character-sheet` |
| `sheet-from-body-picture` | full-body photo, same words | the same | 3/3 (and 3/3 earlier) | fails: the same |
| `sheet-editor-shirt` | `SHEET` (ninja sheet) + "Change the shirt to blue." | `character-sheet-editor`, `change: clothes`, blue in `words`, sheet as `image1` | 3/3 after 88494c1b0 (2/3 before) | fails: a plain photo + "as a whole-picture edit" ran klein-9b/kleinEdit |

**Finding (the editor case, not fixed: needs Fabio).** 3 of 9 runs never generated: Cosmo asked
"Mask or Whole-picture edit?" (`[options: Mask | Whole-picture edit]`) on the sheet, twice without even
looking at it, once after a look that said "a character sheet". No run picked Qwen or Klein edit on the
sheet. The words that send him there are the system prompt's Route rule (`services/agentLoop.mjs`):
"Before any other edit of an existing picture, answer this yourself: does the change stay inside ONE
area? ... One area with no such words: in ONE line give both routes ...". A shirt is one area, and the
rule has no exception for a character sheet, whose change is the Editor's on every panel. Proposed
(not applied): add to that rule "A character sheet (front, back and close-up of one character) is never
that question: any change to it is Character Sheet Editor (app:flows)."

**Fixed 2026-10-17 (`88494c1b0`, Fabio approved the wording).** The Route rule in
`services/agentLoop.mjs` now says, right after the one-area question: "A character sheet (front,
back and close-up of one character) is never that question: any change to it is Character Sheet
Editor (app:flows)." `docs/agent/flows.md` also lists the Editor's full `change` values (makeup,
tattoos, beard and custom were missing). `sheet-editor-shirt` **3/3** (DeepSeek-V4-Flash, $0.0124);
`--bite` still bites: the plain photo + "as a whole-picture edit" ran klein-9b/kleinEdit ($0.0152).
`node --test tests/agent-bench.test.cjs` 17/17.

**Bench fixes on the way.** The capture's Flow rows had no `media` slots, which GET /connector/models
folds in (`routes/connector.js` flowList), so one run put the sheet in as `source`; every Flow row now
gets `mediaRolesFor(registry, op, null)` as the route does. Character Sheet from Images and the Editor
came after the capture, so they get built rows (`boxParams` and `opens` as `agentDispatch.js` builds
them), and the fake `openFlow` answers `at` the way the app's `openAt` does.

Spent: $0.1524 of the $0.20 allowed (CLI cost lines: 0.0286 + 0.0279 + 0.0108 + 0.0153 + 0.0062 + 0.0636).
`node --test` on agent-bench, bench-community, llm-connection: 48/48 pass.

## ff1 / ff2: Accessories pass 1 on the front body | close-up only (session "New character sheets 44", 2026-10-17)

Fabio's eye-test fail flowCSE_069 ("A basketball under his arm", words only, on flowCharacterSheet_070 = the card's
Headless version, grey face): front without the ball, the ball on the back view only, a chain on it, a sliver of
pass 1's back-view ball right of cut 2. Fabio: every object a prompt names gets drawn ("chain", "strap", "pendant",
probably "back" too). Fix benched: `Input_Front_Crop` (`patch_raw_front_crop.py`): pass 1 sees the front panel
[0, cut1) | the close-up panel [cut2, W) side by side and its words name only those ("The full-body figure on the left
and the close-up portrait on the right both show it"); the sheet is rebuilt edited front | ORIGINAL back panel |
edited close-up; the back pass turns the front round as before, its accessory line cut to "Show only what can be
seen from behind." (no example objects). Script: session 97f07a80 scratchpad `ff1.py` (app strings via
qh47_params.mjs, cuts as the app measures them), G: bench, seeds 46001-46004.

| case | sheet | front | close-up | back view | verdict |
|---|---|---|---|---|---|
| ball "A basketball under his arm" | 070 | 4/4 | - | 4/4, same side as the front, no chain | **pass** (s3: a small brown arc at the close-up's left edge, the ball bled over the canvas seam) |
| pack "A black hiking backpack" | 070 | 4/4 | - | 4/4 | **pass** (s0 carried in the hand in both views, s1-s3 worn) |
| ear "Large gold hoop earrings" | 044 | 4/4 (small) | 4/4 | 4/4 hoops below the hair | **pass** |
| neck "A long gold necklace with a heart pendant" | 044 | 4/4 | 4/4 | **0/4: the heart pendant hangs on her back** | FAIL |
| pjewel picture imported_014 + "Earrings and necklaces" | 044 | 2/2 | 2/2 | 2/2 (a chain at the nape only) | **pass** |
| pgun picture imported_016 + "Mini gun" | 070 | **0/2: the gun replaces the head** (the grey face) | ok | no gun | FAIL, control below |

ff2 (`ff2.py`, back pass only changed, pass 1 identical): B2 "Show only what can be seen from behind: whatever is on
the front of the body is hidden by the body." -> pendant on the back still 4/4. B4 no accessory sentence at all -> the
pendant gone, but so are the backpack (2/2) and the ball (2/2) from behind. The user's words in the back pass draw
the pendant; without them the turn-around loses what does show from behind.

Mini gun control (picture imported_016): on flowCharacterSheet_069 (the face version) and on 044, 2/4 (the misses
float the gun or put it in the close-up). Fabio (2026-10-17): held props like a minigun change the whole pose and are
not an accessory; Accessories = things worn with the outfit + a walking stick or staff; weapons go to an image edit
model and the post-2.1 weapons sheet. Hint text + docs/agent/flows.md say so. Picture runs keep the front crop.

ff3 (shipped path, `FRONT_HANGING` words take no back pass, seeds 46001-46004):
- neck3 "A long gold necklace with a heart pendant" (044): **4/4** pendant on the front and in the close-up, the back
  view the sheet's own (no back pass, ~60 s instead of ~110 s).
- stick3 "A wooden walking stick" (070): front 4/4, close-up untouched; back view has a stick 4/4 but on the RIGHT
  side 1/4 (s1, s2 mirrored; s0 a stick on BOTH sides). Known partial, shipped: the turn-around mirrors a thin held
  thing like a one-limb tattoo. Next: bench naming the side as the picture's side (fa3 showed Qwen follows that,
  not the character's left/right).
`node --test` character-sheet-editor, agent-prompt-budget, agent-corpus, agent-bench, flow*: all pass.

ff4 (session "New character sheets 45", walking-stick side, 070, "A wooden walking stick", seeds 46001-46004; ff4.py
in session 3465d94f's scratchpad). Correct = the front's picture side swapped from behind:
- A, pass 1 as shipped, the back pass "..., held as in image 1. Seen from behind, left and right swap: a thing in the
  hand on the left side of image 1 is in the hand on the right side of the picture, and a thing on the right side of
  image 1 is on the left side of the picture.": **4/4** (front L/R/R/L, back R/L/L/R), one stick each.
- B, the side pinned as the picture's: pass 1 "... held in the hand on the left side of the picture", the back pass
  "... held in the hand on the right side of the picture.": **4/4** (front L 4/4, back R 4/4), one stick each.
Not shipped: wording to Fabio first (my pick A: no hand fixed, follows whatever pass 1 drew).
Fabio picked A. SHIPPED as `ACC_SWAP` in `buildBackPassPrompt` (every Accessories back pass; the test pins it).
ff5 (ff5.py, the shipped strings via qh47_params.mjs, 070, ff1's seeds): ball 4/4 on the other side from behind;
backpack 4/4 (s0 carried in the hand, swapped side; s1-s3 worn). Partial, NOT new: ball s3 leaves a sliver of arm at
the back panel's right edge, drawn by the back pass (the source sheet is clean there) - ff1 ball_s3 (old wording, same
seed) has the identical sliver, missed when ff1 was judged 4/4. Fabio's first eye-test fail named the same ghost.

Fabio eye test 2026-10-18 (app, Accessories "Back arched and curved, leaning on a walking stick" + Age 78, Headless):
Qwen stick -> Klein age -> head removal. **Stick pass**: front on the picture's right, back on the picture's left,
kept through the age leg. No arched back (a posture is not an Accessory; Fabio: an edit or video model's job). The
age leg's front face and close-up came back as different men (front bearded); Headless hides the front face (Fabio
ok). Eye test (a) **pass**: app.log 08:01:58 "sheetCuts measured: 490,908".
Fabio eye test (b) 2026-10-18 **pass**: Cosmo + the attached sheet + "Change the shirt to a basketball shirt with the
number on the back" ran Character Sheet Editor (Clothes) at once, no Mask question; jersey on all three views, the 13
on the back, the cane kept. The shorts changed too ("a basketball shirt" read as the whole kit); Fabio: fine for v1.
Fabio eye test 2026-10-18 **pass**: Accessories, picture (the jewellery face photo) + "Earrings and choker" on the
curvy pink-bob sheet: drop earrings + choker on the front and the close-up, her own face and hair, back view clean.

Fabio eye test 2026-10-18 FAIL -> ff6: Accessories words "A small black crossbody sling bag worn on the chest, its strap
over one shoulder and across the back" on flowCSE_062 (card caacd448): the bag on his chest AND on his back (the back
pass repeats the words, as the pendant), no strap in the close-up. ff6 (ff6.py, seeds 46001-46004):
- S, the back pass names only "a thin strap that runs diagonally across the back, from one shoulder down to the other
  side of the waist" + the side swap, the bag never named: **strap only from behind 4/4, other side 4/4**; close-up 0/4.
- SC, S + pass 1 "The close-up portrait on the right shows its strap over the shoulder.": back 4/4 as S; **close-up 2/4**.
SHIPPED SC (shipped strings = the bench byte for byte): `FRONT_WORN` words (worn on the chest/front, chest bag/pouch,
crossbody, sling bag) + `STRAPPED` (strap, band, crossbody, sling) -> `BACK_STRAP` + `CLOSE_STRAP`; front-worn with no
strap -> no back pass. Partial: the close-up strap 2/4. Not benched: a front bag from a Reference picture (the back pass
takes the strap words the same way). Tests 33/33.
Fabio eye test 2026-10-18 **pass** (after Ctrl+Shift+R; flowCSE_075 before it ran the old prompt): the sling bag on
the blue-beard sheet flowCSE_067 -> flowCSE_076: the bag on the chest, only the strap from behind on the other side,
the strap in the close-up.
Fabio eye test 2026-10-18, Cosmo asked his way ("a pouch, one of those pouches, with a strap over the shoulder"):
routed to Character Sheet Editor / Accessories, words "a small tan leather pouch worn at the hip, on a strap over one
shoulder across the chest" (flowCSE_077): the hip bag on the front and, rightly, at the hip from behind. But
"across the chest" had matched `FRONT_WORN`, so the back pass got the strap-only words; Qwen drew the bag from image 1
anyway (right result, wrong branch). "across the chest" removed (it says where the strap runs); test pins Cosmo's words
to the normal back pass. Fabio: animating it on a video model to judge.
