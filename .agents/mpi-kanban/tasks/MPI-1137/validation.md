# MPI-1137 validation

- Unit: tests/slow-load-log.test.cjs 2/2 (split format, null for fast / fetch / other). Related clientLogger/init tests 81/81.
- Live, isolated Electron (own port + profile, never :3000): CDP latency 3500 ms -> 90 [slow-load] lines in its app.log, video (206) entries included, e.g. 'video 7443ms status=206: queued 3930ms, server 19ms, download 3495ms'.
- Live baseline, no throttle: 0 [slow-load] lines over ~20 s on the landing.
- Commit 0d04494a9 pushed to master.

Open: the underlying slow-after-idle load is not diagnosed; Fabio's next occurrence lands in app.log under [slow-load].
