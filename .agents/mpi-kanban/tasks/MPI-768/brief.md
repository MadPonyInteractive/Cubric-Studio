# MPI-768 - GIF frames store and builder

Umbrella: MPI-757 (phase 1, parallel with MPI-759). Read `tasks/MPI-757/plan.md` first; its
decision table is settled. Server-side foundation every other GIF card builds on. No UI.

## The data model (decided)

- **Sidecar** stays `Media/.meta/<uuid>.json`, `type: 'image'`. `filePath` points at the BUILT `.gif`
  in `Media/`, so every surface that already plays a GIF keeps working unchanged. A new `gif` field
  holds `{ frames: [{ hash, delay }], loop, output: { maxEdge, colours, edgeColour } }` (exact
  shape is this card's call). Kind detection (MPI-759) reads it.
- **Frames** are lossless full-colour PNG (alpha kept) in a content-addressed store,
  `Media/.gif-frames/<sha256>.png`, plus a small per-frame thumbnail for the strip (MPI-769).
  Written once per unique content. Edits that only reorder, drop or retime frames write zero new
  frames; the new entry's list points at the same hashes.
- **Free on delete** (Fabio). Unlike `.preview-assets` (MPI-227: permanent, emptied only by the
  manual "Cleanup assets..." command), deleting a GIF entry or card sweeps every frame no remaining
  GIF sidecar in the project references. A separate folder, so "Cleanup assets..." never touches it.
- **Existing GIFs**: nothing runs on project open. Frames are extracted the first time a GIF opens in
  the workspace (or a tool needs them). New imports extract at import.

## Build the `.gif`

ffmpeg, two-pass palette as `routes/videoGif.js` already does. Inputs: the frame list with
per-frame delays, `maxEdge` (default 1024), colour limit, and **edge colour**: partial alpha is
blended into that colour, then alpha is cut on/off. GIF delays are in hundredths of a second;
Chromium plays a delay of 0 or 1 hundredth as 10, so the builder must never write under 2.

## Extract frames from a `.gif`

Every frame at its own delay. **Prove on real GIFs that ffmpeg/ffprobe report per-frame delays
exactly** (variable-delay GIFs included) before trusting it; record the command beside the result.

## Where things are (verified 2026-09-15)

- Content-addressed write precedent: `placeContentAsset()` `routes/projects.js:409`.
- Delete route: `DELETE /project-media/:projectId/:filename` `routes/projects.js:1127`.
- Thumbs: `extractImageThumb` `services/ffmpegThumb.js:104` (returns the path it ACTUALLY wrote).
- Output write precedent with sidecar + sequenced name: `routes/videoReverse.js`.
- `docs/project-integrity.md` for the sidecar, reconciliation and delete contracts. Update it.

## Done when

Node tests prove: build from a frame list, extraction round-trip with delays, dedup of identical
frames, the sweep deleting only unreferenced frames, and a legacy `.gif` extracting lazily.
