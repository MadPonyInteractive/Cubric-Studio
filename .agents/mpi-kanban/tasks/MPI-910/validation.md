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

## Phase 3 - app wiring (2026-10-01, Agent 79, session c149d6ff)

- `node --test tests/deepinfra-seedance-refs.test.cjs` **8/8**: seedance-2-cloud shows ref2v 9/3/3 and i2v
  start+end; i2v sends `first_frame_image` + `last_frame_image` data URLs and touches no relay; ref2v sends image
  and WAV inline and the video via a relay PUT whose bytes have `moov` before `mdat` (the raw ffmpeg clip had
  `moov` at 25828, `mdat` at 40, so the remux is proven), then DELETE with `Bearer <token>`; refusals (audio alone,
  1 s clip, 8+8 s videos, `.webm`) upload nothing; a relay 429 parks nothing; **the real route DELETEs the clip on
  an upstream 500 AND on success** (DeepInfra and relay stubbed, `DEEPINFRA_API_KEY` env); quote = tokens over
  5+15 s at $4.70/M, "up to", vs 5 s at $7.70/M plain.
- `npm test` **2590 pass, 0 fail** (2592 tests). `npx eslint` on every changed file: clean.
- Live, FREE (no DeepInfra call): the route's own `_seedanceFields` + `_dropClips` against
  `https://relay.cubric.studio`: upload 201 (URL shape right), GET 200 `video/mp4` faststart, Range 206, DELETE
  then GET 404, list emptied.
- Not verified (Phase 4, paid, deferred by Fabio 2026-10-01): DeepInfra's own fetch of a relay URL (the zone's bot
  protection), Seedance's real "with video" billing, and a reference audio accepted as a data URL.
- `@` picker (Fabio's yes): `refTagHandle` test in `deepinfra-seedance-refs` (Seedance `@image1`/`@video2`/
  `@audio3`, Wan and untagged-model `<...>`, only seedance-2-cloud declares `atRefTags`); that file + mention-picker
  21/21; `npm test` **2591 pass, 0 fail**; eslint clean. Not eye-tested in the running app.
