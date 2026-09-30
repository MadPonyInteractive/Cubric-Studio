# MPI-910 Checklist

Plan: `plan.md`. Umbrella MPI-985.

- [x] Phase 1: relay Worker `mpi-ci/cubric-relay/` - PUT/GET/DELETE clip on R2, 1 h life, cron sweep, MP4/MOV sniff, 100 MB cap, per-IP rate limit, observability off
- [x] Phase 1: unit tests (`npm test`) and `wrangler dev --local` e2e smoke pass. NO deploy
- [x] Phase 1: commit `cubric-relay/` in mpi-ci (`718c452`; 30 s cap `41b0bc6`)
- [x] Phase 1 deploy: Fabio's go (public), R2 bucket + lifecycle rule, Worker on workers.dev, live smoke green
- [x] Phase 1 domain: `relay.cubric.studio` live (Fabio's deploy), live smoke green, `wrangler.jsonc` committed (`a4b6ce9`)
- [x] Phase 2: privacy wording drafted and signed off by Fabio (`privacy-draft.md`, 2026-09-30)
- [ ] Phase 2 publish: apply `privacy-draft.md` to the Website repo and push (Fabio's yes) WITH the Phase 3 app release
- [x] Phase 3: `seedance-2-cloud` gains `ref2v` + `endFrame`; route sends images/audio as data URLs, videos via the relay, deletes every clip when the call ends
- [x] Phase 3: price tag uses the "with video" band + 15 s reference ceiling; 1080p band fixed (8.40, was 7.70)
- [x] Phase 3: docs (`docs/cloud-generation.md`, agent guide `docs/agent/models/seedance-2.0.md`), op help made model-neutral
- [ ] Phase 4: one paid live run with image + video + audio references (price stated first). **Deferred by Fabio 2026-10-01** ("very expensive"): only if he asks
