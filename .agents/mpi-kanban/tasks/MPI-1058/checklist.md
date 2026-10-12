# MPI-1058 checklist

Measured 2026-10-12 (Fabio's reload HAR + an isolated instance): no single slow request. The
landing was ~3.8 s of contention: 4 permanent EventSources leave 2 of Chromium's 6 connections,
and through them went ~400 boot modules, /list-projects (~1 s), 3 boot checks competing for the
same event loop, 65 mascot clips (3 ms each, queued up to 1.4 s) and 76 per-row /project-stats
calls. 3D work is not implicated.

The ~1 s of /list-projects was mostly NOT the sidecar scan: a CPU profile put it in the
per-entry loop, and the registry held %TEMP% itself as a projects parent (35,022 entries).

- [x] 1. /list-projects: cover + asset stats cached on the Media, Media/.meta and project.json
      mtimes (routes/projectListCache.js) and returned as `stats`; the landing drops its 76
      /project-stats calls; the registry reader drops the OS temp folder itself (61e0060f7)
- [x] 2. Landing crew warms only the idle clips at mount; the others on projects:listed (ff85d5d9f)
- [x] 3. Boot checks: alone 10-110 ms; they were slow only beside the list. No code of their own.
- [x] Tests: tests/list-projects-cache.test.cjs, tests/project-paths-registry.test.cjs (temp root);
      full suite 3267 pass, 0 fail
- [x] Re-measured on an isolated instance (see validation.md)
- [x] Fabio's after-HAR (Landing2, restarted app): /list-projects wait 26 ms (was 865), ends 1.05 s (was 2.8 s), 0 /project-stats calls, whole landing 2.18 s (was 3.8 s)
- [x] Docs: mascot-placement.md
- [x] Docs: project-integrity.md list-projects note (pasted by MPI-1118, cd6577547)
- Not in scope: merging the 4 EventSources into one (separate card, touches every live feed)
