# MPI-1160 validation

**Verify mode:** user-ux (Fabio's eye test).

## 2026-10-16 — automated

- Picker now packs with `buildJustifiedRows` (js/utils/justifiedLayout.js), the Gallery's packer; `object-fit: contain`; a tile with no `pixelDimensions` packs square until its img `load` / video `loadedmetadata` reports the size, then re-packs.
- `npx playwright test --config=playwright.desktop.config.js` on media-picker-cards (5, incl. new "tiles keep their picture whole"), media-picker-to-history (5), flow-swap-resets-steps, video-history-strip (4), prompt-box-voice (2), flow-pick-voice: **18/18 passed**.
- eslint MpiMediaPicker.js: clean.
- Screenshot of a mixed grid (8:5 sheets, 4:5 portraits, 16:9, a sheet with no stored size): `logs/mpi1160/picker.png` — every picture whole, names under each.

## 2026-10-16 — eye test

- Fabio, real project: PASS ("Looks great"). One note: audio tiles too wide with no waveform here, so audio now packs square; media-picker-cards + prompt-box-voice re-run 7/7.
