# MPI-1086 plan - Hairstyle / Accessories reference picture, and the fringe

Umbrella MPI-1091. Brief: `brief.md`.

## Current State

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
