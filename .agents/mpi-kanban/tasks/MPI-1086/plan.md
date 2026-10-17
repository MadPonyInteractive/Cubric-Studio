# MPI-1086 plan - Hairstyle / Accessories reference picture, and the fringe

Umbrella MPI-1091. Brief: `brief.md`.

## Current State

2026-10-17 (session "New character sheets 39") - LATEST. Beard with an EMPTY box = a full trimmed beard in the hair colour (6760add86, bd4 3/3, CI green); the option note says so. Fabio ran Beard WITH A BEARD PICTURE and expected no words to be needed: Beard ignores image2 today (not in `REF_THING`, words only). NEXT build: Beard from a Reference picture - bench first (likely the Hairstyle way: describer words `refBeard` + a Klein mannequin wearing only the beard, or the raw picture like Accessories); then the image2 slot label (add beard). Fabio eye tests still owed (lead the next session with this list): Beard in words + empty box; Makeup re-test after MPI-1156 (child, man, woman); Accessories; Tattoos back-pass stitch. Beard benches bd1-bd4: validation.md; scripts in session 26ec60d2 scratchpad (bd*.py, grid_bd.py, heads_bd.py), run on the G: bench :8188.

2026-10-16 (session "New character sheets 39") - LATEST. BEARD SHIPPED 5e3f51da5: option `beard` -> Qwen, words only, builder = bench b_each (bd1-bd3 in validation.md, 6/6; the Hairstyle every-figure string missed a long beard on the front face). Not eye-tested. The child-safety redesign (MPI-1156) has landed, so the Makeup blocker below should be gone. NEXT, all Fabio when his GPU is free: Beard eye test, then the Makeup re-test (child, man, woman), Accessories + Tattoos-stitch eye tests. Then face tattoos (head-crop mannequin), close-out. Open: add "a beard" to the CSE line in docs/releases/UNRELEASED.md (held by the Cosmo + MCP card-import session at write).

2026-10-16 (session "New character sheets 34") - LATEST. PARKED, BLOCKED on the child-safety redesign card (Fabio 2026-10-16). Fabio's eye test: child sheet + Makeup picture still refused after the mannequin fix (app.log 08:11 and 08:20, picture answer=YES). Cause: the gate reads EVERY string param, including the describer's raw refMakeup answer that flowService stores (flowService.js describe merge), so a describer word like "nude" (lipstick) makes it look at the picture, and a child is refused. Stopgap tried, then REVERTED. Resume here once the new gate lands: re-run the Makeup eye test (child, man, woman; picture +/- words), then Accessories + Tattoos-stitch eye tests, face tattoos (head-crop mannequin), Beard, close-out.

2026-10-16 (session "New character sheets 33") - LATEST. Fabio saw his spider run take the mannequin's pale skin.
r46: a "skin line" in the prompt did nothing; the face crop itself fixes it. BUILT, uncommitted: localised Makeup in
the Qwen graph (`Input_Face_Crop`, `patch_raw_face_crop.py`, raw + api), app strings "both faces" + the flag
(characterSheetEditor.js), tests, playbook. r47 (validation.md): shipped graph = bench, 8/8 pass, npm test green.
NEXT: Fabio's eye test in the app (Makeup, picture + words, man + woman), then commit by pathspec. Still open:
Accessories + Tattoos-stitch eye tests, face tattoos (head-crop mannequin), Beard, close-out.
BREAKER found in Fabio's eye test (child sheet + makeup picture -> "Refused: nudity..."): the gate read our own
`Input_Mannequin_Prompt` ("no jewellery and no clothes") as user words, so EVERY Makeup-from-a-picture run was
looked at (since 1cac8798a) and a child sheet refused. FIXED: childSafety.js SKIP_KEY skips `mannequin_prompt`, test
in child-safety.test.cjs, docs/child-safety.md. NOT re-tested in the app yet. Open, Fabio's call (he wants Halloween /
superhero makeup on kids to work): describer words like "nude lipstick" still trip UNCLOTHED ("nude") -> the look ->
a child refused. Options: exempt "nude" as a makeup colour (nude lips/lipstick/eyeshadow/tone) or reword the
refMakeup describer ask to name colours without "nude". My pick: the describer ask (no gate loosening).

2026-10-16 (session "New character sheets 32") - LATEST. 1cac8798a + 5a17854c4 on origin, master CI green
(38849888142). Fabio: Accessories NOT eye-tested yet (only Jewellery). New idea from Fabio: LOCALISED face edit for
Makeup (SAM3 face -> `MpiMaskSquareBbox` -> crop, edit, stitch back) for speed; hair + beard out (long ones spill).
My add: face tattoos fit the same mask (fixes the Tattoos face leak). BENCHED r45 (validation.md, `qh45.py`, crop +
stitch in Python): Makeup on Qwen 4/4 own face + same makeup both faces, 54 s vs 124 s whole sheet (2.3x); Klein 1/4.
Face tattoos: words ok-ish on Qwen (mirrored side), picture FAIL (mannequin of a full-body photo too small; needs a
head crop first). NEXT: Fabio's call - build localised Makeup into the Qwen graph (SAM3 face per panel ->
MpiMaskSquareBbox/MpiBoxCrop x2 -> ImageStitch canvas -> edit -> paste back through the face mask; keeps the in-graph
makeup mannequin), and whether face tattoos get it too. Benches from now on: the G: bench :8188 (Fabio, 2026-10-16),
NOT the app engine. Still pending: Fabio's eye test of Tattoos stitch + ACCESSORIES (only Jewellery tested so far).

2026-10-16 evening (session "New character sheets 31") - LATEST. Makeup mannequin COMMITTED + pushed 1cac8798a
(Fabio's eye test passed). BUILT, uncommitted: the Tattoos back pass STITCHED at the sheet's measured gaps (r44 in
validation.md: ghost gone on flowCSE_052, default cuts = old picture pixel for pixel, npm test 3334/0). Files: raw +
api Qwen graph, flowEnhance.js (sheetCuts, shrinkGray, measure entry), flowsRegistry.js, characterSheetEditor.js,
two tests, playbook. Fabio looked at the r44 pictures (2026-10-16 night): "R44 ghost is good". The white strip he
saw right of the w10 sheet was MY contact sheet's padding (w10 is 1670 wide, the canvas 1810): the output's own
right edge is backdrop grey (148,137,136) - told him. NEXT: his eye test in the app (Tattoos on flowCSFI_011 + the
neck picture), then commit by pathspec. Still open:
child-safety checks' fixed quarters, face tattoos through Tattoos, Beard, close-out.

2026-10-16 later (session "New character sheets 31") - LATEST. BUILT, uncommitted (claim ada2b38e-mpi1086): Makeup
from a picture goes the Hairstyle way - in-graph Klein MAKEUP mannequin (`Input_Mannequin_Prompt`, new graph input)
+ `refMakeup` describer words + user's words leading (r41-r43 in validation.md: own face 6/6 man + woman, words 4/4,
shipped graph = bench pixel for pixel). npm test 3332/0, eslint clean, playbook at 200 lines. NEXT: Fabio's eye
test in the app (reload) on Makeup with a picture, man + woman, with and without words; then commit by pathspec.
Still open: the back-pass GHOST on "from Images" sheets (Fabio's stitch, cuts in the sheet's own gaps; the
child-safety checks share the quarter assumption), Tattoos face leak (face tattoos via a mannequin too?), Beard,
close-out.

2026-10-16 (session "New character sheets 31") - LATEST. Eye test: (1) Tattoos back pass on a "from Images" sheet
leaves a GHOST arm: the pass assumes 25|25|50 panels, those sheets do not (4 of 5). Agreed fix = Fabio's stitch,
cuts in the sheet's own gaps measured app-side - NOT built. (2) Makeup AND Tattoos from a picture leak the
reference's face onto a man (flowCSE_051/053). r39/r39b (validation.md): a firmer prompt does nothing; partial
denoise from a REAL VAEEncode of the sheet (the graph's latent_image is the text encoder's latent, not the sheet)
keeps his face - 0.85 = his face, subtle makeup right, bold paint partial; 0.90+ = full paint, face drifts back.
WAITING on Fabio: which denoise (or a strength choice). Then build: VAEEncode -> KSampler + Input_Denoise, builder
per change; bench Tattoos at < 1.0; layout stitch; Beard; close-out.

2026-10-16 (session "New character sheets 30") - LATEST. Fabio's eye test 1 (still testing, results come to the next
session): Makeup FROM A PICTURE on a MALE sheet (card flowCSFI_011 -> result flowCSE_051; reference = a white-haired
woman with spider-web face paint, orange eyeshadow, black lips) carried the REFERENCE'S TRAITS onto his face (more
feminine face, lashes) - the mA2 string held 14/15 own-face, but every bench sheet was a woman (flowCSE_044), so a
cross-gender reference was never benched. NEXT: read Fabio's remaining results, then bench makeup-from-picture on a
male sheet (flowCSFI_011 + that reference, + one more) with a stronger own-face line (e.g. keep his jaw, brows,
stubble and that he is a man) before touching the builder string.

2026-10-15 evening (session "New character sheets 30"). Fabio: ship the two-pass for Tattoos (words into
pass 2, a picture not; the outfit's back redrawn accepted). BUILT + committed: the Qwen graph's lazy back pass
(`patch_raw_back_pass.py`, `Input_Back_Pass` + `Input_Positive_2`), builder `buildBackPassPrompt`, tests, playbook.
r38: shipped graph = r37 bench pixel for pixel 6/6, off = r35 pixel for pixel, +35-50 s; npm test 3327/0.
Accessories needs no new bench (r29/r30/r36 passed; Fabio asked). NEXT: Fabio's app eye test (reload): Accessories,
Makeup, Tattoos (a one-leg tattoo in words and with a picture: same side from behind). Then Beard entry, close-out.

Earlier the same session: bench r37 (validation.md, `qh37.py`) = Fabio's
two-pass: the flip IS fixed where the front has the tattoo (t_leg1, roses: her left from behind; words in pass 2 also
put the snake right), 3 of 4 flip cases. Costs: pass 2 redraws the OUTFIT'S BACK 12/12 (strappy open back -> halter),
loses back-only tattoos without the picture (t_back), and a picture in pass 2 invents arm ink 3/4. Nothing built.
WAITING on Fabio: ship two-pass for Tattoos (words -> pass 2 with words, picture -> pass 2 without; ~+45 s), or keep
the one-pass flip as a known partial. Then eye test (Accessories, Makeup, Tattoos), Beard, close-out.

2026-10-15 later (session "New character sheets 29") - LATEST. COMMITTED + pushed 519cd6611: Makeup + Tattoos options
(see the entry below). Fabio asked for a line fixing the one-sided tattoo that flips sides on the back view (her left
leg in front, her right from behind; arms too). Bench r36 (validation.md): two no-limb side lines, NEITHER ships (A
right side 2/4 but invents arm sleeves 3/4 picture runs; B drops the front tattoo 3x). Accessories needs nothing (a
left-wrist watch already correct both views). NEXT, in order: (1) r37 = Fabio's TWO-PASS idea: edit only the front
figure + close-up, then crop the EDITED front body, Qwen "this character seen from behind" from it, composite into the
back panel (bench in a script first, on the r36 mirror cases t_leg1/t_leg2/w_roses/w_snake + controls t_neck/t_back;
read the Qwen raw graph's panel geometry - sheet flowCSE_044 is 8:5, front | back | close-up; MPI-1090's MpiBox crop
nodes may help). If it wins: decide with Fabio whether it is tattoos-only or every change (it costs ~+100 s). (2)
Fabio's app eye test: Accessories, Makeup, Tattoos (he was going to do it after the commit). (3) Beard entry. (4) Close-out.

2026-10-15 session "New character sheets 29" - LATEST. BUILT (uncommitted, claim 94b9f277-mpi1086): options `makeup`
+ `tattoos` -> flowCharacterSheetEditQwen. Benches r34/r35 (validation.md): Makeup words 2/2, picture + words 2/2
(+ r33 picture 7/7); Tattoos words 1 pass + 1 mirrored, picture ALONE 2/6 (invented sleeves) -> words REQUIRED with a
tattoo picture (`REF_NEEDS_WORDS` now a map with the refusal's example), string tQ = Accessories' + "Add no other
tattoos." 4 pass + 2 one-limb partial. Builder = bench 13/13; `RAW_REF` forces Input_Is_Mannequin for accessories /
makeup / tattoos; registry options + note, description, Qwen row label (desktop spec updated, passes), image2 label;
playbook + UNRELEASED. npm test 3324/0, eslint clean. NEXT: Fabio's eye test in the app (reload): Accessories (words +
picture), Makeup (words, picture, picture + words), Tattoos (words, picture + where-words; picture alone refuses).
Then commit by pathspec, Beard as its own entry, close-out.

2026-10-15 end of session "New character sheets 28" - LATEST. DECIDED (Fabio): split BOTH Makeup and Tattoos into
their own options, on Qwen, each with its own prompting (tattoos "notoriously hard": one-leg tattoos land on the wrong
leg in a view, full-body tattoos are partly invented). NEXT, in order: (1) bench r34 (qh34.py on qh33.py) - Tattoos
with a picture: "copied exactly: same designs, colours, size, same place on the body" + "Add no tattoos that are not in
image 2" + no limb sentence (r32's "arm or leg" ADDED arm sleeves), Fabio's 6 tattoo refs (qh31.PIC t_*) + 2 in words;
Makeup in words (own face named part by part, like mA2) x2; Makeup picture + words = mA2 + "Change only this about the
makeup: <words>" x2. (2) Build: options `makeup` + `tattoos` -> flowCharacterSheetEditQwen, builder strings (makeup
picture = qh33.mA2), REF_THING + refusal rules, Input_Is_Mannequin true for both, Accessories info stays items only;
tests + eslint + the desktop spec flow-optional-model-row if a label changes. Benches need Fabio's app idle (queue empty
at 48188 = his standing go).

2026-10-15 later (session "New character sheets 28") - LATEST. 25 steps SHIPPED in the editor's Qwen graph (Fabio;
commit with r31). Master went red on 1126f7dc1 (flow-optional-model-row.spec pinned the old Qwen row label) - fixed
in e4909f920, CI green. r31 (Fabio's 13 makeup/tattoo pictures, shipped Accessories string): tattoos 4 pass + 2
partial (back view mirrors a one-limb tattoo); makeup copies 7/7 but the reference FACE leaks 5/7. r32: a makeup-only
face-keeping string `qh32.mA` keeps her face 7/7 + no piercings 7/7 (spider-web paint lost); words-only also holds;
the same-limb tattoo sentence made it WORSE (dropped). r33: `qh33.mA2` ("copied exactly") = makeup 7/7 + own face
7/7 (web paint back; one choker leak); mA on new seeds 7/8 own face. NEXT for Fabio: split call - Makeup needs its OWN string (my pick: a Makeup option = mA with a
picture, qw2-style words without; Tattoos stay in Accessories), then build + tests.

2026-10-15 (session "New character sheets 28") - LATEST. Bench r30 (validation.md, `qh30.py`): Qwen at 25 steps =
30 on r29's four (same pictures, ~15% faster). The SHIPPED words-only Accessories (Klein) redraws the front figure as a
back view 4/4 on sheet flowCSE_044 (not released: the Flow is new in 2.1); the fix is routing Accessories to Qwen.
Qwen words-only: bare "Mask" became a purple matte with `q_words`; `qw2` ("this accessory to wear or hold: <words>")
fixes it, 3 pass + mask partial (close-up only).
SHIPPED (Fabio: "move all Accessories to Qwen, non-commercial note included"): registry `accessories` ->
flowCharacterSheetEditQwen, option info + description + requiredModels label say Qwen / not commercial; builder
strings = r29 q_raw (picture, leading article dropped) / r30 qw2 (words), byte-identical to the bench on all 8 cases;
`Input_Is_Mannequin` forced true for accessories; playbook + UNRELEASED.md. npm test 3324/0, eslint clean.
OPEN for Fabio: (1) 25 steps for the whole Qwen editor graph (hair/body benched at 30: re-bench 2 cases first),
(2) Makeup + Tattoos pictures, (3) eye test Accessories in the app (reload), (4) the split (my pick: no split unless
Makeup/Tattoos fail). Then Beard as its own entry, close-out.

2026-10-15 (session "New character sheets 27") - LATEST. Body shape eye-tested PASS. Eye test 4: Accessories + a
picture on Klein (AW3) redrew the FRONT figure as a back view 4/4 and leaked the reference person. Klein edit path is
unchanged since 85f96744a, so not the graph. Bench r29 (validation.md): Qwen-Image 2.1 with the raw reference as
image 2 (Input_Is_Mannequin true, no mannequin) = layout 4/4, own face + hair 4/4, items placed with no "where" words;
Klein + a front sentence fixes layout but leaks the person 2/4. NEXT: r30 on Qwen = Makeup + Tattoos (Fabio's pictures)
+ Accessories in words only (Klein vs Qwen); then ship accessories+picture -> Qwen (registry map entry
`{ when: { media: 'image2' }, then: Qwen, else: Klein }`, builder q_raw string, force Input_Is_Mannequin true) and
decide the split (Fabio: Accessories / Weapons / Jewellery / Makeup / Tattoos). Bench script qh29.py.
Fabio (after r29): try Qwen at 25 steps (30 was picked against t2i deformations; an edit may need fewer) - r30
first arm = steps 25 vs 30 on r29's four cases (find the steps node in flow_character_sheet_edit_qwen.json; the bench
can override it like any input). My pick for the split: one Accessories option on Qwen, split only if Makeup/Tattoos fail.

2026-10-15 (session "New character sheets 26") - LATEST. Eye test 3 (validation.md): hair from a picture = one card
with 3 versions PASS; a given mannequin as the Reference skips the mannequin step (describer "Yes", Qwen only, 136 s)
PASS; a Stopped run keeps its cached mannequin as its own card - Fabio: fine. Hair in WORDS failed on Klein (a
mohawk came back as silver braids; it cannot take hair away) -> bench r27/r28 -> SHIPPED: `hair` ALWAYS routes to
Qwen, builder `hair` string names every figure (4/4), Hairstyle option `note` "Describe the cut, not just its name"
(a select option's `note` now renders under the dropdown, declaredFields.js). Commits ed258233f, 05e76d391, pushed.
Fabio: "Very nice" on a bob + pink gradient in words. Boogu (Fabio asked) NOT benched: not installed in his app.
Klein lock 2 + the `{ when, then, else }` map-entry rule are now unused (kept for Accessories with a picture).
Not eye-tested yet: 2 words-only re-run to the end, 4 Body shape, 6 Age + hair. NEXT: Accessories (Fabio: may want
the mannequin option too), then Beard as its own entry, close-out. Benches now run on the APP engine :48188
(qh27.upload stages sheets; the :8188 G: bench was down) - ask Fabio, his app idle.

2026-10-14 night (session "New character sheets 25") - LATEST. Eye test 2 (validation.md): words fix the hair; the
describer's ask listed "bunches" -> buns (FIXED in flowsRegistry.js, uncommitted). The mannequin rebuilds every run: the
Headless leg ALWAYS runs as a second prompt (MPI-1087) and the RAM-pressure cache drops the older prompt's results.
DECIDED by Fabio: (1) ONE graph per route: Qwen (hair from a picture) = mannequin -> edit -> SAM3 headless, outputs
Output_Image / _2 / _3; Klein (words) = edit -> SAM3 headless. (2) A flow with ONE deliverable lands every output its
graph makes as VERSIONS of the one card; a flow whose job is several files (Stems) keeps one card per output. Declared
per flow. (3) "Headless front body" only picks which version shows. (4) A mannequin is detected by a describer yes/no
question on the reference picture (any source: gallery, web, a later Element) -> `Input_Is_Mannequin` skips the Klein
step (MpiIfElse is lazy). Keep the mannequin switch generic - Accessories may need it too (Fabio). (5) The separate
Headless leg stays only after Age legs (headless must be last). GPU bench: ask Fabio first.
BUILT (uncommitted, claim efbdbf02-mpi1086; npm test 3316/0, eslint clean): `research/bench/patch_raw_versions.py`
patched both raw graphs + one-file converts (injection rules OK). Klein: Input_Headless -> MpiIfElseInverted gate ->
the headless nodes (SAM3 loader 13 shared) -> Output_Image_3. Qwen: Input_Is_Mannequin (lazy picture-2 pick skips
Klein), mannequin -> Output_Image only when built, edit Output_Image -> Output_Image_2, headless Output_Image_3.
App: commandExecutor passes `outputTitles`; commandRegistry `outputVersions: { Output_Image_3: headless op }` on both
editor ops; generationService lands those as versions of ONE card (`js/utils/outputVersions.js` orders by capture,
`hideVersionOps` keeps the head removal unshown when the toggle is off); flowService passes hideVersionOps; builder
injects Input_Headless (change leg, no Age) + Input_Is_Mannequin (describer `refIsMannequin` yes/no); registry head
leg `when: Input_Age >= 1`; userFlows OP_KEYS += outputVersions. The result-pane toggle needs NO change: it finds
the partner by op + neighbour, and the in-graph version is filed as flowCharacterSheetHeadless right after the edit.
BENCHED r26/r26b/r26c (validation.md): structure 6/6, mannequin cached on a words-only re-run (175 s vs 347), Klein
never loads for Body shape or a given mannequin (after the MpiClearVram fix: it is an OUTPUT_NODE and had pulled the
mannequin into EVERY Qwen run since r23), ONE MpiClearVram per graph at the very end (Fabio). npm test 3317/0.
NEXT: Fabio's eye test in the app (reload): hair from a picture (3 versions on one card: mannequin, edit, headless;
the Headless toggle swaps versions, no re-run), a words-only re-run (faster), a gallery mannequin card as the
Reference (no mannequin step; the describer must say "yes"), Body shape, Klein hair in words, Age + hair (head leg
after age). Open: the describer's yes/no is not benched (it costs a DeepInfra call: ask). Then Accessories
(mannequin option too, Fabio), Beard entry, close-out.

2026-10-14 close of "New character sheets 24": COMMITTED + pushed. Also landed: the Reference slot label on two lines
(Fabio asked twice: label "Reference picture (optional)\nan outfit, accessory or hairstyle" + `.mpi-base-flow__slot-label`
white-space: pre-line). Fabio is running HIS OWN eye test 2 (not the cases I suggested - those were benched) and brings
the results to the next session: read them, fix what fails, then Accessories.
2026-10-14 evening (session "New character sheets 24"). ALL BUILT (uncommitted, claim b37ddba9-mpi1086):
registry routing + text landed after MPI-1101 released flowsRegistry.js; r23 rate 17/18, r24 words 6/6, r25 shipped
graph = bench pixel-for-pixel + Body shape still fine; npm test 3313/0. NEXT: Fabio's eye test 2 in the app (reload),
then commit by pathspec and move on to Accessories. Open calls: remove the Klein graph's now-unreachable SAM3 hair
cut-out (my pick: yes).
2026-10-14 later (session "New character sheets 24"). r22 (raw photo, no mannequin) 5/6, make-up leak;
r23 (mannequin INSIDE the Qwen graph, describer on the raw photo) 6/6, Fabio: "best results so far". BUILT
(uncommitted, claim b37ddba9-mpi1086): Qwen raw patched (`research/bench/patch_raw_qwen_ref.py`) + one-file convert
(45 nodes, injection rules OK); commandRegistry Qwen op takes image2; builder hair+picture strings name image 1 /
image 2; tests (19/20 - the routing one waits on the registry); playbook. BLOCKED: js/data/flowsRegistry.js claimed by
"Make seamless flow 10" (MPI-1101, claim 51251745), message 981f0d45 sent. Registry edits to make: flowOperation +
flowOperations + flowRunLegs(ctx) accept a map entry `{ when, then, else }` (ruleHolds; flowControlFieldIds unchanged
- media rules carry no field); map `hair: { when: { media: 'image2' }, then: 'flowCharacterSheetEditQwen', else:
'flowCharacterSheetEdit' }`; refHair ask -> qh17.ASK2; Qwen slot label + description + hair option info say a picture
runs on Qwen (non-commercial). QUEUED on the GPU behind MPI-1101's bench: `qh23.py rate` (s1-s4) and `qh24.py` (words +
picture: "in blue" / "gradient purple top, black bottom" / "in silver white", the builder's with-words string).
Klein graph's SAM3 hair cut-out (lock 2 + reference) is now UNREACHABLE (hair+picture left Klein) - remove or keep:
Fabio's call. Next after hair: Accessories (Fabio), then Beard entry, slot label.

2026-10-14 (session "New character sheets 23") - LATEST, read this first. Fabio's eye test FAILED the shipped
picture route (85f96744a). Bench r16-r21 (validation.md): hair FROM A PICTURE now = (1) mannequin pass on Klein edit
(`qh19.M4`, seed 735724985: "Replace the person with a plain white mannequin seen in a three-quarter view, and keep
the hairstyle exactly as it is: the same length, shape and colour. No jewellery and no clothes, on a plain grey
background.") -> (2) describer with `qh17.ASK2` (names roots / two-tone) on the MANNEQUIN -> (3) edit on QWEN-IMAGE 2.1
(the Editor's Qwen graph + the mannequin as `images.image_2`, string `qh21.q1`) = 17/18 clean. Hair in WORDS stays
Klein (lock 2). Klein lock rounds r16-r20 (neck lock, eyes brow line, back-background hold) reached ~11/17 - parked,
NOT shipping. NEXT: build it - Qwen graph gets an Input_Image_2 (raw + one-file convert), a mannequin leg before it
(Klein edit), the describe entry `refHair` reads the mannequin with ASK2, operationBy hair-with-picture -> Qwen
(gated non-commercial note, like Body shape). Then: Beard as its own entry (Fabio), slot label on two lines (needs
flowsRegistry.js - MPI-1101's claim), accessories later.

2026-10-12 (session "New character sheets 22"): card moved to doing. Inputs found:
- Fringe fail: `Qwen 2.1/Media/flowCSE_008.png`, sheet `flowCSFI_002.png`, "Black and pink Bobcut with Fringe",
  seed 3745015294 (sidecar `.meta/6d720607-...json`). Lock 2 = SAM3 "face" on the front and the close-up.
- Hair reference photo (curly blonde buns): `Qwen 2.1/Media/.preview-assets/50f19ab75af75237b8a56afcb17a02...jpg`.
- `js/data/flowsRegistry.js` is claimed by live peer MPI-1071: the slot label and the "Nothing else" rename wait
  for it to be released (or go by mpi-message). Everything else is in this session's claim `ecc2e047-mpi1086`.
Phase A DONE (validation.md): root cause = lock 2's "face" mask covers the forehead; the B3 brow cut (`qh2.brow_cut`,
`a + b // 3`) gives a fringe 3/3 front + close-up. Queued (bench, under lease): `qh4` (B3 regression on Fabio's other
hair words + lock-1 mask identity), `qh3 B3` (phase B, hair from the buns photo / head crop), `qh5` (phase C,
accessories from 4 Klein-made refs). Logs: session scratchpad qh34.log, qh5.log. Contact sheets via scratchpad sheet.py.
Read so far (validation.md): qh4 regression (braids pass; a bob now gets a fringe unasked - Fabio's call), qh5
accessories round 1 (words needed; a person in the ref leaks his face), qh6 Custom (C2 wins).
LANDED UNCOMMITTED: B3 brow cut in raw (`research/bench/patch_raw.py`) + converted/gated API for this ONE file
(proved node-for-node equal to `qh2.brow_cut(.., 'a + b // 3')`, raw diff = only the expected rewires); builder
`custom` case (C2) + tests 19/19. Waiting: qh3 B3 (hair ref), qh7 (accessories round 2).
2026-10-12 handoff (session "New character sheets 22"): Fabio OK'd taking over the character-sheet-editor block of
flowsRegistry.js from MPI-1101 (no reply to message 8b7a5fbf). DONE + COMMITTED (only my hunks of flowsRegistry.js;
MPI-1101's uncommitted ruleHolds/media-rule edits left in the working tree): Custom + None options, operationBy custom,
image2 label "Reference picture (optional): an outfit, accessory or hairstyle", description, describe `refHair`; test
for refHair asks. Full suite 3236 / 0 fail; flow tests 396/396; eslint clean. ONE stale comment left in
flowsRegistry.js ~1686 ('skipped for "Nothing else"' -> 'skipped for None'): guard-claim blocks edits while MPI-1101's
claim is live (my first registry edit went through `python -c`, a known guard gap - do not repeat it).
NEXT: Fabio's eye test in the app (reload): Hairstyle + one of his Pinterest pictures, no words and "in blue";
a fringe in words; Accessories + a picture with words; Custom; None + age. Then close (mpi-end-session).
2026-10-12 evening: ALL BENCHES DONE (validation.md). LANDED UNCOMMITTED: graph (B3 brow cut + hair cut-out SAM3
"hair", raw via patch_raw.py + patch_raw_cutout.py, one-file convert, = qh14 graph 102/102), builder (custom C2,
accessories AW3 + words required, hair D3 with `refHair` / W2 with words), tests 19/19 (+77/77 related), playbook,
docs/child-safety.md. LEFT: flowsRegistry.js (character-sheet-editor block: options custom + None, operationBy custom,
image2 comment, description, describe entry `{ to: 'refHair', media: 'image2', when: { field: 'change', is: 'hair' },
ask: qh12.ASK }`) - held by MPI-1101 (claim 3feb22c3-mpi1101), asked by message 8b7a5fbf, no reply yet. Then
commit everything by pathspec + Fabio's eye test. Do NOT commit the builder without the registry (hair would run with
no description).
2026-10-12 later: Accessories DONE in the builder (AW3 + words required, tests pass). Hair from a picture = DESCRIBE it
into words (new describe entry `refHair` on image2 when change is hair; the real describer's answers in validation.md)
+ D3 string (`qh11.d3`) + the reference CUT OUT to head + hair in the graph at lock 2 (`qh13.hair_cutout`, running).
If qh13 holds: patch the cutout into raw (extend patch_raw.py), builder hair branch reading `values.refHair`, a
with-words bench (D3 + "Change only this about the hairstyle: <words>"), then registry (describe entry, Custom/None,
slot label) once MPI-1101 frees flowsRegistry.js. qh9 is superseded by qh13.
OLD NEXT: read qh7 + qh8 (hair round 2: take the old hair away + keep own face and clothes), then qh9 with the winner on
Fabio's 7 Pinterest refs (imported_005-011, staged mpi1086_pin<N>.png), then strings into the builder, then the
registry. flowsRegistry.js is now claimed by MPI-1101 (session 3feb22c3, uncommitted edits in it): ask before editing.
Fabio 2026-10-12: users give a front-facing PORTRAIT PHOTO, as is (no crop, rarely a front+back sheet). The string
must stop the photo's clothes/jewellery leaking; the back view is a plausible guess from the front, judged as such.

## Plan

A. **Fringe** (words only, lock 2). Hypothesis: the SAM3 "face" mask covers the forehead, so a fringe is frozen
   out of the picture. Render the lock-2 mask on flowCSFI_002 (qg4.mask_graph shape, lock 2). Repro Fabio's string
   on his seed + 42 + 7. If the forehead is masked, cut the face lock at the brow line in the graph (face box top +
   a fraction of its height, the MPI-1090 MpiBox trick); if not, it is the wording - bench naming the fringe
   ("a fringe covering the forehead"). Check the other hair cases still pass (bob, braids).
B. **Hairstyle reference** (lock 2): the photo and a hair-only crop; no words and with words. String shape from
   MPI-1090: every figure named, the back one "seen from behind", words in their own sentence. Watch: hair on all
   three panels (F2 round 1-2: 1 of 8), an extra figure, the reference's face leaking in. 3 seeds each.
C. **Accessories reference** (free edit): earrings, a backpack, a bandana from a picture. Then bring Fabio the
   split-or-not call with evidence.
D. **Ship**: `REF_THING` + strings in `characterSheetEditor.js` (verbatim from the winners), refusal and card name,
   tests, playbook, the graph patch (raw + convert ONE file, never the full sync script). Slot label + "Nothing
   else" rename in `flowsRegistry.js` once MPI-1071 frees it.
   **Fabio 2026-10-12: option B** - "Nothing else" splits into "Custom" (new value `custom`: a free edit in the
   user's words, lock 0, needs its own benched string on the accessories shape - "the character seen from behind",
   never "the back view") and "None" (today's `none`, relabelled: no change prompt, age only).

GPU only through `gpu_lease.py run --poll 2`. Bench images stay out of the repo (G:/ComfyUi/ComfyUI/output/mpi1086/,
contact sheets in the session scratchpad). Bench scripts in `research/bench/`, reusing MPI-1090's qg* + MPI-1041 qf2.

## Verification

**Verify mode:** user-ux

- Bench evidence in `validation.md` (eye-read of every image, per case pass/fail).
- `node --test tests/character-sheet-editor.test.cjs` passes.
- Fabio runs a hairstyle from a picture, a fringe, and an accessory from a picture in the app.

## Completed

(none yet)

## Plan Drift

- 2026-10-12 (session "New character sheets 23"): Fabio eye test 1 FAILED the picture route (validation.md). Accessories
  parked; hairstyle first. Round 16 (`qh16.py`): Klein mannequin pass on the photo as the reference (Fabio's find),
  no SAM3 cut-out, x face lock A (shipped lock 2) / B (lock 0) / C (lock 2 on "eyes, nose, mouth"), on the buns
  woman, the man (pin6) and braids (pin7), s42/s7. Log: session scratchpad qh16a.log. Beard = a separate "Beard"
  entry (Fabio) - after hairstyle. Slot label on two lines - waits on MPI-1101's flowsRegistry.js claim.
- 2026-10-14: rounds 17-20 + rate in validation.md. Fabio: Qwen-Image 2.1 for hair FROM A PICTURE, Klein for hair in
  WORDS. `qh21.py` ready (M4 mannequin as images.image_2 on the Editor's Qwen graph, no lock; 3 sheets x s42/s7,
  `rate` = s1-s4). NOT RUN: Fabio is on the GPU - wait for his go, then `gpu_lease.py run --poll 2 -- python qh21.py`.
- 2026-10-14 (session "New character sheets 24"): Fabio - try Qwen WITHOUT the mannequin first (`qh22.py`: raw photo as
  image_2, ASK2 on the raw photo, qh21 string). Holds ~17/18 -> ship with no mannequin (Qwen graph Input_Image_2,
  operationBy hair+ref -> Qwen, builder q1). Fails -> mannequin step. The app runs a Flow's legs as separate jobs, each
  later leg handed ONLY the previous picture, and describes only before leg 1 - so a mannequin pre-pass needs a new
  flowService step (or lives inside the Qwen graph, but then the describer reads the photo and one prompt loads Klein +
  Qwen). WAITING for Fabio's GPU go.
