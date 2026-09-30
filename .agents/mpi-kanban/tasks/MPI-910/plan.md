# MPI-910 Plan - Seedance 2.0 references, with our own short-lived video relay

Umbrella MPI-985. Facts and the hosting options: `research.md`. **Fabio 2026-09-30: option (b),
host reference videos ourselves.**

## Current State

- 2026-09-30 (Agent 77): research done, data-URL image reference proven live ($0.39). Order below
  is deliberate: the relay lands BEFORE Seedance shows any reference wells, so no video well ever
  ships that cannot deliver.
- 2026-09-30 (Agent 78, session 0697c571): **Phase 1 built and verified locally, NOT deployed, NOT
  committed** (mpi-ci has the folder untracked). `C:/AI/Mpi/mpi-ci/cubric-relay/`: `src/index.js`,
  `src/logic.js`, `test/relay.test.mjs` (12/12), `scripts/smoke.mjs` (full local e2e green, plus a
  60 MB byte-exact round trip), README with the contract and the go-live steps. **Next action:**
  commit it in mpi-ci, then Fabio's go for the README "Go live" steps 2-7 (public), then Phase 2
  privacy wording with him the same day. Phase 3 (app) can be built before the deploy against a
  local `npm run dev` relay, but must not ship until the relay is live.
- 2026-09-30 later (Agent 78): committed + pushed in mpi-ci (`718c452`, `41b0bc6`). Fabio added a
  **30-second cap** (relay reads `moov/mvhd` from the first 64 KB, so clips must be faststart; the
  app remuxes `-c copy -movflags +faststart` before upload, and still checks Seedance's own 15 s).
  **Deployed on Fabio's go**: R2 bucket `cubric-relay` + lifecycle `expire-1d` (1 day is R2's
  minimum; the 5-min sweep is the real delete), Worker live at
  `https://cubric-relay.cubric-bench.workers.dev`, live smoke + 60 MB round trip green. The Free
  plan accepted the `ratelimits` binding. **`relay.cubric.studio` NOT live**: the DNS step was
  refused by the auto-mode guard; the route sits UNCOMMITTED in `cubric-relay/wrangler.jsonc` and
  Fabio runs `npx wrangler deploy` there, then smoke it and commit `wrangler.jsonc`. Next after
  that: Phase 2 privacy wording (no app version sends to the relay yet, so the policy is not
  false today; it must be before Phase 3 ships).
- 2026-09-30 (Agent 78): **Phase 1 DONE. Relay live at `https://relay.cubric.studio`** (Fabio ran
  the domain deploy, version 6fc88bdb; live smoke green; workers.dev + preview URLs off; mpi-ci
  `a4b6ce9`). **Next action: Phase 2**, privacy wording for Fabio's sign-off (must be live before
  any app version sends clips), then Phase 3 app wiring against `relay.cubric.studio`.
- 2026-09-30 (Agent 78): Phase 2 wording in `privacy-draft.md` **SIGNED OFF by Fabio** (word for
  word; 1-day backstop left unnamed). **Publish it WITH the Phase 3 app release, not before** (it
  describes a feature users do not have yet). Its promises bind Phase 3: images + audio go inline
  to DeepInfra, the route DELETEs every clip when the call ends (success or not), clips <= 30 s.
- (Done 2026-10-01, next bullet.) Phase 3 (app wiring, below), against `https://relay.cubric.studio`. The app must
  remux each reference video `-c copy -movflags +faststart` before upload (the relay refuses a clip
  whose `moov` is after the media, 422 `MOOV_NOT_AT_START`) and enforce Seedance's own 2-15 s a
  clip / 15 s in all. Relay contract: `C:/AI/Mpi/mpi-ci/cubric-relay/README.md`.
- 2026-10-01 (Agent 79, session c149d6ff): **Phase 3 DONE, uncommitted.** `seedance-2-cloud` has
  `cloud.mediaFields` + ops `t2v/i2v/ref2v` + `audio`/`endFrame`; `routes/deepinfra.js`
  `_seedanceFields` (checks, inline images/audio, faststart + relay PUT) and `_dropClips` in the
  upstream fetch's `finally`; price tag "with video" band + 15 s ceiling; 1080p band 8.40 (was a
  flat 7.70). Tests + free live relay round trip green (`validation.md`). **Fabio 2026-10-01: no
  paid Seedance/Veo/Wan runs** - Phase 4 deferred unless he asks. **Next action:** commit (handoff
  or end-session), then Phase 2 publish (privacy page, Website repo, his yes) WITH the release that
  ships this. MPI-918 after.
- 2026-10-01 later (Agent 79): reference notation settled from the Higgsfield skills, no render
  needed: load-order `@image1`/`@video1`/`@audio1` (prompt-builder-2-5), anchor line per tag, tag
  only what is in the shot. Agent guide rewritten to it. **On Fabio's yes, the prompt box `@`
  picker now writes `@image1` for Seedance** (`capabilities.atRefTags`, `refTagHandle` in
  commandRegistry.js), `<Image 1>` for everyone else. Not eye-tested in the app yet.
- Gotchas found: workerd's R2 `range` object carries `suffix: undefined`, so `'suffix' in range`
  lies (fixed, tested); Local Explorer is the only local cron route honouring a scheduled time and
  needs `--test-scheduled`; a force-killed dev server leaves a stale registry entry that makes the
  explorer 502 (README § Develop).

## Completed

- Phase 1 code + local tests (2026-09-30, Agent 78). Evidence: `validation.md`.
- Phase 3 app wiring (2026-10-01, Agent 79). Evidence: `validation.md`.

## Plan Drift

- 2026-09-30 (Agent 78): rate limit is Cloudflare's `ratelimits` binding (10 uploads / 60 s per
  sender per location, in memory, nothing stored), not bench's salted-hash D1 counter: no D1, no
  SALT secret. Ceiling: no daily cap; D1 fallback if abused or if the Free plan refuses the binding
  at deploy (docs do not say which plans have it).
- 2026-09-30 (Agent 78): clip life is 55 min + a 5-min sweep, so "deleted within the hour" is
  literally true. URLs end `.mp4`/`.mov` (sniffed brand). `HEAD` and `Range` supported for video
  fetchers.
- Open for the Phase 4 live run: if the cubric.studio zone's bot protection challenges DeepInfra's
  fetch of `relay.cubric.studio`, Seedance fails; README step 7 says stop and tell Fabio.
- 2026-10-01 (Agent 79): Seedance takes frames as `first_frame_image`/`last_frame_image` too, so
  i2v moved off `imageField` onto `mediaFields` with ref2v (one path). The prompt box's reference
  picker writes `<Image 1>`, but `<...>` is Seedance's SOUND-EFFECT mark and ByteDance writes
  `@Image 1`: the agent guide says so; the picker is unchanged (MpiPromptBox.js, not this card).
  Enhance on a ref2v op falls back to the recipe's t2v mode (no ref2v mode), as on Wan 3.0.

## Design (the relay)

- A Cloudflare Worker `cubric-relay` in `C:/AI/Mpi/mpi-ci/cubric-relay/` - the MPI-965 precedent
  (`mpi-ci/cubric-bench/`, bench.cubric.studio): private repo, `wrangler` devDependency, deployed
  by hand from this machine, `observability` OFF, custom domain `relay.cubric.studio`.
- R2 bucket `cubric-relay` (its own, never the models bucket). `PUT /v1/clip` takes the bytes
  (MP4/MOV sniffed, <= 100 MB = the free-plan body limit; Seedance's own cap is 200 MB a video,
  15 s in all) and answers `{ url, deleteToken, expiresAt }`; `url` carries a 128-bit random id.
  `GET` streams it; `DELETE` with the token removes it. A cron deletes anything over 1 hour; an R2
  lifecycle rule (1 day, the minimum) is the backstop. No listing, no logs.
- Abuse: per-IP rate limit (hashed, as bench does), size cap, type sniff, 1 h life. Open question
  for the build: an upload needs no account, so the relay is a small public drop box for an hour.
- The app (`routes/deepinfra.js`): Seedance `ref2v` sends images + audio as data URLs, each video
  goes up to the relay first and its URL is sent; the route DELETEs every clip when the call ends,
  success or not.

## Phases

1. **Relay Worker** (`mpi-ci/cubric-relay/`): code + unit tests + `wrangler dev --local` e2e.
   **Deploy is public: Fabio's go** (and `wrangler login` if the MPI-965 login has lapsed).
2. **Privacy page**: cubric.studio/privacy/ gains the relay (what: a reference video you attach
   to a Seedance run; where: our Cloudflare storage; how long: deleted when the run ends, at most
   1 hour). Public copy: **Fabio signs it off** before it goes live, same day as the deploy.
3. **App**: `seedance-2-cloud` gains `ref2v` (+ `endFrame`: its `last_frame_image`), the route
   builds `reference_images` / `_videos` / `_audios`, price tag covers the "with video" token band
   and the reference video's input. Files: `models.js`, `routes/deepinfra.js`, `cloudExecutor.js`
   (+ `commandRegistry.js` only if a slot gate is needed - peer MPI-997 holds it 2026-09-30).
   Seedance audio rule: audio only alongside an image or video (refuse unbilled otherwise).
4. **Live**: one paid Seedance run with image + video + audio references (price stated first).

## Verification

Phase 1: `npm test` + `node scripts/smoke.mjs <local> --full` in `mpi-ci/cubric-relay/` (README § Develop).

**Verify mode:** auto for the Worker and the route shapes; user-ux for the privacy copy; each paid
run on Fabio's yes.
