# MPI-1058 checklist

Measured 2026-10-12 (Fabio's reload HAR + an isolated instance): no single slow request. The
landing is ~3.8 s of contention: 4 permanent EventSources leave 2 of Chromium's 6 connections,
and through them go ~400 boot modules, /list-projects (~1 s: reads every sidecar of every
project, 2,234 files / 17 MB, to pick 76 covers), 3 boot checks competing for the same event
loop, 65 mascot clips (3 ms each, queued up to 1.4 s) and 76 per-row /project-stats calls.
3D work is not implicated.

- [ ] 1. /list-projects caches each project's cover + asset stats (keyed on the Media and
      .meta dir mtimes) and returns the stats, so the landing drops its 76 /project-stats calls
- [ ] 2. Landing crew warms only the idle clips at mount; the other clips warm once the project
      list is in
- [ ] 3. Boot checks: measure each alone after 1+2; fix only what is still slow on its own
- [ ] Tests for the cache (hit, invalidation on a new sidecar / media file)
- [ ] Re-measure a reload in an isolated instance; Fabio re-records a HAR
- [ ] Docs: the subsystem doc for the landing list + mascot-placement.md
- Not in scope: merging the 4 EventSources into one (separate card, touches every live feed)
