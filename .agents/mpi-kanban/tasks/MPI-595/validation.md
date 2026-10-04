# MPI-595 Validation

Closed 2026-10-04 on Fabio's "yes, close it now" (session "Release 2.0 blockers 51"). The gate
evidence lives inline in `checklist.md`; this records what ticked the last 14 open lines.

| Line | Evidence |
|---|---|
| 2.0 itself | v2.0.0 published 2026-10-04 (tag `741ab812d`, 6 assets, `releases/latest`); a real 1.5.0 sees the update prompt; Windows + Linux update tests passed (checklist Gate D) |
| NEW 2026-09-30 candidates | every decided item done; "the candidate list is now EMPTY" |
| Docs website + MPI-983 | MPI-983 done `250844248`: cubric.studio 2.0 live (site `0dd429b`), docs.cubric.studio (docs `f97428e`) |
| `llms.txt` for the docs site | `https://docs.cubric.studio/llms.txt` serves 200, 5,138 bytes (read 2026-10-04 22:3xZ) |
| MPI-1018 Wan 3.0 guide | done `64617fe18` on Fabio's Stage 2 render ("came out great"); two Enhance edge cases are known limits |
| A1 "2.0 ships by ~2026-11-01" | shipped 2026-10-04 |
| Every A item without a clear has a known-issue bullet | every A item cleared; the four known-issue lines went into the release body (Gate C) |
| B1 smoke | every sub-line ticked; the re-smoke passed before Fabio's yes to the cut (session fedd1e8c) |
| B3 Documents rename on the real 2.0 bundle | PASS on Linux (`~/Documents/Cubric Vision` -> `Cubric Studio`, registry rewritten) and on Windows (scratch folder renamed) |
| Changelog clean-up, Fabio's look | his look was the `/mpi-release` Gate 1 read; `release:approve` token commit `741ab812d` = the tag |
| Claude directory submission (both lines) | `.mcpb` listings are gone; the plugin route is MPI-1019, done `00d60ff83`: v0.2.1 scan passed, In review |
| After: MPI-603 + MPI-612 deletes | HANDED OFF, not done: both wait for ~2.2 (Fabio agreed). Every 1.5.0 install still lists `klein-lora-outpaint`, and a 4xx dep fails the whole Klein 4B install there. MPI-603 moves to `todo`/`deferred`; MPI-612 is already `todo` |
