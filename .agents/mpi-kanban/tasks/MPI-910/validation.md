# MPI-910 Validation

## Phase 1 - relay Worker, local only (2026-09-30, Agent 78)

Code: `C:/AI/Mpi/mpi-ci/cubric-relay/` (uncommitted at time of writing). Nothing deployed, nothing spent.

- `npm test` (node --test, no network): **12/12 pass** - sniff (MP4/MOV/refusals), key parsing, Content-Range
  math incl. workerd's `suffix: undefined` shape, expiry edge, PUT 201 stores bytes + type + only the token hash,
  split-chunk type bytes, 415/411/413/429 store nothing, GET/Range/HEAD, expired/unknown 404, DELETE token 403/200,
  cron sweep across list pages deletes only expired clips.
- `node scripts/smoke.mjs http://127.0.0.1:8798 --full` against `npm run dev` (wrangler 4.143.0, workerd, local
  R2 + rate limiter): **smoke passed** - 3 MB MP4 PUT 201 and GET byte-exact; Range `100-199` and suffix `-50`
  206 with the right bytes; HEAD size; MOV -> `.mov` `video/quicktime`; text -> 415; sweep now keeps a fresh clip;
  DELETE wrong token 403, right token 200 then GET 404; sweep 2 h on deletes an undeleted clip (real R2 list +
  delete); 429 after the minute's 10 uploads.
- 60 MB MP4 PUT 201 (881 ms locally), GET byte-exact, DELETE 200: the FixedLengthStream + native pipe path holds
  at realistic clip sizes.

## Phase 1 - 30-second cap + deploy (2026-09-30, Agent 78, Fabio's go)

- Cap: `npm test` **14/14** (probe v0/v1 mvhd, padding + 64-bit boxes, split header chunks, exactly 30 s stored,
  31 s / 1 h / moov-after-mdat / no moov in 64 KB -> 422, nothing stored). Real ffmpeg clips through local workerd:
  5 s faststart MP4 and 8 s MOV 201 byte-exact; plain (non-faststart) MP4 422 `MOOV_NOT_AT_START`; its
  `-c copy -movflags +faststart` remux accepted; 31 s 422 `TOO_LONG`. Local `smoke --full` passed.
- Deploy: `wrangler r2 bucket create cubric-relay`; lifecycle `expire-1d` (1 day) listed enabled;
  `wrangler deploy` -> `https://cubric-relay.cubric-bench.workers.dev`, cron `*/5 * * * *`, version
  `cf8778a8`. The Free plan accepted the `ratelimits` binding.
- Live: `node scripts/smoke.mjs https://cubric-relay.cubric-bench.workers.dev` **passed** (PUT/GET byte-exact,
  Range, HEAD, MOV, 415, TOO_LONG, MOOV_NOT_AT_START, DELETE 403/200/404). 60 MB PUT 201 (15 s upload), GET
  byte-exact, DELETE 200 then HEAD 404: no CPU-limit cut-off on the Free plan.
- Not done: `relay.cubric.studio` (DNS step refused by the auto-mode guard; Fabio's command).
- Domain (later the same evening): Fabio deployed from `cubric-relay/` (version `6fc88bdb`, `relay.cubric.studio
  (custom domain)`, cron kept). Public DNS answers (1.1.1.1); `node scripts/smoke.mjs https://relay.cubric.studio`
  **passed** (DNS pinned to 1.1.1.1 because the local ISP resolver still cached the earlier NXDOMAIN). No bot
  challenge on plain requests; whether DeepInfra's own fetch gets through is the Phase 4 live run's question.

Not verified locally, only at deploy (superseded above except the last): the Free plan accepting the `ratelimits` binding; CPU time per upload on
the real edge; the zone's bot protection letting a provider fetch the clip.
