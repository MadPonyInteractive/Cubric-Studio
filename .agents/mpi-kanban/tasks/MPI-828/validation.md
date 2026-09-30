# MPI-828 validation

- The code shipped before this card was filed: MPI-666 `2b0249e60` (2026-09-01) added
  `buildLicenceRows` (`js/utils/flowLicences.js`), mounted by the Flow Library drawer and by
  `MpiBaseFlow` step 0; `_licenceFieldHtml` returns `''` for an ungated flow. The card came from
  the stale playbook note, now rewritten (`docs/playbooks/add-flow/01-descriptor-and-ops.md`).
- Seen in a running app 2026-09-30 (`tasks/MPI-742/validation.md`): Extend Video with H3 picked
  shows the licence name, `Powered by MiniMax H3`, and Read the licence / Request authorization /
  Report misuse. Same fields as the Model Library's `#detail-licence-row`.
- `tests/flow-licence-surface.test.cjs` passes (in the 42/42 run).
- [x] Fabio's eyes, 2026-09-30: "Yeah, it looks good." He also opened the H3 gate himself in the pane; the instance was stopped before any install
