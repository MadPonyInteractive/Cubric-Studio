# MPI-873 Validation

Worked as MPI-593 phase 4 (session 71db950c, 2026-09-26). Decision (Fabio): a named project
may be CLOSED.

## Automated (PASSED)

- `node --test tests/agent-target-project.test.cjs` -> 8/8: `targetProject` returns the LIVE
  open object (identity, also for the open project spelled `c:\projects\bikes`), reads a closed
  one over `/get-project` without opening it, `PROJECT_NOT_FOUND` on an unreadable one;
  `nameCard` upserts a closed card via `/project-groups` with history as id strings;
  `findProjectByFolder`; the route dispatches the LIST's spelling (`c:/projects/boats/` ->
  `C:/Projects/Boats`), no `folderPath` key without one, `PROJECT_NOT_FOUND` /
  `INVALID_FOLDER_PATH`; flowService strips `runOriginProject` from `flowInputs`.
- `node --test tests/mcp.test.cjs` -> 24/24, incl. the named-project test: references staged
  into the NAMED project while another is open, `list_cards { folderPath }`, a non-project
  folder submits nothing.
- Full suite `node --test "tests/**/*.test.cjs"` -> 1983 tests, 1982 pass, 0 fail (after
  extending the `flow-enhance-ownership` regex for the new run-only key). eslint clean on the
  four source files.

## Live (PASSED, 2026-09-26 18:57Z, Fabio's "go live")

`app:isolated` on port 59665, `APP_DOCUMENTS` = session scratch (the list came back empty, so
nothing touched his Documents; main.js's `APP_DOCUMENTS set to` log line prints the OS path,
not the effective one). Shared his ComfyUI on 48188 (queue idle before), GPU lease held, no
cancels. SDXL Realistic t2i 1:1, seed 873. Script: scratchpad `live873.mjs`, log `live873.log`.

| Step | What | On disk after |
|---|---|---|
| 1 | open A; submit naming B spelled `c:\...\mpi873 b\`, cardName "Boat in B"; open C at +1.5 s (render 18.2 s) | A 0 cards/0 media, **B 1 card "Boat in B" + t2i_001.png**, C 0 |
| 2 | no folderPath, C open | C +1 ("Plain in C") |
| 3 | folderPath = C's path UPPER-CASED, C open (the open path) | C 2 cards, 2 media |
| 4 | folderPath `...MPI873 A-nope` | `PROJECT_NOT_FOUND`, nothing ran |
| 5 | open B (groupCount 1), rename the boat card in the OPEN B | B still 1 card, "Boat in B, renamed" |

Sidecars: A 0, B 1, C 2. The isolated `app.log` has ONE `card registered in the project it
was dispatched in` (18:58:00.180Z, step 1, the closed path) and no `could not name` warning.
Step 5 proves the closed-written card is read on open and survives the renderer's own save.

## Shipped

`c016e500e` pushed to master; CI `Tests` run 36264998716 green (unit, desktop 1-4). The claim
auditor proved 23 claims (UNRELEASED bullet, this file, docs and skills), 0 findings.

Not run live: a Flow into a closed project (unit-covered: `runOriginProject` -> `_originProject`,
carried to every pass). The GIF tools are out of scope (open project only).
