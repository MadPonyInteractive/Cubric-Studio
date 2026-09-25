# MPI-919 validation

## Unit (2026-09-25)

`node --test tests/deepinfra-collage.test.cjs` 6/6: sheet geometry for 2 and 4 refs with each
colour in its numbered cell; contain-not-crop; output ratio = image 1's; preamble numbering;
only `referenceCollage` models get more than one `edit` slot (lite 4 yes / 5 no, Boogu 1 yes /
2 no); executor sends every path in strip order and 4 refs price the same as 1.
Full suite: 1880 tests, 1878 pass, 0 fail (1 skipped, 1 todo - MPI-867, unrelated).

## Live, paid, real `routes/deepinfra.js` + NB2 Lite (total ~$0.10)

| refs | prompt | billed | result |
|---|---|---|---|
| 4 shapes | draw every shape | $0.0339065 | all four drawn in one row: the model read every cell |
| 3 photos | tiger -> dog (img 2), kaiju (img 3) in the sea | $0.0339085 | ONE picture, 4:5 = image 1's ratio, kaiju placed; dog swap IGNORED |
| 2 photos | tiger -> dog (img 2) | $0.0339015 | dog from image 2 swapped in, 4:5, one picture; the scene was RE-DRAWN (same idea, different beach) |

Cost is flat: a sheet bills the same as one reference ($0.03388 measured single, 2026-09-20).

**Findings.** Cell numbering works (image 2 and image 3 each reached the right place). Lite
carried out one of two instructions in the 3-ref run, and it regenerates rather than edits the
scene when fed a sheet: image 1 gets only part of the model's input resolution. Untested: NB2 /
Pro on the same inputs, and a layout that gives image 1 a bigger cell.

## Layout A/B -> image 1 gets the big cell (2026-09-25, ~$0.17 more)

Same beach photo as image 1; image 2 = the dog CROPPED out of its photo (the uncropped one
has a woman in swimwear, which NB2's filter refuses). Layout "hero" = image 1 in a 1536
square on the left, the rest stacked in a 640-wide column.

| model | layout | refs | billed | result |
|---|---|---|---|---|
| lite | hero (scratch script) | 2 | $0.0339 | scene KEPT (same framing, beach, pose), clean dog swap |
| lite | hero (scratch script) | 3 | $0.0339 | BOTH instructions done (dog + kaiju); scene shifted a little |
| NB2 | hero (scratch script) | 3 | $0.0679 | best: scene kept, the right dog (face mask matches), kaiju in the sea |
| lite | hero (SHIPPED route) | 2 | $0.0339 | scene kept perfectly, but a dog-tiger HYBRID (dog front, tiger body/tail) |

Hero replaced the grid in `routes/deepinfraCollage.js`. Caveat: the grid runs used the
uncropped dog, so the dog-swap half of the comparison is not perfectly controlled; the scene
preservation difference is not plausibly explained by image 2's crop. The last row repeats the
first with the same layout and prompt: Lite is inconsistent run to run on multi-reference edits,
NB2 held up on the hardest case (one sample). Pro not run (Fabio: too expensive, NB2 passing
is the proxy).

## Not yet verified

- The prompt box itself accepting four chips on a Nano Banana model (in the app). The slot count
  is data-driven (`getAvailableCommands`, unit-tested), but no one has clicked it.
