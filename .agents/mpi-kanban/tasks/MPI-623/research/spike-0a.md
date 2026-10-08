# Spike 0a - app-side renderer parity (GPU half)

2026-10-08, session 33 ("3D Scene 23"). RTX 4060 Ti 16 GB, Chromium (the Claude desktop browser
pane) on ANGLE Direct3D11, three 0.170.0 (the page's CDN import map), reverse depth ON.
Page: `D:\WORK\MPI-623-spike\single_shot\viewer\` (`index.html` + `app.js`, records from session 28).
Served by `D:\WORK\MPI-623-spike\single_shot\serve.py` under the GPU lease:
`python <mpi-lib>/scripts/gpu_lease.py run --timeout 600 --poll 10 -- python -u D:/WORK/MPI-623-spike/single_shot/serve.py`
(it exits when `viewer/.done` appears; held 472 s). Driven with `window.scene.parityAll()`,
`window.scene.bench(120)` / `bench(240)`, `window.scene.selfCheck()`.

## Verdict: PASS on every number gate

| check (plan § 0a Verify) | gate | measured |
|---|---|---|
| rule C hole-mask IoU vs `shots.py`, 4 cameras | >= 0.98 | window 0.9998, treetop 0.9997, floor 0.9995, behind_well 0.9996 |
| rule C mean abs colour diff on known px | <= 2/255 | 0.126, 0.129, 0.101, 0.065 |
| 1080p, all 8 layers, rule C | >= 60 fps | 2.30 ms (435 fps) over 120 frames, 1.92 ms (521 fps) over 240 |
| VRAM held by the page | a number | ~650 MiB (1522 MiB with the page open, 871 MiB once closed; 943 MiB before) |
| no spikes on the floor still by eye | eye | NOT closed here - see below |

Every row, rule A and C: `[cam, rule, IoU, mad, holes %, ref holes %, mine-only px, ref-only px, px > 30/255]`

```
window      A 1.0000 0.039  0.31  0.31   0   2   3
window      C 0.9998 0.126 84.78 84.78  19  11   6
treetop     A 0.9999 0.131  5.91  5.91  32  25 182
treetop     C 0.9997 0.129  6.48  6.48 116 126 111
floor       A 1.0000 0.100 12.24 12.24   9  13   2
floor       C 0.9995 0.101 13.19 13.16  89 315   2
behind_well A 0.9998 0.068 54.95 54.96  53  11  22
behind_well C 0.9996 0.065 61.82 61.82  83  43  18
```

Self-check at the walk's step-0 camera: pano back|stretch px 0.00% (expect < 1). Layer export
round-trip: 8 layers, 918458 verts / 1718681 faces, equal to the export's counts.

## The bug that made the first run empty

The first `parityAll()` returned 100% holes at every camera. Not parity: three 0.170 with
`reverseDepthBuffer` leaves the depth CLEAR at 1 while the test is `GEQUAL`, so no fragment
passes (depth test off -> full coverage, z 0.23-3.6). Cause in three's `WebGLState`: the clear
value is cached before `setReversed(true)` runs, and `setClear` caches the INVERTED value, so
`setClear(0)` writes `clearDepth(1)`. Workaround now in `app.js` after the renderer is made:
`setClear(0.5)` then `setClear(1)` -> `clearDepth(0)`. Those two calls ran in-page and produced
every number above; the patched file itself was not re-run end-to-end.

**For the Phase 3 port (three ^0.186.1 in the app):** 0.186 fixes the bug (`setReversed`
re-applies the clear) but RENAMES the option to `reversedDepthBuffer`. The spike's
`reverseDepthBuffer: true` is silently ignored there - no error, normal depth, and at the spike's
near plane (1e-4) the depth precision is poor. The port must pass `reversedDepthBuffer` and
assert `renderer.capabilities.reversedDepthBuffer` (the name to check in 0.186) before rendering.

## Sky-silhouette spikes (floor still)

Measured at the floor camera, shot size, rule C: widening the depth-edge flag into the sky
(`setSkyBand`) turns known silhouette pixels into holes, and never the reverse.

| band | known -> hole | hole -> known |
|---|---|---|
| 2 | 873 px (0.095%) | 0 |
| 3 | 1835 px (0.199%) | 0 |
| 4 | 2866 px (0.311%) | 0 |
| 6 | 4947 px (0.537%) | 0 |

The by-eye check on a FILLED floor still needs Klein's inpaint over those holes, which is Take
picture (Phase 3). At the browser pane's size the band 0 and band 3 holes views looked the same
to me, so the band is chosen on the filled still in Phase 3 (start at 3). The parity numbers
above are at band 0, the shots.py rule.

## VRAM and Klein

~650 MiB for the page: the 8K texture (128 MB), the 2M-vertex pano grid + index (~125 MB), the 8
layers, and float MRT targets at 1280x720 and 1920x1080. On this card with a ~0.9 GB desktop
baseline that leaves ~14.6 GB, just over Klein's ~14.5 GB-free need, so it fits with almost no
margin. Release rule for Phase 3 (plan § 0a): during Take picture the viewer drops its render
targets (cheap to rebuild) and, if the engine still reports too little free VRAM, the scene
textures too.
