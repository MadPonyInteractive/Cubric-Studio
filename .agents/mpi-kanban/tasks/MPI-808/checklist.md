# MPI-808 Checklist

- [x] Reproduce on the bench with the real image and the real box (A: whole frame)
- [x] Falsify the two premises the card was raised on (negative x, and the box size being wrong)
- [x] Find what actually drives it (C/D/E: the box is 78% of the image width; overflow is irrelevant)
- [x] Drop `ratio: 1` from the image1 (mask) step so an edge-adjacent head can be framed tight
- [x] Bench-verify a rectangle box returns a head crop, not the frame (F)
- [ ] Refresh the two docs that carry the now-false "safe on this slot" reasoning — PROPOSED, needs approval
- [ ] Fabio's own run in the app: box a head that runs off the frame edge, confirm the crop
