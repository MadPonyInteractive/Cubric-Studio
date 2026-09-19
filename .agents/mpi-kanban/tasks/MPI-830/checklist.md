# MPI-830 — checklist

- [x] `routes/connectorGif.js`: the four routes, static validation, `_dispatchToRenderer`
- [x] `routes/connector.js`: export `_dispatchToRenderer` (one line)
- [x] `server.js`: mount the router
- [x] `js/shell/gifJobs.js`: the four renderer handlers, landing the card
- [x] `js/shell/agentDispatch.js`: register the handlers in `_HANDLERS`
- [x] `tests/connector-gif.test.cjs` — validation + dispatch payload per verb
- [x] `tests/connector-gif-jobs.test.cjs` — the handler module over a stubbed fetch
- [x] `.claude/skills/cubric-vision-gif/SKILL.md` + the family list in the core skill
- [x] `resources/cubric/connector-manifest.json`: the capability entry
- [x] `docs/gif.md`: a short "From an agent" section
- [x] Run the new tests + the existing GIF suites
