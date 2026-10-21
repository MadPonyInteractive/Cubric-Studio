# MPI-1216 checklist

- [x] Generator keeps picture 1's size on edits (Custom size off, no mask), capped at the 4K area
- [x] Unit test: size math + wiring in the generated flux3_t2i.json
- [x] Bench: 768x1376 -> 768x1376, 752x1360 -> 752x1360, 3350x6000 -> 2192x3936 capped
- [x] Part 2 masked box: Fabio decided NO (boxes stay layout; Mask edit is the tool)
- [x] Zoom drift measured: shipped creeps (x1.006, -1% after 3), refs at frame size do not
- [x] Picture 1 reaches the model at the output frame's size (`_ref_matches_frame`), refs 2-10 at 1 MP
- [x] Cosmo 8:5 2K box edit: reproduced (scene lost) and fixed; a new ratio still reframes
- [x] Bench every op on the final graph; tests 7/7; npm test green
- [x] Fabio: live check in the app - no zoom (2026-10-21)
- [ ] Colour grade drift on chained Cosmo/MCP edits: measure, fix in the prompt path
