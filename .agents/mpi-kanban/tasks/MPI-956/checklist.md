# MPI-956 checklist

- [x] Compare "after" media drawn on its own stack canvas at its NATIVE resolution (clamped to MAX_TEXTURE_SIZE), not into the before image's overlay grid
- [x] Slider clip applied to that canvas; pan/zoom/slider still line up
- [x] Video "after" still repaints per frame
- [x] Verified live: 1K first + 8K second keeps 8K detail when zoomed (and the reverse order)
