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
