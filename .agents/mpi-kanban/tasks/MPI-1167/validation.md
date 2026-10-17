# MPI-1167 validation

Star on each Landing project row; starred rows list first, the rest keep last-opened order.

- Stored in the project-paths registry as a third per-project list, `favourites`
  (`routes/shared.js`), NOT in project.json: `/update-project` bumps `updatedAt`, so a star
  there would also reorder the recent list.
- `/list-projects` only flags `favourite`; its order stays most-recent-first because
  `/connector/projects` and MCP `list_projects` promise that. The Landing grid sorts.
- `node --test tests/project-paths-registry.test.cjs` — 6/6 pass, incl. the new star test
  (project.json byte-identical after a star; star survives a hide write; unstar clears).
- `node --test tests/documents-heal.test.cjs` — 9/9 pass (no regression; the heal carries `favourites` in code, but no test asserts that key).
- `tests/desktop/landing-project-star.spec.js` (isolated Electron, scratch Documents) — pass:
  C,B,A → star A → A,C,B, project not opened, survives grid rebuild, unstar → C,B,A.
  Screenshot checked: filled star on the starred row, outline on hover.
- Eye-tested by Fabio in his live app 2026-10-17: three starred projects at the top, the rest by last opened.
