# MPI-787 validation

## Harness

Real `MpiCanvas` mounted in a bare page, driven in the repo's own Electron (41.x), window
parked off-screen, one synthetic `mousemove` per animation frame (Chromium delivers real
mouse moves at that rate), brush 300 image px, synthetic 2960x2960 image — the tester's size.
`app.disableHardwareAcceleration()` reproduces a box whose Chromium draws 2D canvas on the CPU.
Older trees were served straight from git objects (`git show <sha>:<path>`), so every row ran
the same harness. Harness lived in the session scratchpad; not committed.

## Frame rate (mean of 3 x 3 s strokes, display caps at ~75)

| tree | accel OFF fps | median frame | JS / move | accel ON fps |
|---|---|---|---|---|
| efc2cc29 (MPI-214 fix) | 27.1 | 40 ms | 4.0 ms | 75.1 |
| 992a11c0 (1.6.1 as shipped) | 23.5 | 40 ms (p90 53) | 11.9 ms | 75.2 |
| this change | **74.6** | **13.3 ms** | 4.4 ms | 75.2 |

Component costs on 1.6.1, accel OFF: skipping the empty paint layer alone = 24.1 fps, JS back
to 5.1 ms; skipping the base redraw alone = 22.1 fps; not redrawing the overlay at all = 69.6 fps.
The full-frame overlay was the floor; the paint layer was the part that regressed after MPI-214.

## Pixel equality — clipped stroke frame vs a full `draw()` of the same state

Seven scenarios (mask, inverted, B/W, grid, auto picks + inverted, paint, composite), each also
asserting the stroke changed the overlay and that a hover still moves the ring.

- 1400x1400 (layers at 1:1): **6 of 7 bit-exact**; grid differs by <= 3/255 on dashed lines.
- 2960x2960 (mask upscaled 1536 -> 2960): 56-555 bytes differ, <= 12/255 alpha, on antialiased
  edges only. Unchanged by padding the box +4 or +8 and by clipping the full draw too, so it is
  the resampler's step origin, not a coverage gap. `mouseup` already runs a full `draw()`.
- Negative controls, same harness: `drawStroke` sabotaged to skip the overlay -> millions of
  bytes differ in every scenario; box padding cut to `reach - 3` -> 3.9k-22k bytes differ.

## Suites

- `node --test` on the 9 canvas/mask unit files: 114 pass, 0 fail.
- Desktop: `history-modes`, `mask-persist-roundtrip` (4 pass), `gif-cutout` (4 pass).
- `eslint js/components/Primitives/MpiCanvas/`: exit 0.

## Not verified here

The tester's own box. Their GPU and Chromium's canvas backend there are unknown; the accel-OFF
rows are the worst case, and accel-ON did not move. Confirm on the next hand-delivered build.
