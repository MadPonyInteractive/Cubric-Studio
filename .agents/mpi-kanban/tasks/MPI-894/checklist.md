# MPI-894 Checklist

- [x] MPI-806 first, alone (v1 -> v2 migration; MPI-806 `done`)
- [x] GraphQL -> REST v2 for the picker catalogue (1b), then delete GraphQL
- [ ] GPU picker becomes an overlay that mimics RunPod's deploy page (1c; open decisions first)
- [ ] MPI-668 + MPI-183 together (engine parity)
- [ ] MPI-541 once a Pod is already up for 2
- [ ] MPI-349 last (written recommendation)
- [ ] Hot-store ensure outlives RunPod's ~100 s proxy cap (524 storm on connect, blocks the first gen) - fixed + unit-proven 2026-09-29 (wrapper 0.2.45 on dev); live Pod run + promote pending
- [ ] Renderer reads the saved GPU pick as the connected Pod's card (badge, VRAM filter, CPU guards, arch) - fixed + unit-proven 2026-09-29; live Pod run pending
