# MPI-1058 validation

All on an isolated instance (`npm run app:isolated`) reading Fabio's real 76 projects, 2026-10-12.

| | before | after |
|---|---|---|
| /list-projects alone, warm | 944-1,134 ms | 15-28 ms (279 ms first call after start) |
| boot checks + list in parallel | list 980, models/check 1,030, deps 145 ms | list 144, models/check 222, deps 152 ms |
| back to landing: rows / counts / crew | 1,214 / 1,434 / 135 ms (crew cached) | 53 / 53 / 53 ms |
| back to landing: /project-stats calls | 76 | 0 |
| back to landing: mascot clips at mount | ~60 | 15 (the rest after the list) |
| reload: rows | 1,621 ms | 661 ms |

Fabio's live reload HAR before the fix: list ended 2.8 s, last mascot 3.1 s, covers 3.2 s,
everything 3.8 s. Needs his after-HAR, after a FULL restart of the app (the change is in
server.js routes; a renderer reload does not load it).

Doc text owed to docs/project-integrity.md, after the `list-projects` is cold-disk heavy
bullet (that file was held by MPI-1118 when this shipped):

> **…and cached (MPI-1058).** `routes/projectListCache.js` `projectSummary()` keeps each
> project's cover AND its `stats` (`{ count, bytes }`, the `/project-stats` project-mode
> numbers, one shared `mediaStats()`) keyed on the `Media`, `Media/.meta` and `project.json`
> mtimes, so a repeat visit is three stats per project. The landing paints `project.stats`
> and no longer calls `/project-stats` per row. Most of the old second was not the sidecars:
> the registry held `%TEMP%` itself as a parent, so every visit checked 35,022 entries for a
> `project.json`. `_readRegistryDoc()` (`routes/shared.js`) drops the OS temp folder itself on
> read; its subfolders still list.
