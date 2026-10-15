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
