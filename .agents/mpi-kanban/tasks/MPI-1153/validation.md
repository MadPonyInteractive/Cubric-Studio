# MPI-1153 Validation

## Why undoing MPI-997's split is safe

MPI-997 (2026-09-30) made the head removal a second run so the toggle could make it on demand.
MPI-1087 then ran that leg on EVERY run, so the split only cost a second prompt and queue trip.
The Sheet Editor already does it in-graph (MPI-1086). The reason no longer holds.

## Checks (2026-10-16)

- `research/patch_raw_versions.py` patched raw + runtime JSON; `scripts/workflow-to-api.mjs` on
  both raws (against the live engine's /object_info) gives JSON identical to the patched runtime files.
- `scripts/validate-injection-rules.mjs`: both graphs conform.
- `npm test`: 3330 pass, 0 fail. Desktop `flow-chain-toggle.spec.js`: 2/2 (chained + `inGraph` leg).
- Isolated app (`app:isolated`, under `gpu_lease.py`), `research/drive.py`, probe project deleted after:
  - Character Sheet, Headless OFF, turbo 1K: 48 s, ONE card, versions
    `[flowCharacterSheet, flowCharacterSheetHeadless]`, selectedIndex 0 (sheet shown). Head removed
    cleanly on the front body only.
  - Character Sheet from Images, default (ON): 89 s, ONE card, versions
    `[flowCharacterSheetImages, flowCharacterSheetHeadless]`, selectedIndex 1 (headless shown).
  - Sheet Editor, None + Age 10 (rebuild leg runs the from-images graph with `Input_Headless: false`):
    versions `[flowCharacterSheetEdit, flowCharacterSheetImages, flowCharacterSheetHeadless]`, the
    rebuild landed ONE version and leg 4 removed the head from the rebuilt child sheet.
