# MPI-776 checklist

- [x] `renameGroup` in projectService + gallery repaint on `project:group-updated`
- [x] `card.rename` relay handler + `cardName` on both generate branches (agentDispatch)
- [x] `POST /connector/rename-card` + `cardName` check on generate (connector route)
- [x] Unit tests in `tests/agent-generation-relay.test.cjs`
- [x] Live check on an `app:isolated` instance: rename lands in `project.json` and on the card, negative control included
- [x] Skill family: core `cubric-vision` + generate / flows / project-files / engine
- [x] Doc sites citing the moved skill files, `docs/generation-lifecycle.md` (`docs/events.md` needed no change)
- [x] Commit: blobs for the three MPI-774-shared files, pathspec for the rest
- [x] `.claude/rules/component-events-blocks.md` (new gallery listener): asked at close-out, permission given 2026-09-16
