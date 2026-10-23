# MPI-1256 validation

- 2026-10-23 run 1 (a typed Cosmo turn, local ornith:9b, krea2 tiled 2x): the page went from gallery to group-history at 11:48:06, the same second as the generate call.
- 2026-10-23 run 4 (Cosmo's generate body sent with follow, krea2 tiled 2x, local engine): the page moved to group-history at 12:06:28, and `MpiHistoryList entry dims` was logged 85 ms after `generation.submit`. The upscale job was scoped groupHistory on that card, and 39 preview frames arrived for its promptId. Screenshots run4/shots/20.png (whole-picture latent) and 50.png (people-pass tile latent) show the latents drawing in the history viewer. NOT reproduced locally.
- Fabio's run (app-20261022-124951.log): a flux3-klein 1.5x tiled upscale on the RunPod Pod (hot-store on Pod disk). Submitted 12:26:00Z, first history build 12:29:45Z, so the history view did not mount at submit and most likely did not follow. Agent conversations are kept in memory only, so whether the turn was typed, a wake or a carry cannot be recovered. Nothing in the follow path is engine-specific.
- Added: `_followWork` now logs every decision (follows to X / stays on Y / no follow). npm test: 3553 pass, 0 fail; eslint clean.
- Noticed: the status bar read LOADING MODEL 12-24% while the latents were drawing (run4 shots 20, 50).
- 2026-10-23 parked by Fabio: the Pod retry comes later. Log line committed in 159b53e4d. Next: after a Cosmo tiled upscale on the Pod from the gallery, grep app.log for 'agent job: view'.
- 2026-10-23 evening: Fabio asked Cosmo for a tiled upscale from the gallery and was taken to the history workspace. app.log 20:07:58Z: agent job: view follows to group-history; later turns stay on group-history. Local engine; the follow path is engine-agnostic. Closed on his run.
