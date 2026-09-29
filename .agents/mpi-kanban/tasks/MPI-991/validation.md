# MPI-991 validation

**Symptom (live, 2026-09-29):** Fabio was on the open card and asked "Can you remove the glasses from the man
in the picture?". The agent gave no `[options]` buttons, picked the mask route itself, and said "Click the card
in the gallery to open it (you're already looking at it), then pick the Mask tool...".

**Root cause:** two rules each left a step to the model's judgement, and it skipped the step.
- The Masking rule gave the whole route and then said "when the App state line says they are already looking at
  the card, skip the first half". The model saw the condition (the parenthetical proves it) and said both halves anyway.
- The Route rule said "recommend one, and wait" without the Options rule's `[options]` marker. After reading
  app:masking, whose step 2 is the painting directions, it went straight there.

**Fix:** `8474e9b69`.
- The on-card App state line says it: "To paint a mask they only pick the Mask tool from the toolbar down the left:
  they are on the card, so never send them to the gallery."
- The Masking rule points at that line instead of "skip the first half".
- The Route rule ends on `[options: Mask | Whole-picture edit]`; painting directions come only after they pick Mask.
- `docs/agent/masking.md` "The flow" steps 1-2 say the same.
- The system prompt is 10,132 of 10,150 bytes.

**Evidence**
- `tests/agent-loop.test.cjs` (Route, Masking, and the on-card state line, plus its absence off the card) with
  `tests/agent-prompt-budget.test.cjs` and `tests/agent-model-params.test.cjs`: 162 pass, 0 fail.
- CI green on `8474e9b69`.
- **Live, Fabio 2026-09-29, after a restart:** same card, same question. The reply named the sunglasses, gave both
  routes, recommended the mask, and ended on the MASK / WHOLE-PICTURE EDIT buttons. No painting directions and no
  gallery step. His words: "It works now, close the card".
