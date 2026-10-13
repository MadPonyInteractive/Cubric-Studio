# MPI-1120 Checklist

- [x] Gallery card destroy frees its promoted hover video's load (6f37b2a76)
- [x] Cause of the ~30 s landing found (2026-10-12): Fabio's profile HTTP disk cache was broken.
      Console: `GET /assets/mascot/studio/idle-3.webm net::ERR_CACHE_READ_FAILURE 304`. Every
      media/image request queued in Chromium (`_blocked_queueing` ~16 s), fetch unaffected.
      Renaming `%APPDATA%\Cubric Studio\Cache` -> `Cache.bad` (kept as evidence): instant.
- [x] Why it stays broken: a run killed mid-write (Fabio closes the dev app with Ctrl+C twice;
      users: crash, End Task) breaks the blockfile cache, and the `session.clearCache()` that
      main.js ran before every loadURL empties it without repairing it. It broke again after
      the rename, so it recurs.
- [x] Fix: main.js deletes `<sessionData>/Cache` right after the single-instance lock, before
      any window (the splash included) opens it; the clearCache call is gone. 23 ms on a 40 MB
      cache. Isolated Electron with Fabio's broken cache planted: folder rebuilt, marker gone,
      landing after MPI-623 in 261 ms. tests/http-cache-reset.test.cjs.
- [x] Fabio restarted on the new main.js (2026-10-13): landing, project cards and Cosmo load fast. CI green on 43b46b99e.
