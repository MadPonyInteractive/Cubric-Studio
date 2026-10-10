# MPI-1041 A4 - the pinned templates and describer asks (2026-10-10, bench :8188, under the GPU lease)

Runner `research/bench-tools/qtemplates.py` via `run_qtemplates.sh`; every edit is Klein 9B on the bench graph
(`klein9b_edit_api.json`, kleinEdit, seed 42), CLOTHED sheets only: photo = `mpi1042art_cafe2_sheet.png`, fisher =
`mpi1042art_fisher_sheet.png`. No age edit ever saw the nude sheet (asserted in the runner); the nude sheet was only
DESCRIBED. Outputs: `G:/ComfyUi/ComfyUI/output/mpi1041_age/templates/` (`<tag>_<sheet>.png`, `pairs_templates_*`,
`describe_results_v1|v2.json`, `gate_out.json`, `lock_overlay_*.jpg`). Round 1 = `PHASE=all`; round 2 = `ONLY=teen15b,teen15c,teen15e
ASKSET=v2 PHASE=all`. Lease line seen both times: `mpi-kanban: GPU 0 leased`. Layout (`layout.py`): every output within 11 px.

## The strings (Phase B copies these VERBATIM; `L1` is one trailing sentence pair, a leading space included)

```
L1       = " Make the same change in the close-up portrait on the right. Keep everything else exactly as it is."
TEEN 15  = "Change the character in this character sheet to be a younger version of themselves as a 15-year-old, with a teenager's smooth face, no beard and no wrinkles, the same hairstyle and hair color, wearing the same clothes." + L1
OLDER 70 = "Change the character in this character sheet to be an older version of themselves as a 70-year-old." + L1
ACCESS.  = "Give the character a red scarf and round glasses." + L1
```

Teen 15 is the derived shape of SET v3 (`... a younger version of themselves as a {N}-year-old{ noun}, with {what the new age
lacks}, wearing the same clothes.` + L1: 10 -> "child ... a child's smooth face, no beard and no wrinkles"; 30 -> "a younger face, smooth skin and no grey
hair"). Failed wordings, kept so nobody retries them (all start "Change the character in this character sheet to be a younger version
of themselves as a" and end with L1):
`teen15` (v1) = "... as a 15-year-old teenager, with a teenager's smooth face, no beard and no wrinkles, wearing the same clothes." + L1;
`teen15c` = "... as a 15-year-old, with a younger face, smooth skin and no grey hair." + L1;
`teen15e` = "... as a 15-year-old child, with a young teenager's smooth face, no beard and no wrinkles, wearing the same clothes." + L1.

## Edit templates (2 sheets each)

| template | sheet | verdict | s | artefact (`.../templates/`) |
|---|---|---|---|---|
| teen15 (v1, "teenager") | photo | **FAIL**: front + back became a short-haired brown boy, the portrait kept red curls and reads ~20-25: panels disagree | 27 | `teen15_photo.png` |
| teen15 (v1) | fisher | PASS: a boy (~13) on all three panels, same suit, tie, beanie | 19 | `teen15_fisher.png` |
| teen15c ("a younger face...") | photo | **FAIL**: front a boy, back a bun, portrait auburn side-swept: panels disagree | 18 | `teen15c_photo.png` |
| teen15e ("15-year-old child") | photo | **FAIL**: front + back short brown hair, portrait red curls | 18 | `teen15e_photo.png` |
| teen15c / teen15e | fisher | PASS (a boy on all three panels, as v1) | 18 / 16 | `teen15c_fisher.png`, `teen15e_fisher.png` |
| **TEEN 15 (= teen15b)** | photo | **PASS**: red curls kept on all three panels, front reads ~16, portrait ~19-20 (late teen: no fix tried), same clothes | 19 | `teen15b_photo.png` |
| **TEEN 15 (= teen15b)** | fisher | **PASS**: a boy ~13 on all three, brown hair, same suit + grey tie + beanie, no beard | 19 | `teen15b_fisher.png` |
| **OLDER 70** | photo | **PASS**: white hair front / back / portrait, wrinkles on both faces, same clothes | 16 | `older70_photo.png` |
| **OLDER 70** | fisher | PASS, weak test (already old): more wrinkles, hands aged, beard + hat + suit kept; the nose loses some stylisation | 16 | `older70_fisher.png` |
| ACCESS. + head-hair lock (`accL`) | photo | **FAIL**: scarf on all panels, but the front face stays glasses-free (locked) and only the portrait gets glasses (SAM3 "head, hair" marked its HAIR only: `lock_overlay_photo.jpg`) | 9 + 79 | `accL_photo.png` |
| ACCESS. + head-hair lock (`accL`) | fisher | **FAIL**: scarf on front + back, NO glasses on any panel (the lock covers the whole head incl. beard + hat: `lock_overlay_fisher.jpg`) | 6 + 79 | `accL_fisher.png` |
| **ACCESS., free edit (`accF`, 2 MP)** | photo | **PASS**: scarf + round glasses on front and portrait, scarf collar on the back, hair + outfit kept; lower-face drift 6.2/255 | 36 | `accF_photo.png` |
| **ACCESS., free edit (`accF`, 2 MP)** | fisher | **PASS**: scarf front + back, round glasses on front + portrait, beard / hat / suit kept; drift 5.6/255 | 157* | `accF_fisher.png` |

\* the 157 s is one run on a shared box (the photo's identical job took 36 s), not the template. Drift numbers are the mean abs diff of
the portrait's lower-face box (nose to chin) against the input, 0-255; batch 3's free L1 was 4.5-7.8, so the same.
The 1 MP age outputs are 1296x816, `accF` is 1824x1152, `accL` is 1792x1120 (the masked path's stitch restores the size). **The graph A2
builds does the exact size.**

**Accessories route (the "next wording" for the failed lock): Input_Lock 0, the FREE edit, the same words.** A head lock freezes the
face and the head wear, so it blocks glasses, hats and earrings; on the photo sheet SAM3 "head, hair" did not even mark the portrait's
face (it marked hair only), so a Clothes lock there also leaves that face free. Only a scarf-style garment lands under the lock.

## Describer asks (the app's default describer: `image_descriptor.json`, qwen3vl_4b_abliterated, ChatML user turn only)

Pure function `describe(image, ask)` -> raw text, parsers `parse_age` / `parse_dressed` / `parse_caption`; 3.1-4.3 s a call (7.4 s the
first, model load), seed + sampling as the graph ships. Pinned wordings (v1 `age`, v1 `dressed`, **v2 `clothes`**):

```
AGE      = "How old does the person in this picture look? Answer with one whole number of years and nothing else."
DRESSED  = "Is the person in this picture fully dressed, with clothes covering the body? Answer DRESSED or NOT DRESSED and nothing else."
CLOTHES  = "Describe only the clothes the person wears: each garment, pair of shoes and hat that is present, with its color and material. Answer with one sentence that starts with the word Wearing."
```

Tried and dropped: `age` v2 ("Estimate ... in years. An illustrated or 3D character counts as the person it shows.") reads the same (photo 45,
fisher 80); the same AGE on the PORTRAIT HALF alone is worse (fisher 100, teen15 photo 25); `clothes` v1 ("Describe only what the person
wears: the garments, shoes and head wear, each ... name nothing else.") put "with no headwear" in the photo's caption, a negation Qwen cannot use.

**(a) AGE** - within +/-8 on **4 of the 5 sheets** (round 1 with AGE v1; round 2 with v2 gave the same pattern):

| sheet | expected (why) | AGE v1 | verdict |
|---|---|---|---|
| photo | 42 (my read of the face, 38-45; no bench record) | 40 | PASS |
| fisher | 68 (my read of the stylised old man, 65-70; no bench record) | 80 | **FAIL** (+12) |
| nude (describe only) | 25 (my read of the portrait face, 22-28; no bench record) | 25 | PASS |
| batch-15 `kleinv3_age10_photo` | 10 (the target; the bench reads it ~13) | 12 | PASS |
| batch-15 `kleinv3_age30_fisher` | 30 (the target) | 30 | PASS |
| extra: this run's `teen15` photo / fisher | 15 (the target) | 16 / 12 | PASS / PASS |
| extra: this run's `teen15b` photo / fisher | 15 | 20 (round 2) / 12 | PASS / PASS |
| extra: this run's `older70` photo / fisher | 70 (the target) | 80 / 80 (85 / 80 in round 2) | **FAIL** (+10 / +10) |

The describer is accurate from a child to ~45 and **reads every white-haired old face at 80-85** (a +10-15 bias; no wording fixed it).
So: the ask is usable for the age direction (younger or older than the target) only with a margin; never trust a read of 70 or more.

**(b) DRESSED** - **24 of 24 right** across both rounds: every clothed sheet (photo, fisher, the batch-15 children, every teen / older edit)
answered `DRESSED`; the nude sheet answered `NOT DRESSED` both times. Untested: underwear or swimwear on a sheet.

**(c) CLOTHES caption** - both clothed sheets pass in both rounds: starts with "Wearing", no person word, no pronoun, no body part:

- photo: "Wearing an olive green utility-style jacket over a mustard yellow ribbed sweater, paired with matching olive green trousers and brown leather shoes."
- fisher: "Wearing a mustard-yellow double-breasted suit with matching trousers, brown leather shoes, and a red ribbed knit beanie."

(v1 gave the same garments, plus "a gray collared shirt underneath" for the fisher, which v2 leaves out. Neither names skin or hair.)

## The gate on the captions (`checkChildSafety`, in memory, `js/data/childSafety.js`)

For each caption (v1 and v2, both sheets), `{ modelId: 'klein-9b' }` and `{ modelId: 'qwen-image-2-1' }`, with `source: 'character-sheet-editor'`
carried in the ctx: **the gate does not read a `source` (its ctx is `{ modelId, nsfw }`), so the answer cannot differ by source.**

| prompt | klein-9b | qwen-image-2-1 |
|---|---|---|
| the caption alone | ok | ok |
| `A {n}-year-old child with a child's height and body proportions: a short, small body with shorter arms and legs, a shorter torso and a larger head for the body. ` + caption, n = 1, 5, 10, 12 | ok (all 4, both sheets) | ok (all 4, both sheets) |
| CONTROL: the n = 10 rebuild prompt + caption + " No clothing." | refuse `unclothed` | refuse `unclothed` |
| TEEN 15 (teen15b) and teen15 v1 / c / e, OLDER 70, ACCESS., the v3 child-10 template (the whole edit prompt) | ok | ok |

(n = 12 reads as minor age 10: the word "child" counts as 10 and the lowest age wins. teen15e, with "child", also reads 10.)
`gate_out.json` holds the round-2 rows (the v2 captions + every template); the v1 caption rows are in the round-1 log, all `ok` / control `refuse`.
