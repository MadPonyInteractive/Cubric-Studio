# MPI-1216 checklist

- [x] Generator keeps picture 1's size on edits (Custom size off, no mask), capped at the 4K area
- [x] Unit test: size math + wiring in the generated flux3_t2i.json
- [x] Bench: 768x1376 -> 768x1376, 752x1360 -> 752x1360, 3350x6000 -> 2192x3936 capped
- [x] Part 2 masked box: Fabio decided NO (boxes stay layout; Mask edit is the tool)
