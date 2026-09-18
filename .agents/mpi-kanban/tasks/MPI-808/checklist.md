# MPI-808 Checklist

- [x] Reproduce on the bench with the real image and the real box (A: whole frame)
- [x] Falsify the two premises the card was raised on (negative x, and the box size being wrong)
- [x] Find what actually drives it (C/D/E: the box is 78% of the image width; overflow is irrelevant)
- [x] Drop `ratio: 1` from the image1 (mask) step so an edge-adjacent head can be framed tight
- [x] Bench-verify a rectangle box returns a head crop, not the frame (F)
- [x] Fabio's app run showed part 1 alone was NOT enough — the baked 1:1 crop target still widened it
- [x] Graph: Box Size reads MpiBoxMask's CLAMPED box, not the raw MpiBox
- [x] Graph: output_target_width/height follow the box aspect at a constant ~1 MP
- [x] Graph: context_from_mask_extend_factor 1.1 -> 1.0 (Fabio's call)
- [x] raw -> API sync run against the engine (48188); injection rules pass
- [x] Verify the SHIPPED graph across four box shapes; budget holds ~1 MP, aspect follows the box
- [ ] Refresh the two docs that carry the now-false "safe on this slot" reasoning — PROPOSED, needs approval
- [ ] Fabio's own run in the app: box a head that runs off the frame edge, confirm the crop
