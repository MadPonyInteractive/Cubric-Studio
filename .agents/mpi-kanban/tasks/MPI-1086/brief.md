# MPI-1086 - Character Sheet Editor: a Reference picture for Hairstyle and Accessories, and the fringe fix

Fabio, 2026-10-11, after passing MPI-1041's Clothes reference: "I guess you didn't realise that the optional image
is for everything, not just for clothes." Hairstyle with a reference and no words refused ("Say what to change
first.") - that is the shipped Clothes-only design (`REF_THING` in `js/data/flowPrompts/characterSheetEditor.js`),
never made visible: the slot is labelled just "Reference picture (optional)". This card opens it to the other changes,
for the release - not a later version.

## Order (Fabio)

1. **Hairstyle first** - with a reference picture and with words. "If the reference image for the haircut can be
   used, the user already has most of the job done. He just needs to find a haircut he likes on the internet."
2. **Accessories** - "the biggest challenge": earrings, face piercings, tattoos, weapons, backpacks, bandanas.
   Up for debate: split it (tattoos / weapons / worn accessories as separate changes) or keep one. Bench first,
   then bring Fabio the call with evidence.

## What MPI-1041 already proved (validation.md § F2 rounds 1-8 - read before benching)

- Rounds 1-2: a hat or haircut from a PHOTO reached all three panels 1 time in 8; naming the back view with a
  reference drew the reference person as an extra figure. That is why it went Clothes-only.
- Rounds 4-8: a CUT-OUT (no person) does not break the layout; the old thing must be removed in words or Klein
  keeps it; naming the details ("the same neckline and straps") stops the close-up drifting back in late steps.
- Fabio's test reference for hair is a face PHOTO (`Qwen 2.1` project, curly blonde buns) - the risky case. Bench
  both a photo and a cropped hair-only picture.
- Bench tools: `.agents/mpi-kanban/tasks/MPI-1041/research/bench-tools/phaseF/` (`qf2.py` runner, `qf2e.stage()`,
  `qf2j.py` the latest shape). GPU only under `gpu_lease.py run`; tell Fabio first.

## Fabio's hairstyle tests, words only (2026-10-11, his sheet `flowCSFI_002`)

- "Black and pink Bobcut" - front stayed brown, back + close-up pink. **Fabio: NOT a fail** - users read the
  result and reword ("highlights", "gradient").
- "Black and pink Bobcut with Fringe" - colours consistent; **the fringe never appeared: the one real fail.**
- "Two thick large Viking braids" - pass.
- "Blonde French braids" - unsure; the back view's braids end in dark tips (old hair left).

## Also in this card

- **"Nothing else"** (the What-to-change option `none`, `flowsRegistry.js` ~1747, "Only the age below changes"):
  Fabio wants it renamed - "Custom", or two options "Custom" (a free edit in words) and "None" (no change
  prompt, age only). Product call to confirm with him; small.
- The slot label/description must say which changes use the picture, whatever this card ends with.

## Not this card

- The hairstyle picker (styles by picture, colour pickers): MPI-1088, a later version.
- Headless Front Body toggle: MPI-1087.
