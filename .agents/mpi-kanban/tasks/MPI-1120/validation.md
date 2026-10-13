# MPI-1120 validation

| check | result |
|---|---|
| Fabio's live HAR (Landing23, 2026-10-12) | every image/media request `_blocked_queueing` ~16.6 s, twice; fetch unaffected; sockets free |
| Fabio's live HAR (landing4) | on the landing for ~112 s every crew clip swap queued and was cancelled unsent |
| Console | `GET /assets/mascot/studio/idle-3.webm net::ERR_CACHE_READ_FAILURE 304 (Not Modified)` |
| Cache renamed to `Cache.bad` | landing, cards, crew instant |
| Isolated Electron, Fabio's broken cache planted, new main.js | Cache rebuilt (246 -> 229 files, marker gone), landing after MPI-623 261 ms |
| Delete cost | 23 ms on a 40 MB cache |
| Hover-video leak (6f37b2a76) | detached gallery videos still loading after leaving MPI-623: 1 -> 0 |
| Tests | tests/http-cache-reset.test.cjs, tests/gallery-card-teardown.test.cjs: 4 pass |
| CI | 43b46b99e success |
| Fabio, live app restarted on the fix (2026-10-13) | everything loads fast |
