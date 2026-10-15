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

## 2026-10-14 ~23:00 local - NOT sockets: Chromium's low-priority load cap; holder watcher shipped
- Live held lists (21:39Z and Flows stall ~21:45Z): server saw only 3 open requests (jobs + agent streams, concat stream opened at stall start). So the socket-pool theory does not explain it.
- Fabio's HAR (~/Downloads/Landing7, 914 :3000 requests; research/harconn.py, harwin.py, hartypes.py): 105/135 media + 32/92 images queued >5 s; 0 of 507 fetch, 160 css, 20 js. Every stalled entry is `_priority: Low` with all its time in `_blocked_queueing`; on-screen images are High and fast. peek.webm waited 15 s on connection 3170 while /system/stats fetches went through 3170 every 2 s. = Chromium's per-host cap on in-flight LOW-priority (delayable) loads, not sockets.
- Holders are not in the HAR (DevTools leaves still-pending entries out). Fabio's screenshot shows mascot .webm loads "(pending)" on the landing.
- Isolated app still cannot make a holder: 3-12 hidden or visible, paused or playing mascot webms / 40 MB mp4s all finish in ms.
- Shipped main.js `[held-load]`: webRequest onSendHeaders/onResponseStarted/onCompleted/onErrorOccurred on http://127.0.0.1/*, media+image only; logs any in flight 10 s+ with `response after` (small = holder). Plumbing proven with a temporary 0 ms threshold (media + image lines appeared), reverted to 10 s; eslint clean.
- Next: Fabio full restart; at the next stall grep `[held-load]` -> the element/site that leaves its load open -> fix that site (release src when idle/hidden, or preload none).

## 2026-10-15 ~04:25 local - first holder named; watcher now reports while open
- Restart 22:00:30Z, landing stalls again (mascot clips cancelled unsent for minutes; Fabio's 2nd HAR ~/Downloads/Landing8 again excludes pending). Only ONE [held-load] line ever ended: `media in flight 15122ms, response after 8ms, net::ERR_FAILED | Qwen 2.1/Media/ref2v_003.mp4` (Chromium's ~15 s idle cancel). Console also showed ref2v_002.mp4 `download 17271ms`. The other holders never ended, so a log-on-end watcher misses them.
- Landing cards are NOT it: findRecentProjectThumbnail returns the sidecar .thumb.webp (MPI-963) when one exists. ref2v_00x comes from the opened project's view (gallery/viewer video left paused with preload=auto behind the landing?).
- main.js watcher reworked: every app-server load of ANY kind is logged once when it passes 10 s in flight (`still open`) and again on release. Isolated proof: EventSources log as `xhr ... still open`, released lines carry net::ERR_ABORTED/OK. eslint clean.
- Next: Fabio full restart, next stall -> read every `still open` line: the set of holders at that moment.

## 2026-10-15 - ROOT CAUSE reproduced and fixed (no more rounds with Fabio)
- research/repro2.cjs (isolated app, copy of Qwen 2.1 in scratch, CDP in-flight tracking): opening the project leaves `Media/Low ref2v_002.mp4` in flight ~16 s with its response in, every run. research/repro3.cjs dumps the element: the gallery card's promoted hover video (MpiGalleryGrid `_promoteVideo`), paused, preload=auto, readyState 4, networkState IDLE - yet Chromium keeps its load open until the ~15 s idle suspend. The other cards play small proxies and finish; ref2v_002 is an original (7.4 MB, 20 s). Fabio's Deepinfra HAR stall at 562 s = 17 promoted card videos at once.
- A bare paused video (research/preload.cjs, auto or metadata, with or without the currentTime=0 seek) did not hold, so the hold needs the gallery's load conditions; the fix was proven on the real gallery instead.
- Fix: MpiGalleryGrid promoted hover video and the landing card video fallback (projectUI.js) use preload='metadata'. repro2 x2: 0 holders (was 1 every run). repro3: all 4 cards still get `--hover-video-ready` (readyState 4) and play() advances to 1.44 s in 1.5 s.
- Checks: npm test 3323 pass / 0 fail; desktop gallery-media-release + gallery-renditions + gallery-gif-hover 11/11; eslint clean.
- Left as is: MpiCanvas/ComparisonManager (one video the user is about to play), utils/video.js firstFrameDataUrl (drops src in finally), mascot loops (autoplay, small). Diagnostics ([slow-load] split + held list, [held-load]) stay: always-on, cheap, they named this.
- Live proof needs Fabio's normal use: no more ~15 s picture waits after opening a video-heavy project.

## 2026-10-15 - hover plays once; a late play no longer starts a clip (Fabio's ask)
- Fabio: hover videos sometimes keep looping after the pointer left (fast mouse, a popup under the cursor). Asked for play-once on hover.
- MpiGalleryGrid: both card video sites loop=false + `ended` rewinds to frame 0. The promote-time `loadeddata` play and `_videoHoverPlay` (also called by scroll-settle) re-check `cardEl.matches(':hover')`: before, a play that landed after mouseleave ran with nothing left to stop it, and looped.
- research/hover.cjs (isolated app, Qwen 2.1 copy): hover plays, no loop; after one pass it is paused on frame 0 while still hovered; exactly one play event; a late `_hoverPlay()` with the pointer off the card stays paused. Negative control: with the hover guard removed the late-play check FAILS (plays to 0.96 s), restored = PASS.
- Desktop gallery specs 11/11, tests/gallery-*.test.cjs 34/34, eslint clean.

## 2026-10-15 ~05:50 local - gallery fix did NOT cure it; Chromium net log added
- Fabio restarted 04:22:46Z on the fixed code. Stalls continue straight after start and on the landing (no project opened): mascot clips + project .meta thumbs + Flow previews queued 15.0-16.0 s at 04:22:50, 04:24:10-04:24:58, 04:26:14-04:27:44, 04:31, 04:33, 04:35Z. Released in batches (~45 clips at 04:24:26).
- No `[held-load] still open` line except event streams (/connector/jobs, /agent, /concat, /comfy/events, /comfy/downloads), and the server held list only the 3 streams. Live netstat: 4 renderer connections to :3000 at idle. So the holder never reaches the network stack where both watchers sit: the wait is Chromium ResourceScheduler queueing.
- Suspect not proven: heroCrew.js `_warm` keeps ~60 detached paused preload=auto mascot clips alive (fired on projects:listed). research/crew.cjs (isolated app, 24 copied projects, +0 or +2 stand-in streams): landing and Flows 0 slow loads, so not reproducible in isolation; no code change on that guess.
- Shipped main.js: a source run (never packaged) records Chromium net log to <userData>/logs/netlog.json for 5 min after start. Isolated proof: 8.5 MB / 40 s, carries RESOURCE_SCHEDULER_REQUEST_STARTED + DELEGATE_INFO blocked_by=ResourceScheduler (80 short waits). research/netlog.py lists waits 3 s+ and every request alive at their start (the holders). eslint clean.
- Next: Fabio restarts once and uses the app normally; run netlog.py on %APPDATA%/Cubric Studio/logs/netlog.json.

## 2026-10-15 ~06:00 local - clean run; recorder now starts on the first slow load
- Fabio restarted 04:51:36Z, opened a video-heavy project and played every clip: 0 [slow-load] lines in 6.5 min; the startup net log (2181 app requests) has 0 waits of 3 s+. But the run before (04:22:46Z, same fix) stalled at 04:43:44-04:45:41Z, 20 min in, opening Deepinfra model tests: .meta thumbs, i2v_005/006/007 + ref2v_003 originals (re-requested in 15 s waves, status=0) and proxies, each queued ~15 s. Not cured, intermittent.
- A startup-only recording cannot catch that, so: routes/system.js /log sends `slow-load` to main over the fork IPC; main.js recordNetLogOnce() starts the net log for 4 min on the first one, once per launch, source runs only. (The 5-min startup recorder is gone; it also had a 10-min timer under a 5-min log line.)
- Proof research/trigger.cjs (isolated app): no netlog.json before; after a probe slow-load POST, one `[netlog] slow load seen` line and the file growing; a second POST starts nothing. tests/held-requests + slow-load-log 3/3, eslint clean.
- Next: at Fabio's next stall, run research/netlog.py on %APPDATA%/Cubric Studio/logs/netlog.json: the alive list at each wait names the holder.
