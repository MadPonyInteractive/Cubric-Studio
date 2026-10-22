# MPI-1244 - Local downloads: reconnect a stream that crawls far below its own peak

**Parked 2026-10-22, nothing built.** Reassess after a peer's R2 upload finishes (Fabio's call).

## What triggered it
The drawer row "Chroma Hyper" read 42 MB/s, then 3.2, then 0.6-1 MB/s at about 88%.

## What the evidence showed (2026-10-22, ~04:00-05:05 UTC)
- The Chroma Hyper weight (R2) had already FINISHED at 03:41 UTC at its full 9,201,358,732 bytes. The row is the
  model's aggregate. The only dep still moving was `controlnet-union-flux`, pulled from huggingface.co
  (licence bars an R2 mirror, `assetDeps.js` comment), and the log flagged it at 64 KB/s at 03:38.
- R2 Range reads of the same object at offsets 0, 8.2 GB and 9 GB ran at 32-43 MB/s on fresh connections.
- An app restart (a fresh connection) resumed the slow dep at about 2 MB/s, so a reconnect would not have helped it.
- Fabio then found a peer agent uploading to R2 from this machine. A saturated uplink slows every download
  (ACKs queue behind the upload), so it may explain the whole episode. Not measured.

## Prior art: read before building
- `02ef2c0` (2026-06-25) built reconnect-on-crawl. `a780e0a` disabled it 32 min later: the pause->resumeFromFile
  on the SAME NDH instance raced the live socket (ERR_STREAM_WRITE_AFTER_END killed the server), and the
  peak baseline read 6554 MB/s. "zero saves, one server-kill". `c7313dff` (MPI-258) deleted it.
- A safe shape, if ever needed: reuse the forceStall path (await `stop()`, `_rearm()`, `download()`), which
  already carries the MPI-718 stale-handler guard, the MPI-764 cancel-wins guard and the `_activeDownloaders`
  slot. Trigger only below BOTH 15% of the stream's own peak AND 5 MB/s for 60 s; skip the first progress tick
  after a resume (NDH reports the whole partial as one second of speed); cap 2 per dep; own log line; no
  retry budget spent. Local only by construction: Pod deps never create a FileDownloader (`_startPendingDeps`
  filters `engine !== 'remote'`).
- Test risk: `tests/download-retry.test.cjs` `testSlowStreamWarn` (exactly one WARN, throttled server ignores Range).

## Open UI question (Fabio's call)
The row shows the model name while a different file, from a different origin, is the slow one. Naming the
active file and its host in the row would have shortcut this diagnosis.
