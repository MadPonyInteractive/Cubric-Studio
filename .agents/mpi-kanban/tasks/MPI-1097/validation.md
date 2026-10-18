# MPI-1097 validation

## 2026-10-18 live proof (Fabio's app, session "Version 2.1 readiness 8") - PASS

The exact 10-11 shape: the PREVIOUS Pod still running at app start, then a fresh create.

1. `npm start` (dev mode), new 100 GB volume g2ft7429v5 in EU-RO-1, Connect: Pod o3nogji5epy8d8 on
   `v0.27.0-dev-cu130`, RTX A4500. 12 universal nodes installed on the empty volume, engine assets
   (Describe encoder + 4 helpers) and SDXL Realistic installed onto it.
2. App killed with Ctrl+C: no `teardown` line in app.log, Pod left RUNNING.
3. `npm start nodev`, Connect at 22:57:49Z: reconnect read the saved Pod's image, stale vs
   `v0.27.0-cu130`, `Pod delete o3nogji5epy8d8 -> http 204`, boot connect `createPod -> 201`
   rlz1vk6u3q7xyq on the release image at 22:57:54Z.
4. 23:02:47Z `phase connecting -> none (by feed: Pod ready)`, then the connect edge re-sync:
   `universal nodes: 12/12 already on volume`, `engine:assets: fetching nothing; 5 on the volume`,
   model cache reseeded, hot-store staged SDXL Realistic. Model Library: SDXL Realistic installed,
   hero MODELS 1 / 24. Nothing re-downloaded.

Evidence: `%APPDATA%/Cubric Studio/logs/app.log` 22:47-23:03Z.

Seen on the way (not this card): the reconnect's GPU availability pre-check ran after the stale
verdict and read the A4500 "out of stock", most likely the stale Pod's own card. It returned
`unavailable` after deleting; auto-retry's create recovered it 3 s later. Logged on MPI-1044 § Noticed.
