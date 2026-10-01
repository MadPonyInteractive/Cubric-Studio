# MPI-894 Checklist

- [x] MPI-806 first, alone (v1 -> v2 migration; MPI-806 `done`)
- [x] GraphQL -> REST v2 for the picker catalogue (1b), then delete GraphQL
- [x] GPU picker becomes an overlay that mimics RunPod's deploy page (1c) - Fabio's look 2026-09-29: colours + Refresh okay
- [x] A data center with no volume connects as an ephemeral Pod after a confirm (1c follow-up, Fabio 2026-09-29) - Fabio's "1" on the popup in his app
- [x] MPI-668 closed 2026-10-01 (`d6bfdf2f4`, Agent 86). MPI-183 OUT of 2.0 (Fabio 2026-10-01)
- [ ] MPI-541 once a Pod is already up for 2 - OUT of 2.0 (Fabio 2026-10-01), after 2.0
- [ ] MPI-349 last (written recommendation) - OUT of 2.0 (Fabio 2026-10-01), after 2.0
- [x] Hot-store ensure outlives RunPod's ~100 s proxy cap (524 storm on connect, blocks the first gen) - fixed + unit-proven 2026-09-29 (wrapper 0.2.45 on dev); LIVE-PROVEN 2026-09-29 on a 5090 Pod (session 8feae052, validation.md). `promote` is an MPI-595 Gate D cut step
- [x] Renderer reads the saved GPU pick as the connected Pod's card (badge, VRAM filter, CPU guards, arch) - fixed + unit-proven 2026-09-29; LIVE-PROVEN in the same 5090 run
- [x] System-RAM floor defaults to 0 = auto (Fabio 2026-10-01: new users on low-end cards hit a RAM toast they cannot act on; the floor is an advanced setting) - `js/core/storage.js`, session ff52b7be. Saved 62/80 floors are NOT migrated (Fabio 2026-10-02: a user who set it may have set it on purpose)
