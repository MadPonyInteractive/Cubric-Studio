# Character Sheet (MPI-504)

> One prompt in, a three-view reference sheet out — front full-body, back full-body, and a
> head-and-shoulders portrait — with an optional **Remove Head** pass that leaves the
> wardrobe standing. Four recipe templates (Photoreal, 3D, Anime, Cartoon). No input media.

**Head removal does not GENERATE anything.** It is pure compositing — two masks and a grey
plate. If you are reading a doc, a card or a comment that says this flow inpaints, samples,
or runs `LanPaint_KSampler`, that doc is out of date; see § History below before acting on it.

**Two graphs since MPI-997.** `flow_character_sheet.json` draws the sheet only;
`flow_character_sheet_headless.json` (op `flowCharacterSheetHeadless`, no model, no FlowDef) is
the head branch below, loading the finished sheet on `Input_Image`. The FlowDef's `chain`
(`when: 'Input_Remove_Head'`, `input: 'image1'`) runs it as leg 2, landing as the sheet card's
NEXT VERSION, the untouched sheet one step back in its history. Bench: 6 s with a cold SAM3.

---

## The sheet layout is a prompt promise, and the graph depends on it

Every recipe (`Recipe_Photoreal` #666 / `Recipe_3D` #667 / `Recipe_Anime` #668 /
`Recipe_Cartoon` #669) asks for the same frame:

> *"…three views of the same character arranged side by side in one unbroken frame, the two
> full-body views on the left and the portrait on the right… The right half of the image is
> filled by a head and shoulders portrait… The left half holds two narrow full-body standing
> views of equal width, one seen from the front and one from directly behind… Plain smooth
> eighteen percent grey card seamless studio background."*

So the sheet divides into quarters:

| quarter | content |
|---|---|
| 1 (leftmost) | **front** full-body |
| 2 | **back** full-body |
| 3 + 4 (right half) | head-and-shoulders portrait |

One thing in the graph is wired to that promise and breaks silently if a recipe is ever
reworded: the head mask's crop (below).

**The left/right order lives in the FIRST sentence and must stay there** (MPI-997). Without that
clause some characters mirrored the sheet (a cyborg: portrait LEFT on every seed, Anime 4/4, Cartoon
2/2, turbo) and the head removal cut the portrait's face; with it, 8/8 right, Photoreal/3D unchanged.
Order words in the left-half sentence did not fix it; listing all three panels up front did, but
dropped a wizard's hat from the portrait on half the seeds. Flipping is no fix: [portrait|front|back]
flipped is [back|front|portrait], so the head removal cuts the back view.

**There is no longer a grey plate constant, and there must never be one again.** Until
2026-08-28 the head hole was filled with `EmptyImage` `8421504` (`0x808080`), documented
here as "matched to the recipe's eighteen percent grey card". **That match never existed.**
Measured across nine runs, the model paints its card at RGB ~176 under turbo and ~137 at 25
steps, and it moves again with the recipe wording — up to **114 levels** from the constant.
The fill is now *sampled from the sheet at generation time* (below), which is the only thing
that can track a backdrop the model chooses per run.

---

## One mask, and it is only ever about the head

### The head mask — deliberately confined to quarter 1

All ids below are in `flow_character_sheet_headless.json`; `#900` is its `Input_Image`
loader (the sheet), whose width/height outputs are `W`/`H`.

```
#774 MpiMath "a // 4" (W)  ->  #752 MpiBox(width W//4, height H, x 0, y 0)
#900 the sheet  ->  #758 MpiBoxCrop                                  (quarter 1)
    ->  #903 SAM3_Detect "face" (#902)  ->  #904 MpiMaskBbox  ->  #905 MpiFromBox
    ->  #906-#908 MpiMath: x - w, 3w, y + h + h//20  ->  #909 MpiBox (y 0)   (the head box)
    ->  #910 MpiBoxCrop(quarter 1, head box)  ->  #911 MpiFromBox            (crop + offset)
    ->  #755 SAM3_Detect  "face, hat, moustache"  ON THE HEAD CROP  (threshold 0.5, unioned)
    ->  #757 MaskComposite(add) onto #756 SolidMask(W x H) at #911's (x, y)
    ->  #854 GrowMask(expand 6, tapered)
```

SAM3 only ever sees the left quarter, and the vocabulary only the HEAD inside it: "face" alone
finds where the head is, the box runs three face-widths wide from the quarter's top to just
under the chin, and the mask is pasted back at that crop's offset. **The head mask cannot
reach quarters 2–4, nor the body below the chin, by construction.** Keep that in mind when
something looks "removed" elsewhere on the sheet — it is not this branch, and chasing it here
wastes a run.

**Why the crop (MPI-1042, 2026-10-09).** On the whole quarter "hat" took a bikini's hip bow
(Fabio's run), and cropping to the top 40% instead made "hat" take the bikini TOP. "face" alone
never misfired on five sheets (photo, 3D, anime, Krea 2, a bikini). An empty "face" result is a
zero box, and `MpiBoxCrop` passes a zero box through, so a sheet with no face found behaves as
before. The MPI-997 brooch catch ("face" taking a round clasp on the chest) still stands: such a
hit widens the head box down to the clasp and the vocabulary pass can fill it as before (the
anime sheet's round brooch was NOT taken in the 2026-10-09 runs).

**Hair stays, on purpose** (Fabio): hair often falls over the clothes, and removing it makes the
model invent hair on the new clothes. That is why the vocabulary has no "hair" and no "head" —
"head" takes most of it. Inside the crop, "hat" no longer catches hair the way it sometimes did
on the whole quarter, so a curly bob now stays round the removed face. A beard stays for the
same reason: it covers the clothes.

### The fill — sampled from the sheet, never a constant

```
#900 the sheet  ->  #887 ImageCrop(x 0, y 0, 32x32)   <- top-left corner: backdrop
                ->  #889 ImageScale(nearest-exact, W x H)
                ->  #883 ImageCompositeMasked.source
```

The crop is the colour sample. `resize_source` on `#883` would stretch any size, so the
second scale is only there to make the source sheet-sized explicitly.

**Prefer `ImageScale(area, 1, 1)` between the two** if you touch this: `area` down to 1×1 is
an exact mean (it goes straight to `torch.nn.functional.interpolate(mode='area')`), so a
contaminated corner shifts the colour slightly instead of being stretched into a visible
32×32 block. The corner had zero margin on one of the nine measured runs, so contamination
is not hypothetical.

Sampling position was chosen by measurement, not intuition. Mean error against the true
local backdrop, worst case across nine runs: constant `0x808080` **114**, top-left 32×32
**26**, the gap between the two full-body figures **16**, a mask-weighted blur fill **8.5**.
The corner wins on simplicity and is comfortably inside "close to the background"; the gap
strip needs a maths node for `W/4 − 12` and buys 10 levels.

### The switch

```
the FlowDef's chain, when: Input_Remove_Head
        on   -> leg 2: #883 ImageCompositeMasked(destination = #900 the sheet, source = the
                sample, mask = #854 the grown HEAD mask) -> #901 MpiClearVram (frees SAM3,
                ~1.9 GB, which nothing released before 2026-09-30) -> #882 Output_Image
        off  -> leg 1 only: the sheet graph's Output_Image is the sheet, UNTOUCHED
```

**The composite runs only when `Input_Remove_Head` is on, and nothing else in the flow modifies
the sheet.** With the toggle off the generated image is emitted exactly as sampled. This is the
opposite of what this file said before 2026-08-28, when an ungated composite repainted the
whole backdrop on every run — do not reintroduce that; `tests/flow-model-choice.test.cjs`
pins all three properties (head-only mask, sampled source, the gate) and is mutation-checked.
The gate was an `MpiIfElse` in one graph until MPI-997; `tests/flow-chain.test.cjs` pins it now.

---

## THE LESSON: matte what you THROW AWAY, not what you KEEP

> **History as of 2026-08-28: no subject matte in this flow any more.** Kept because it is
> correct and reusable, and its two failed designs are the likeliest to be reinvented.

The subject matte (BiRefNet, 2026-08-27 to 08-28) **shipped a defect**: a wizard's staff
vanished from the sheet, and it read as "head removal is removing the staff".

It was not the head branch. BiRefNet is a **single-salient-subject** segmenter and it was
handed a three-panel sheet; it locked onto the large right-half portrait and under-segmented
the two narrow full-body views. Anything it failed to call *subject* fell outside the keep
mask and `#851` painted `0x808080` over it — the same grey as the backdrop, so a dropped
staff did not look dropped, it looked deleted on purpose.

**Segmenting the subject is open-world.** "Keep the person" has to name every object that
should survive — a staff, a cape, a satchel — different for every character, so never a fixed
widget. The first repair (`person:3`) selected three people and dropped all three staffs.

**Segmenting the background is closed-world.** "Throw away the backdrop, keep the rest" needs
no vocabulary for props at all — anything the model fails to recognise as background survives
by default. The failure mode inverts from *silently losing content* to *keeping a bit too
much*, which is both visible and harmless on a flat grey card.

Reach for this shape whenever a mask decides what SURVIVES rather than what is edited.

**Diagnosing today:** with Remove Head *off* nothing is modified, so anything wrong there came
out of the sampler, not this flow (true only since the gate; an ungated matte once kept running).

## THE OTHER LESSON: the recipes, not the graph

Two full sessions were spent hunting a matte bug that was a **prompt** bug. Anime and
Cartoon sheets came out with the figures nearly the same tone as the card, so every edge
artefact was amplified. The cause was the word **`flat`**, used for several different
targets in one paragraph — and under Krea 2's Qwen3-VL encoder, which reads whole sentences
rather than tags, that reads as one global flatness instruction. The count predicted the
severity exactly:

| recipe | uses of `flat` | silhouette below contrast 30 |
|---|---|---|
| Photoreal | 2 | fine |
| 3D | 2 | 2.6% |
| Anime | 3 | 14.3% |
| Cartoon | 4 | 21.2% |

Rewriting Anime and Cartoon to use `flat` zero times, grouping the background into its own
sentence, and asking explicitly for tonal separation from the card took Cartoon from 21.2%
to **7.8%**. Krea 2's own research names this failure mode — *style-adjective stacking
muddies output* — in `Cubric-Prompt/dev-docs/recipe-research/krea-2/research.md` Q4. Corollaries:
- **A photometric numeral in a prompt is not a colour control.** `eighteen percent grey`
  binds only at high step counts and leaks onto the wardrobe when it does — changing it to
  `80 percent` left the card 13 levels *lighter* and turned the robes dark.
- **Turbo ignores the tail of the prompt.** Backdrop tone, layout fidelity and style clauses
  all move between 2-step and 25-step runs. Judge a recipe change at turbo, since that is
  the shipping default and the worse case.

---

## History — do not resurrect any of these

| when | head-removal recipe |
|---|---|
| MPI-354 / MPI-504 | `flux2-klein-4b-outpaint` LoRA @ 1.1 + a **green** plate (`EmptyImage` 65280) + `ImageCompositeMasked` + `SamplerCustomAdvanced`. A workaround for inpainting. |
| 2026-08-23, MPI-603 (`08dbde02`) | `LanPaint_KSampler` + `SetLatentNoiseMask` + `InpaintCropImproved`/`StitchImproved`. Live-confirmed working. |
| 2026-08-27 (`19ec571c`) | The sampler pass deleted entirely; replaced by a BiRefNet subject matte + grey plate. **Shipped the dropped-staff defect.** |
| 2026-08-28 (morning) | BiRefNet replaced by a SAM3 `background:3` matte. One fewer model in the graph — and the dropped-staff defect fixed — but the backdrop was still repainted with the constant plate. |
| 2026-08-28 | **Whole-sheet matte removed entirely.** The composite is gated on `Input_Remove_Head` and fills only the head hole, with a colour **sampled from the sheet**. Backdrop is never repainted. Anime and Cartoon recipes rewritten (see § THE OTHER LESSON). |
| **2026-09-30, MPI-997 (current)** | Same nodes, split out: the head branch is its own graph, run as the flow's chained leg 2 and landing as the card's next version. |

Two rows mislead. **LanPaint** is called current in older card records: it worked, and it is
gone. **The SAM3 `background:3` matte** was unnecessary: the card is already flat (std 2.8).

**`birefnet` is still a live dep — do not remove it.** `comfy_workflows/remove_background.json`
is a separate op that uses it; leaving this graph cost one *node*, not a model on disk.

## Related

- [scribble-to-object.md](scribble-to-object.md) — the other SAM3-adjacent flow; different
  problem (single subject, crop-and-stitch), do not copy its blend phase in here.
- [../../../models/klein/removal.md](../../../models/klein/removal.md) — the outpaint LoRA's
  characterisation, kept as history only.
