# MPI-1183 brief - InfiniSplat v2

Umbrella: MPI-1179 (New Models to Test), phase 4. Researched 2026-10-18 from the repo
<https://github.com/zju3dv/InfiniSplat> (`InfiniSplat_v2/` README, INSTALL, docs/inference.md,
THIRD_PARTY.md) and the Hugging Face weights <https://huggingface.co/Edisoneh/InfiniSplat-v2>.

**Bench only, and not before 2.1 ships** (Fabio, 2026-10-18). The 3D Scene works as it is, and a
newer model may solve consistency and camera placement better. Weigh it against ATAS before
picking it up (below).

## Why this one

The 3D Scene lift-back (Render path's 360 video turned back into scene layers) was tried and
dropped on 2026-10-10: `tasks/MPI-623/research/p3-lift-into-scene.md`. Each view got its own
MoGe depth guess, so surfaces doubled, edges tore and strips floated. That note says a retry needs
ONE consistent reconstruction from the path video, using its KNOWN camera poses.

InfiniSplat v2 does exactly that: a feed-forward 3D Gaussian splat (no per-scene training) from
2-32 overlapping views, with `--cameras cameras.npz` (OpenCV c2w + pixel intrinsics, "provided"
mode). Render path already gives every frame's pose (`scenePath.js` `pathFrames`), and
`faceFromPano` (in that research note) cuts perspective views out of a 360 frame.

## Facts

- Weights: one 6.6 GB `model.safetensors` + `config.json`, public, no login. Backbone is Depth
  Anything 3 **Giant** (`vitg`), pinned by commit and installed with `--no-deps`.
- Output: `scene.ply` (SH0 Gaussians) in the model's own normalised space, not our scene's units.
  It must be aligned back through the returned `cameras.npz`. Default input long side 518 px.
- Tested upstream on Linux only (Python 3.12, torch 2.7.1 cu128, one H20). VRAM is never stated.
  No gsplat, xformers or FlashAttention needed for the PLY.
- Our viewer draws depth-mesh layers, not splats, so shipping it would also need a splat renderer
  in three.js.
- v1 (single image) is NOT the candidate: perspective input only, and its checkpoint carries
  Apple Depth Pro (`apple-amlr`, research only).

## Licence

- Code: Project Registration License v1.0. Personal and research use is free. An organisation
  must fill in a free registration form before use (link in the repo LICENSE).
- Weights: DA3-Giant is **CC BY-NC 4.0**. At best this ships as a non-commercial-gated plugin,
  like Qwen-Image-2.1.

## The bench (about half a day of agent time, a few GPU minutes)

1. Install in its own venv outside the repo; record any Windows breakage.
2. Take an existing Render path video and its pose list; cut 8-24 views; write `cameras.npz`;
   run provided mode. Also try the pano's 6 cube faces alone.
3. Measure peak VRAM and time at `--long-side` 224 and 518 on the 4060 Ti (5090 if it runs out of
   memory). Every GPU run goes through the gpu_lease `run` wrapper. Never touch :3000.
4. Look at the PLY from spots off the path (splat-transform HTML or supersplat): seams, doubled
   surfaces, floaters, softness. Screenshots for Fabio's eye check.

Pass = no doubling or tearing where the dropped lift had them. Then it becomes its own card for a
non-commercial plugin that builds the scene from the rendered path. Fail = close with findings.

## Weigh against ATAS first

ATAS (<https://github.com/ziplab/ATAS>, MIT code, Pi3X weights CC BY-NC) keeps one validated world
memory across a multi-shot film, and its paper evaluates it on MiniMax-H3, which we run locally.
A scoping session ("Scope ATAS world memory on our local MiniMax-H3") was started 2026-10-18; its
write-up may make this card moot.
