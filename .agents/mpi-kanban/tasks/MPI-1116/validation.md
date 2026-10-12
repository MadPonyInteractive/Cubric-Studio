# MPI-1116 validation

## Build (2026-10-12, session "3D Scene 43", no GPU, no spend)

Source: bench picture-mode run, `G:/ComfyUi/ComfyUI/input/mpi623_cartoon_village.png` (1344x768) ->
`D:/WORK/Images/Outputs/mpi623_flow/img_00001_.png` (2048x1024; graph warps the picture at yaw 0,
h_fov 70). Builder: numpy pinhole renderer (scratchpad `pinhole.py` + `build.py`, not shipped).

- Registration: pinhole view of the pano at yaw 0 / h_fov 70 vs the source picture: mean abs diff
  9.6/255 (the run repaints the picture slightly; composition identical by eye).
- Hero `comfy_workflows/display/flow-pano-360.mp4`: H.264, 1280x800, 190 frames @ 24 = 7.92 s,
  1,564,585 B (<= 2 MB), CRF 24 tune animation, faststart, no audio. Beats: world + heat outline on
  the picture -> world retracts to the picture alone on `--surface-viewer` ground -> world paints back
  out -> outline fades -> full 360 turn -> outline back, still hold. Checked at 446 px.
- Loop seam: render 0.014/255 (frame 0 vs 189); encoded 1.77 (446 px: mean 1.29, p99 6, signed mean
  -0.02 = no brightness pop; I-frame vs P-frame noise only; CRF 20/22 and an end hold did not move it).
- Tile `comfy_workflows/display/flow-pano-360.webp`: 896x1120, q90, 97,426 B; full-bleed yaw-0 view at
  h_fov 90 with the picture's rectangle in `--accent-heat` (0xFF7EB6), 8 px; outline clears the outer
  10%. Checked at 220 px with the idle filter beside the shipped flow tiles (h_fov 80 crowded the edges).

## Fabio's eye (2026-10-12)

Shown the hero at 446 px (WebM preview) and the tile in the Flow Library grid at 220 px: **"1"** (approved).

## Wired + proven (2026-10-12)

- MPI-1101 released flowsRegistry.js (reply on `7202e7f4-mpi1116-to-mpi1101`); added
  `video: 'flow-pano-360.mp4'` under `preview:` in the pano-360 entry (one-line diff).
- Isolated instance (own profile `cubric-agent-profile-7202`, port 56511; the shared agent profile
  was lock-held by a peer): `/comfy_workflows/display/flow-pano-360.webp` 200, 97,426 B;
  `.mp4` 200, 1,564,585 B - both equal on-disk sizes.
- Probe project on the Gallery -> Flows -> 360 Panorama: hero `<video>` `paused:false`, `muted`,
  `loop`, 444 px wide, 1280x800, poster `flow-pano-360.webp`, currentTime 2.44 -> 6.8 over 2 s.
  Probe project deleted (`/delete-project`, gone from the projects root); instance tree killed via
  the listener's parent; `:3000` still 200.
- `npm test`: 3260 tests, 3258 pass, 0 fail, 2 skipped.

## Shipped

- 99e027fcb pushed to master; CI run 38295536123 success (unit + desktop 1-4).
- Playbook 06-preview-image.md: 360-pano device row + encoder-only loop-seam trap.
