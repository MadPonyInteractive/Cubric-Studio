# MPI-910 Plan - Seedance 2.0 references, with our own short-lived video relay

Umbrella MPI-985. Facts and the hosting options: `research.md`. **Fabio 2026-09-30: option (b),
host reference videos ourselves.**

## Current State

- 2026-09-30 (Agent 77): research done, data-URL image reference proven live ($0.39). Nothing
  built. Order below is deliberate: the relay lands BEFORE Seedance shows any reference wells, so
  no video well ever ships that cannot deliver.

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

**Verify mode:** auto for the Worker and the route shapes; user-ux for the privacy copy; each paid
run on Fabio's yes.
