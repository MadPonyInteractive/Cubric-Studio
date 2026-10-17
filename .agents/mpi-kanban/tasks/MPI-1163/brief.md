# MPI-1163 - Mirror failover on a stall or timeout

## Problem

MPI-427/429 fail a model download over to the Hugging Face mirror only when the error
matches `_TRANSPORT_ERROR_PATTERNS` (DNS, refused, reset, TLS interception). A stream from
models.cubric.studio that STALLS (MPI-291 watchdog, `forceStall()`) or TIMES OUT (NDH
`timeout:30000` emits `timeout`, not `error`, so the watchdog is what catches it) matches no
pattern. It spends the MPI-460 same-url retry budget (3 attempts without progress) and goes
`failed`. With zero bytes landed it goes `failed` at once. Hugging Face is never tried.

Context: GitHub issue MadPonyInteractive/Cubric-Studio#8 (fresh 2.0.1 install froze at
994 MB / 2.9 GB on the engine-asset download). This gap is a plausible contributor, NOT a
proven cause; the tester's app.log is pending.

## Decision

1. **When**: the mirror is tried at the point the dep would otherwise go `failed`, i.e.
   AFTER the same-url budget is spent (or at once when there is no progress to defend).
   Not before. A CDN blip that clears in seconds still resumes from the origin we chose;
   the mirror is the last route, not the first reflex. Transport errors keep their
   existing immediate failover (MPI-427: a route that never delivered a byte is not worth
   22 s of retries).
2. **Which errors**: route failures only - the stall/timeout (tagged by `forceStall()`) and
   an HTTP 5xx from the origin. Not a 4xx (fails the same on every mirror), not a local
   error (disk full, permission), which a second origin cannot fix.
3. **Budget**: the mirror gets its own fresh same-url retry budget; the walk is bounded by
   the mirror list (`_triedUrls`).
4. **Partial**: kept. Same localPath; the marker carries sha256, so `_shouldResumePartial`
   resumes it on the mirror (MPI-317/429 contract, unchanged).
5. **Crawl (slow-but-alive, MPI-716) does NOT fail over.** The 1 MB/s floor is per dep;
   with several deps streaming in parallel a healthy 30 Mbit line trips it on every dep, so a
   failover keyed on it would move modest connections off R2 for no gain, and a line that is
   slow to both origins gains nothing. MPI-716 keeps it a log-only observer. A crawl that
   collapses to zero becomes a stall and is covered by 1.

## Mirror coverage

See validation.md for the per-weight check of the engine-asset deps on the HF mirror.
