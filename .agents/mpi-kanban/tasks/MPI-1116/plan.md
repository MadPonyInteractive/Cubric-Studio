# MPI-1116 - 360 Panorama Flow: tile still + hero clip

Playbook: `docs/playbooks/add-flow/06-preview-image.md` (enforced by `/mpi-flow-graphics`).

## Goal

Replace the placeholder `comfy_workflows/display/flow-pano-360.webp` with a real 4/5 tile and add
the wide autoplaying hero `flow-pano-360.mp4` (`video:` on the `pano-360` entry in
`js/data/flowsRegistry.js`), before the 2.1 release announces 360 Panorama.

## Material (no GPU spent)

Session-49 bench run, picture mode: source `G:/ComfyUi/ComfyUI/input/mpi623_cartoon_village.png`
(1344x768) -> `D:/WORK/Images/Outputs/mpi623_flow/img_00001_.png` (2048x1024). The graph warps the
picture into the equirect at yaw 0, h_fov 70, then paints the rest.

## Device

What changes: frame content - one picture in, the whole 360 world painted around it.
Hero: the picture alone on the 2:1 frame (warped placement, rest dark) -> the world paints in around
it -> a slow look-around turn proves it wraps. Tile: the hero frozen mid paint-in.

## Steps

1. Build the warped-placement plate (where the picture sits in the equirect) -> verify: overlays the result.
2. Hero mp4 (1280 wide, H.264, <= 2 MB, 4-8 s, seamless) -> verify: 446 px check, ffprobe, loop seam diff.
3. Tile webp 896x1120 -> verify: 220 px beside every shipped flow tile.
4. `video:` in flowsRegistry (MPI-1101 peer holds the file - coordinate) -> verify: isolated app, 200 + byte count, hero playing.

## Verification

**Verify mode:** user-ux

## Current State

Shipped: tile + hero in `comfy_workflows/display/`, `video:` wired, Fabio approved, isolated-app
proof + npm test green (validation.md). Rebuild scripts live in the session scratchpad only -
the device is a numpy pinhole render of the pano (yaw 0 = pano centre), not ffmpeg v360.
Commit the art soon: an uncommitted `display/` file blocks a peer's sync-raw-workflows.

## Completed

- Steps 1-4 + Fabio's eye-test (2026-10-12). Done.

## Remaining Work

None.

## Plan Drift
