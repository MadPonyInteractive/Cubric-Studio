# MPI-1090 validation

## Bench round 1 (2026-10-11, `research/bench/qg1.py`, outputs `G:/ComfyUi/ComfyUI/output/mpi1090/g1_*`)

Shipped graph, lock 1, Input_Reference true, Fabio's WITH-HEAD sheet (`flowCSE_010`) + his black dress reference.
Eye-read of every image (F = front body, B = back body, C = close-up):

| case | F | B | C |
|---|---|---|---|
| DN fab (shipped, no words) | black dress, right | old tube top + shorts | high neck, right |
| DN s42 | right | old top + lace skirt | unchanged (bare) |
| DN s7 | right | old top + lace bodysuit bottom | unchanged |
| E fab (+ "in the same colours" + "seen from behind") | bodysuit, apron lost, OLIVE | old top + bodysuit | right |
| E s42 | right | old top + skirt | unchanged |
| E s7 | right | old top + bodysuit | unchanged |
| W0 fab (shipped words, "G string on the back view") | bodysuit, apron lost; layout HELD | G-string, old top | unchanged |
| Wg fab (words in own sentence) | strappy bodysuit, not the dress | G-string, old top | unchanged |
| Wg s42 | right | G-string, old top | unchanged |
| Wg s7 | right | G-string, old top | unchanged |
| Wr fab ("in red") | REDRAWN AS A BACK VIEW, red leggings | red top + red trousers | unchanged |
| Wr s42 | red dress over red trousers (old trousers kept) | red skirt over trousers | unchanged |

Findings:
1. **Grey front = the headless input.** With the head on, DN's front is black on 3/3. "in the same colours" made it
   worse (olive on Fabio's seed). Dropped.
2. **Layout redraw is not only view words.** W0 on the with-head sheet held the layout; Fabio's 012 broke on the
   headless sheet (no face: front and back read alike, MPI-1089). But "in red" broke it on his seed with no view word.
3. **The old top survives on the back in 12/12: the lock, not the words.** `qg2_mask.py` rendered lock 1's mask alone:
   SAM3 "head, hair, face" takes the braids as one solid block, gaps included, so the old tube top and bare upper back
   between the braids are frozen; Klein then continues that top below the braids. Fill-holes makes no difference
   (with / without look the same). Any long-haired character hits this on the back view.
4. **Close-up neckline: 2/12 (Fabio's seed only).** The lock leaves the neck open (mask render), so this is the prompt.
5. **"G string" reaches the back in 3/3 with words in their own sentence (Wg)**, front right on 2/3.

## Bench round 2 (`qg4.py`, `g4_*`): the back lock cut at the shoulders (Fabio's go, 2026-10-11)

Patch (qg4 `shoulder_lock`): SAM3 "face" on the front body -> MpiMaskBbox -> MpiFromBox -> cut = chin + face height // 2
-> MpiBox/MpiBoxMask on the back body -> multiply into the back's SAM3 lock (only lock 1 reads it). Word lists on the
back SAM3 ("head", "head, neck", "head, hair") all still took every braid (`qg3_mask.py`), so the cut is geometric.
Mask render `g4_mask`: back lock ends at row 279 of 1120, the top of the shoulders; braids below free. All nodes are in
the pinned MpiNodes commit 665aed38 - no node release.

| case | F | B | C | layout |
|---|---|---|---|---|
| L fab / s42 / s7 (DN) | 3/3 | old top kept fab, s7; straps s42 | 1/3 | 3/3 |
| LC (all-figures close-up line) | 3/3 | fab shorts + old top; s42 beige skirt; s7 lace bodysuit | **3/3** | 3/3 |
| LW (words own sentence) | 2/3 | G-string + straps, old top GONE 3/3 | 0/3 | fab broke (front = back view) |
| LWC (LW + all-figures line) | **3/3** | **G-string + straps 3/3, old top gone** | 0/3 | **3/3** |

- The lock is what frees the back: same words on the old lock (Wg) kept the old top 3/3, on the new lock 0/3.
- With no words the back is still a guess (the reference has no back); Fabio's front+back reference sheet is the fix.
- Close-up with words: 0/6. Round 3 (`qg5.py`).

## Bench round 3 (`qg5.py`, `g5_*`): the close-up with words, shoulder lock

REF = "...reference picture, replacing all of the clothes the character wears now, top and bottom." ALL = the
all-figures line. NECK = "The close-up portrait on the right shows the top of the outfit from the reference picture,
with its neckline." Words: "G string seen from behind" x3 seeds, "in red" x2.

| shape | F | B | C neckline | layout |
|---|---|---|---|---|
| X1 = REF + words + ALL + NECK | 5/5 | G 3/3, red 0/2 (old trousers kept, red) | 5/5 | 5/5 |
| X2 = REF + ALL + words | 5/5 | 5/5 | 3/5 | 5/5 |
| **X3 = REF + ALL + words + NECK** | **5/5** | **4/5** (red on Fabio's seed kept trousers) | **5/5** | **5/5** |

## Bench round 4 (`qg6.py X3`, `g6_*`): words that PICK ("the green jacket" off MPI-1041's jacket reference)

| case | bodies | close-up |
|---|---|---|
| X3 fab / s42 / s7 | jacket on both bodies 3/3, her own trousers kept 3/3, scarf comes too 2/3 | jacket 2/3 |
| shipped splice s42 / s7 | whole outfit incl. corduroys 2/2; s42 front shorts vs back trousers | old top 2/2 |

X3 picks better than the string it replaces. Pass.

## Landed (2026-10-11, uncommitted until the commit below)

- Builder: `REF_ALL`, `REF_NECK`, `_unview` in `js/data/flowPrompts/characterSheetEditor.js`; its output equals the
  benched strings byte for byte (LC, X3 with "G string on the back view" -> "seen from behind", "in red", "the green
  jacket"; checked against `qg4.LC` / `qg5.x3`).
- Graph: the shoulder lock (raw patched by `research/bench/patch_raw.py`, converted + injection-gated for that file
  alone; the generated API equals qg4's benched graph node for node).
- `node --test tests/character-sheet-editor.test.cjs tests/inject-params-titles.test.cjs tests/flow-legs.test.cjs
  tests/flow-chain.test.cjs`: 77/77. eslint clean.
- Pending: Fabio's eye test in the app.

X3 wins. "in red" no longer breaks the layout (round 1: front redrawn as a back view on Fabio's seed).
Close-ups with words name lace / choker detail on s7 / fab that the reference lacks; neckline height is right.
