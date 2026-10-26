# AUDIT follow-up: the findings PR #12 left open

## Current State

- `AUDIT.md` (repo root) is the investigation. Its **Status** section lists what PR #12
  (MadPonyInteractive/Cubric-Studio#12, merged 2026-10-26) already fixed: H1, H2, X3, B1, B5, D2,
  B2, D4, B3, D5, X1, X2. Every ID below has a detail section there; read it before the step.
- No extra investigation agents: the audit already gives locations, risk and a GPU-free check
  for each item. The audit was written by reading only, so re-check each location before editing
  (line numbers will have drifted).
- Project mode: see `.agents/mpi-kanban/project-profile.md`. Lint runs `--max-warnings=0`, and
  `mpi/no-raw-event-listener` + `mpi/no-raw-console` now fire on Windows.
- Fabio's call: done in ONE session, phase by phase, `/mpi-handoff` between phases when context
  gets high. That is why there is no `## Parallel Batch`: the steps run one after another here.
- Shared tree with live peers: claim each phase's files in `files.json` before editing; a file a
  peer holds is skipped and noted, never edited.

## Completed

- [ ] Nothing yet.

## Remaining Work

## Phase 1a: small fixes (auto)

- [ ] **B4** Flow Library uninstall toast gets the MPI-1076 guard `MpiModelManager` has (no
  "uninstalled" when files were kept). **Verify:** a unit test on the counting function fails
  before, passes after.
- [ ] **B6** History toasts are destroyed like `StatusBar.notify`'s. **Verify:** read both
  paths; desktop spec or unit test proves `destroy()` runs after hide.
- [ ] **H3** `build:portable:*` scripts lose the `D:\tmp` stage dir (default inside
  `build-portable.mjs`). **Verify:** `npm run build:portable:dry-run` exits 0.
- [ ] **Missing assertions** from #12: agent-loop `generateCalledAt`/`turnReturnedAt`,
  comfy-vanished-prompt `queueCallCount`, thumb-strip `selBefore`. Add the assertion each counter
  was for, or note why none is needed. **Verify:** the three tests pass.

## Phase 1b: shared small utilities (auto)

- [ ] **D8** `escapeHtml` (string.js), `basename` (file.js), `clamp`/`clampInt` (new
  `utils/math.js`), `ORIENTATION_OPTIONS`/ratio options (ratios.js), `formatClock` everywhere,
  one `hexToRgb`. The two weaker `escapeHtml` copies (`MpiInput`, `MpiVoicePicker`) start
  escaping `'`. **Verify:** unit tests for each new helper; lint; `npm test` failing names
  unchanged.
- [ ] **D6** `graph_utils.py` beside `registry.py`; the 10 `_find_id_by_title` copies, 5
  `_prune_to_capture(s)`, 3 bake helpers use it. **Verify:** re-run `orchestrate.py`, zero byte
  diff under `comfy_workflows/` against HEAD.

## Phase 1c: dead routes and exports (auto, one question)

- [ ] **X4** un-export the internal-only exports (keep the functions), drop unused icons and the
  `seed`/`gallery` stroke special case (update `dos_and_donts.md` with permission), remove
  `/project-templates/:id`. **Ask Fabio first** about the routes the skill docs list
  (`/system/list-components`, `/logs/download`, `upload-raw`, `probe-videos`,
  `/project-data/:id/upload`, `GET /project-media/:id`). **Verify:** lint, `npm test`, grep shows
  no caller of anything removed.

## Phase 1d: types and docs (auto)

- [ ] **T1** `// @ts-check` on the pure modules listed in the audit + a scoped
  `tsc --noEmit` step in CI. **Verify:** the step passes locally and in CI.
- [ ] **T2** JSDoc on the listed central exports (`promptReuse.js`, `projectService.js`,
  `routes/shared.js` incl. the MPI-444 realpath and MPI-484 stop contracts). **Verify:** lint;
  T1 check covers the files it can.

## Phase 2: bigger de-duplication and CPU-side speed (auto)

- [ ] **D1** PromptBox slider ×17. **D3/D10** route by route, one commit each.
  **P2, P14, P7, P12, P13.** **Verify:** per item, the audit's GPU-free check.

## Phase 3: needs the desktop suite or Fabio watching (user-ux)

- [ ] **P1, P3, D7, D9.** **Verify:** desktop suite green; Fabio's eye on anything visible.

## Phase 4: needs a local profile or a Pod (user-ux)

- [ ] **P4–P6, P9–P11.** Measure before and after on this machine / a Pod. **Verify:** measured
  win recorded in `validation.md`, behaviour unchanged.

Not planned (audit marks them low value): D11, X5, T3, P8, P-misc. Pick up only if a phase
touches the same code.

## Plan Drift

- None yet.

## Verification

**Verify mode:** auto (phases 1–2); user-ux for phases 3 and 4.

Each phase ends with `npm run lint` green and `npm test` failing names unchanged, committed by
pathspec and pushed. The card closes when every phase is done or explicitly dropped by Fabio,
and `AUDIT.md`'s Status section says so.

## Preservation Notes

- Update `AUDIT.md`'s Status section at the end of every phase (what is done, what moved).
- `docs/utils.md` gains each new shared helper from D8.
- When the card closes, `AUDIT.md` itself can go (Fabio's call); durable facts move to docs.
