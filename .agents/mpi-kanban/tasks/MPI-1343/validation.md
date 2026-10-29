# MPI-1343 validation

2026-10-29, Strip Node Packs 6.

- Licences re-read: the five ported packs carry stock GPL-3 / Apache-2 / MIT text, no preamble. Painter I2V,
  Krea2-ControlNet, MiniMax H3 latent upscaler have none and stay dependencies (Fabio's 2026-10-29 rule).
- MpiNodes 4d8b87e: usdu/, cropstitch/, lanpaint/, krea2edit/, licences alongside, no banned tokens, no
  sys.path juggling, no runtime download. CPU tests vs the pinned originals: usdu 12 modes torch.equal +
  26 inputs identical; LanPaint 36 sampler runs bitwise, 130 encode/decode cases; crop/stitch 3 workflow
  settings torch.equal; krea2edit + Ostris code identical bar the renames.
- Vision 382e20a90: 272 swaps in 46 graphs, each proven equal to the JSON mutation; the five packs out of
  node_lock / nodesDeps / models.js; progressAggregator keys MpiUltimateSDUpscale. lint OK, npm test 3824/0;
  CI run 40956872632 green (unit + 4 desktop shards).
- Packs-gone CPU engine (`research/run_nopacks.sh`): 10/10 new nodes registered, no import failures, every
  shipped graph node present; the only misses were the installed Head Swap 1.1.0 copy.
- Fixed-seed GPU A/B, both packs loaded in one engine (`research/ab/`, report.txt): krea2 edit, inpaint,
  upscale, tile upscale and pano360 outputs decoded IDENTICAL (max diff 0); PNG bytes differ only by the
  embedded graph metadata.
- Head Swap 1.1.1 (Cubric-Flows c. this date): MpiInpaintCrop/Stitch, crop/stitch dep out, checks 7/7, zip
  rebuilt. Gumroad upload is Fabio's.
- Not covered: the Pod's own lock copy in mpi-ci (syncs at the Phase 3 image build).
