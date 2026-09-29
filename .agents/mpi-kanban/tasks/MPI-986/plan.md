# MPI-986 Plan - Mix and audio (umbrella)

## Current State

- Umbrella created 2026-09-29 by the umbrella sweep, approved by Fabio. Four loose `todo` cards
  that are one audio system. Nothing is closed or merged here; each member keeps its own card.
- **Post-2.0.** MPI-917 says so outright; nothing here starts before the 2.0 release ships,
  except MPI-740 (a bug in a component already mounted in the app) if Fabio pulls it forward.
- **Members:**
  - **MPI-917** - Mix workspace: video lane, audio tracks, mixer, ffmpeg render, agent route.
    Owns the design (`tasks/MPI-917/brief.md`) and a phased plan (`tasks/MPI-917/plan.md`) -
    that plan is the spine of this umbrella; do not restate it here.
  - **MPI-740** - `MpiFader`: the wheel crawls and cannot leave the unity detent. The mixer's
    faders are this component. Fix both twins in one pass (brief § The fix). It is now mounted
    in `MpiVolumeControl` as well as the components page.
  - **MPI-920** - The gallery delete dialog warns when a card is used by reference (a Mix, a
    Flow Reuse input, a GIF, an extend source). Global, not Mix-only; deleting stays allowed.
  - **MPI-775** - YuE2 song model brainstorm (Flow, DAW widgets). Its brief says the audio
    workspace now exists as MPI-917's design, so its widgets reuse 917's components.

## Parallel Batch 1 (disjoint)

- [ ] **MPI-740 fader fix.** Ownership: `js/components/Primitives/MpiFader/**`.
  **Verify:** from 0 dB one wheel tick leaves zero on the components page and in
  `MpiVolumeControl`; a pointer drag still feels the detent; `el.destroy()` releases every
  listener.
- [ ] **MPI-917 Phase 1** (recipe + shared audio maths). Ownership per `tasks/MPI-917/plan.md`
  Phase 1: `js/data/mixRecipe.js`, `js/data/mixMath.js`, their tests.
- [ ] **MPI-775 brainstorm.** Ownership: `.agents/mpi-kanban/tasks/MPI-775/` only. No code.

## Phase 2: The rest of Mix, then the delete warning

- [ ] **MPI-917 Phases 2+** exactly as its own plan orders them (it carries its own parallel
  batch for render, primitives and preview engine).
- [ ] **MPI-920**, once Mix recipes exist to be counted. Ownership set by its own plan: the
  gallery delete dialog and one reference scan over recipes, Flow Reuse inputs, GIF sources
  and extend sources.

## Verification

**Verify mode:** user-ux for the Mix workspace and the fader; auto for the recipe maths and the
reference count.
