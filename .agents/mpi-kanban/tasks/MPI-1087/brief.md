# MPI-1087 - Headless Front Body: one toggle on the result, on all three Character Sheet Flows

Fabio, 2026-10-11 (testing the Character Sheet Editor): there are two Headless Front Body buttons - the left-panel
field (`Input_Remove_Head` toggle, decides whether the next run chains the headless leg) and the button drawn ON the
result image (the chain toggle, `_chainToggle` in `js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js` ~3123-3222,
MPI-997), which runs the headless leg alone on the current result, or steps back to the head version. The two
history entries (with head / headless) are good and stay.

## The call (Fabio picked option A)

- **Remove the button drawn on the result image.**
- **The left-panel Headless front body button becomes the one control** and does what the image button does today:
  pressed after a run, it adds or removes the head on the CURRENT result (runs the headless leg alone, or switches
  back to the with-head entry). Before any result exists it keeps deciding whether the run removes the head.
- Same behaviour on **all three Flows that chain `flowCharacterSheetHeadless`**: Character Sheet,
  Character Sheet from Images (MPI-1042), Character Sheet Editor (MPI-1041) - `chain` entries in
  `js/data/flowsRegistry.js` (~1460, ~1620, ~1724).

## Read first

- `MpiBaseFlow.js` § the chain toggle (`_chainToggle`, `_chainBusy`, `locate()`), and how `flowLegs(flow)` picks the
  leg; `docs/` routing for MpiBaseFlow (`docs/README.md`), MPI-997's card for why the leg is a separate run.
- The Editor's newborn exception: `unless: { field: 'Input_Age', is: 0 }` - a newborn keeps its head; the toggle
  must not offer removal there.

## Verify

- UI change, user-ux: Fabio's eye test on all three Flows. Desktop spec if one already covers the result toggle.
