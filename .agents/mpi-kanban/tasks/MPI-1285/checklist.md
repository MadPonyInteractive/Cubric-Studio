# MPI-1285 checklist

- [x] Graph: Input_Fast_Motion routing (modes 0-3) + sol-attn in raw r2va, synced, runtime checked
- [x] safe_math sweep: every tier x ratio x switch state on the runtime expressions
- [x] App: h3FastMotion toggle (ref2va only), preview gate, one-pass bar count
- [x] Agents: fastMotion named param (generationControls, connector, MCP, Cosmo tool, dispatch, routines)
- [x] Cosmo rule in docs/agent/models/minimax-h3.md; docs/models/h3/fast-motion.md
- [x] Tests + lint green
- [x] sol-attn on MiniMax H3 (fl2va) stage 1, same settings, EasyCache kept, test pinned
- [x] GPU runs of the r2va graph: Fabio in the app, 2026-10-25, every mode he tried (validation.md)
- [ ] GPU run of MiniMax H3 (fl2va) with sol-attn: Fabio, against the 3m 28s baseline
- [ ] Superman re-run through Cosmo: Cosmo sets Fast Motion on by itself (the only item left)
