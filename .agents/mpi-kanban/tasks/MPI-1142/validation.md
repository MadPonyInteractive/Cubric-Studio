# MPI-1142 findings so far (2026-10-14)

- Fabio 19:44 local: app restarted normally, project fast, then Flows tiles blank until reload. [slow-load]: every img (Qwen 2.1 .meta thumbs, Flow tiles) queued ~15.8 s, server 6-12 ms, released together. No media/video holder was logged in that window. Stall fell inside the local engine's boot (torch import, 18:44:28-51Z).
- Ruled out: idle gallery video cards (8 x 7.4 MB promoted videos held 1 connection, not 6, isolated run); landing crew (destroy drops src); Node server frozen (it logged POST /log mid-stall); Electron main busy (main frozen 5 s, img still 45 ms despite the webRequest hooks).
- Isolated repro (copy of Qwen 2.1, fresh cache, Flows) stayed fast, but E2E skips the engine boot.
- ref2v_002.mp4 is loaded on project open and held until the screen changes (the 2 h hold this morning).
- Open theory: Chromium HTTP disk-cache backend (queued includes cache lookup) stalled under engine-boot disk load; every local load already revalidates (304), so the cache saves nothing.
- 2026-10-14 ~20:00 local, Fabio (screenshots): a Flow finished (Character Sheet editor, Klein 9B + Qwen-Image 2.1) and the result showed the ORIGINAL first, then the result, then the compare view, each step late. Console [slow-load]: flowCSFI_005.png / flowCharacterSheet_034.png / .meta thumbs queued 15.9-16.8 s, mascot vision/getting-ready|working|peek.webm queued 15.0-15.2 s, server 1-10 ms. Mid-session, NOT engine boot (the engine was generating). Same ~15-16 s signature, so the boot-only angle is out; GPU/disk load during a generation is the common factor.
- Next: (a) test disabling the HTTP disk cache for the app's own origin (Fabio not yet answered; ask), and/or (b) log what is in flight when a load queues >3 s (server-side request ring, or CDP-free main-process webRequest onBeforeRequest/onCompleted bookkeeping) so the holder is named. Isolated harness scripts: scratchpad repro.cjs / holds.cjs / mainblock.cjs (session 0a622328), copy them into the card's research/ if needed.

## 2026-10-14 ~21:20 local - test shipped: HTTP disk cache OFF (Fabio said yes)
- main.js: `app.commandLine.appendSwitch('disable-http-cache')` before ready; MPI-1120's Cache-folder delete kept to clear what older runs left.
- Proof (research/nocache.cjs, isolated app, landing + Flows): switch on = 15/15 images loaded, Cache folder 0 files; control without the switch = 15/15, Cache folder 179 files / 24 MB. eslint main.js clean.
- Takes effect on a full app restart, not a renderer reload.
- Next: watch [slow-load] in Fabio's app.log across his restarts and generations. Still ~16 s queued = cache ruled out, go to (b) in-flight holder logging. Gone = keep it, close the card.

## 2026-10-14 ~20:30 local - RESULT: disk cache ruled out, switch reverted
- Fabio restarted 19:27:59Z with the switch on (proof: his %APPDATA%/Cubric Studio/Cache folder does not exist at all). At 19:29:08Z 17 .meta thumbs still queued 16.39-16.47 s (server 1-2 ms), flow-character-sheet-editor.mp4 15.05 s, peek.webm 15.03 s. Engine 'Starting server' only at 19:29:16Z.
- So the HTTP disk cache is NOT the cause. Switch reverted (main.js back to MPI-1120's delete).
- Videos queue 15.02-15.05 s EVERY time (peek.webm x6 today): a fixed timeout, not disk load. Next: split queued into before-connect / connect / after (clientLogger.js), to tell a socket-pool wait from a slow TCP connect to 127.0.0.1.
- Quit crash seen on the same restart filed as MPI-1144 (separate root cause).

## 2026-10-14 ~22:05 local - pool exhaustion proven; holders now named in the log
- Fabio's app has NOT restarted since 19:27:59Z, so no `before connect` line exists yet. Live netstat (read-only): his renderer holds 4 connections to :3000 at idle.
- research/pool.cjs (isolated app): idle app holds 3 connections (its permanent streams). +3 more held = still fast; +4 = the picture never loads (waited 8 s, stopped). Chromium's 6-per-host cap is the ceiling.
- research/vidhold.cjs: 3 VISIBLE 40 MB videos (paused or playing) held nothing. MPI-786 (js/shell/projectUI.js releaseProjectGrid) already found the holder shape: a HIDDEN paused preload=auto video holds its range request until Chromium idle-suspends it ~15 s later. That matches the fixed 15.0 s video queue.
- Shipped: routes/heldRequests.js + server.js middleware + routes/system.js: every [slow-load] line now ends `| held: <url> <n>s [open], ...` = every request the server kept open 3 s+ during that load. Test tests/held-requests.test.cjs; eslint clean.
- Proof research/heldlog.cjs: picture queued behind 4 extra streams logged `queued 4014ms (before connect 4014ms, ...) | held: /connector/jobs/stream 11s open, /agent/stream 11s open, /connector/jobs/stream?probe=1 6s x4`. A pool wait lands in `before connect`.
- Needs Fabio's FULL restart (server.js). Next slow moment: the held list names the holders -> fix those sites (likely hidden preload=auto videos) and/or fold the permanent streams into one.
