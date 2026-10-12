# MPI-1092 validation

2026-10-11:
- `node --test tests/flow-chain.test.cjs tests/flow-legs.test.cjs`: 31/31 pass, incl. the new step test (1/3 2/3 3/3 with
  every leg; 1/2 2/2 when the age leg is skipped; null for a one-job Flow).
- eslint clean on statusBar.js, flowService.js, generationService.js.
- Pending: Fabio's eye test (a chained Character Sheet run reads `<LABEL> 1/N` ... `N/N`).

2026-10-12 Fabio's eye test: PASS. Character Sheet Editor, "Nothing else" + age 55 + head removal: the status bar
read `EDITING THE SHEET 1/2` (age 55 skips the child rebuild leg, so 2 legs). "It seems to be okay." CI green on
8e316a43c (contains f3ec8cb40).
