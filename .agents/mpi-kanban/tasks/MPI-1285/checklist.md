# MPI-1285 checklist

- [x] Graph: Input_Fast_Motion routing (modes 0-3) + sol-attn in raw r2va, synced, runtime checked
- [x] safe_math sweep: every tier x ratio x switch state on the runtime expressions
- [x] App: h3FastMotion toggle (ref2va only), preview gate, one-pass bar count
- [x] Agents: fastMotion named param (generationControls, connector, MCP, Cosmo tool, dispatch, routines)
- [x] Cosmo rule in docs/agent/models/minimax-h3.md; docs/models/h3/fast-motion.md
- [x] Tests + lint green
- [x] sol-attn on MiniMax H3 (fl2va) stage 1, same settings, EasyCache kept, test pinned
- [ ] GPU smoke: not run by me (Fabio's engine is his live session); his in-app run is the first
- [ ] Fabio's in-app Superman re-run
