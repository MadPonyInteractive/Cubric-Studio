# MPI-578 Checklist - Upscale Video Flow: LTX 2.5 tile upscale + MiniMax H3

Scope and traps: `brief.md`. Bench runs take the GPU lease.

## 1. LTX 2.5 tile upscale - test (Route B)
- [ ] Fetch Refine Details + Restore IC-LoRAs and the Lightricks TiledFusion workflows; check the Refine Details model card vs the Pixel-Spatial-Upscaler
- [ ] Get the tiled workflow running on the bench (unpack the subgraph, our 2.5 model build)
- [ ] Side-by-side vs today's 2.3 Flow, same clips: AI-generated clips first, then a degraded real clip
- [ ] Record time end-to-end, peak VRAM, system RAM, tile size, output size (HD / 2x / 4K)
- [ ] Generic vs specific prompt on tiles: does the Flow need to write the prompt?
- [ ] Fabio's eye-test -> decision: REPLACE the 2.3 engine, ADD beside it, or fall back to Route A

## 2. MiniMax H3 upscale - integrate
- [ ] Flow accepts an H3 clip: H3 latent upscaler in the upsampler slot (graph from our H3 workflows)
- [ ] Keyframe trap: i2v / fl2va needs a second conditioning at the upscaled size (`MpiH3ImageToVideo`)
- [ ] Upscale dimensions: `target dimensions` mode, same number on both sides
- [ ] Flow picks the route from the source clip's model (or a field); History Upscale dropdown kept in step (same `upscale.fields`)

## 3. Ship
- [ ] Both routes run end-to-end in an isolated app, with queue row, progress and Stop
- [ ] Docs + UNRELEASED line; dev-gated with the LTX 2.5 release (MPI-1267)
