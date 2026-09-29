# MPI-985 Plan - Cloud models on DeepInfra (umbrella)

## Current State

- Umbrella created 2026-09-29 by the umbrella sweep, approved by Fabio. Four loose `todo` cards
  that all extend the DeepInfra cloud path shipped in MPI-849/851. Nothing is closed or merged
  here; each member keeps its own card and brief.
- **Members:**
  - **MPI-910** - Seedance 2.0 reference-to-video: reference images, videos, audio + first/last
    frame. Open question first: references are URLs or `asset://` ids, never uploads, so the app
    needs a hosting answer before any op is built.
  - **MPI-923** - Wan 3.0 reference-to-video, sibling of MPI-910. No hosting question: its `url`
    takes BASE64, so the route inlines files the way i2v already does. Two ops (reference, and
    first+last frame), because the reference types exclude `first_frame`/`last_frame`.
  - **MPI-918** - Cloud edit models inside image Flows. A new MpiNodes node calls the app's
    `/deepinfra/generate` behind the lazy `if_else` switch. Decided (Fabio 2026-09-25): Klein 9B
    cloud (new ModelDef) + Nano Banana on the one-reference Flows only. Local engine only.
  - **MPI-856** - Run Cubric Studio with no local engine. `blockedByNoEngine()` gates six call
    sites, two of them project create/open. Audit first; never lift one gate alone (brief § Do not).
- **Rules that bind every phase:** DeepInfra only, no second provider (Fabio 2026-09-25). Every
  live run costs money: state price and run count, get Fabio's yes, report the spend.

## Parallel Batch 1: answers before code (disjoint)

- [ ] **MPI-910 hosting research.** Does DeepInfra take an asset upload, or how does the app serve a
  staged file to the provider? Ownership: `.agents/mpi-kanban/tasks/MPI-910/` only. No code.
  **Verify:** a written answer with the endpoint or the serving route, read off DeepInfra's docs or
  a keyless schema call.
- [ ] **MPI-856 audit.** Enumerate every surface that assumes a running engine (brief § "The shape of
  the work", step 1; start from `tasks/MPI-849/research/findings.md` § A). Ownership:
  `.agents/mpi-kanban/tasks/MPI-856/` only. No code. **Verify:** the list names file:line for each
  gate, plus the two product questions for Fabio (project lifecycle, what the libraries show).
- [ ] **MPI-923 build.** Reference op + first/last-frame op on `wan3-cloud`. Ownership: the
  `wan3-cloud` entry in `js/data/modelConstants/models.js`, the Wan media builder in
  `routes/deepinfra.js`, its tests. **Verify:** unit test on the media list shape; one paid live
  run per op after Fabio's yes.

## Phase 2: Seedance references, then Flows (sequential - same files as MPI-923)

- [ ] **MPI-910 build**, on the hosting answer from Batch 1 and MPI-923's op shape. Ownership: the
  `seedance-2-cloud` entry in `models.js`, the Seedance builder in `routes/deepinfra.js`, tests.
- [ ] **MPI-918**: Klein 9B cloud ModelDef + price snapshot, the MpiNodes node (`/mpi-nodes-sync`:
  committed -> pushed -> pinned), then each Flow's model-slot candidates. Its own plan comes first.

## Phase 3: The no-engine user (MPI-856)

- [ ] Build from the audit and Fabio's two decisions. Ownership set by MPI-856's own plan
  (`js/services/engineGate.js`, `js/shell.js`, `js/shell/projectUI.js` at least).

## Verification

**Verify mode:** auto for shapes and gates; each paid op needs one live run on Fabio's yes.
