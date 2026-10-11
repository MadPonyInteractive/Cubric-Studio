# MPI-1098 validation

- Fix in 74d4c224f. `node --test tests/*flow*.cjs`: 332 pass, 0 fail; eslint clean on both files.
- New test `a plugin-only flow counts its flow key, the one Install starts` (tests/flow-licence-surface.test.cjs).
- Fabio, live 2026-10-11: uninstalled 360 Panorama + Krea2, started Krea2 in the Model Library, then pressed the Flow's Install beside the bar; Krea2 kept going, the LoRAs queued, the Flow ended Ready with both rows Installed. "It worked."
- CI Tests green on 6f7e2074d (run 38171437832), which also fixed the red 04f1ff901 left in flow-library-filters.spec.js.
