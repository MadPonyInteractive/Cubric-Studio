# MPI-972 validation

2026-09-29, copy-only change, 14 files, +32/-31.

## What changed

1. Klein 4B description: removal now needs an instruction naming the target ("remove the tattoo"); dropped "the only one" (Klein 9B, Krea 2 and the SDXL family inpaint too) and the four-second figure (measured on the dead empty-prompt path).
2. Agent system prompt: "built into Cubric Studio".
3. New Project hint names no folder: "the default Projects folder in your Documents". The real default is Cubric Vision OR Cubric Studio by app major AND disk state, so no fixed name is right for everyone.
4. Radial hotkey: "Gallery, Models, Flows and your latest workspace".
5. "Settings -> Remote -> Language Models" -> "Remote -> Language Models" at ALL 11 sites, not the 2 the card named: cloudExecutor x2, MpiModelManager x2, llmService (toast hint), agentLoop x4 (three errors + Cosmo's own Looking rule), routes/llm x2; plus the test asserting it and docs/toasts.md quoting it.
6. Video fullscreen tooltip: "(F)" dropped. No key was bound; binding one is a feature, not this card.

Internal: add-flow README + flowsRegistry header no longer say dev-gated (MPI-589); generationService header says three lanes (MPI-851).

Left as is: js/data/releaseNotes.js:259 (1.x release note, history) and docs/archive/.

## Evidence

- grep for every old phrasing across js/ services/ routes/ tests/ docs/playbooks/add-flow: only releaseNotes.js:259 (history, kept).
- `node --test tests/llm-service.test.cjs`: 30/30 pass.
- `node --check` clean on all 12 edited JS/MJS/CJS files.

## Not in this card

The 1.x -> 2.0 update-path answer the docs Installation page waits on is decided at the 2.0 cut (MPI-708 D1, MPI-595 gates), not here.

## CI

- fdb8bedf8 went RED: tests/cloud-executor.test.cjs asserted the old /Settings/ copy for NO_KEY. Fixed in 5b8fa0999 (asserts Remote -> Language Models, and that Settings is gone), pushed with --no-verify as the red-master fix.
- Local `npm test`: 2215 pass, 0 fail.
- CI run 36501143917 on 5b8fa0999: success.

## Reopened 2026-09-29: the owed update-path question

Fabio: 2.0 updates in place from 1.5.0 (124 full + 43 in-app-update downloads on v1.5.0; the re-cut 1.5.0 carries the widened updater, checked on the tag: `win-update.cjs` ASSET_PATTERN and `linux/update.sh` match `Cubric(Vision|Studio)`, `apply-update.cjs` accepts `cubric.studio`). No legacy `CubricVision-*` set at 2.0 (option B); pre-1.5.0 installs download 2.0 fresh.

- The build already names only `CubricStudio-*` (`scripts/build-portable.mjs` updateArchiveName), so no code change.
- `docs/releases/portable-distribution-contract.md` + `github-release-checklist.md` rewritten to say so.
- MPI-951 brief: legacy-name drop is moot; old exe + mpi-ci slug remain.
- Messages: Docs MPI-19 (Installation TODO answered), MPI-595 owner (drop its dual-publish checklist item; its folder is a live peer claim).
