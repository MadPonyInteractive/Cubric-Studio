# MPI-959 checklist

Derived from the MPI-962 plan, Parallel Batch 1 (2026-09-29, session 1afba052).

- [x] Unit test first: ramp image, orientation 6 and 8 (crop, both composites, import bake) - red before the fix (10 of 11 failed)
- [x] Auto-orient every server consumer of canvas / engine coordinates (crop, composite x2, agent describe crop/box/size, llm describe, view_card size, GIF from stills, save-generation probe, agent image size)
- [x] Bake orientation on import (upload route + staged assets) - lands upright, orientation 1
- [x] The four "why it fails" cases checked (validation.md)
- [x] crop-resize-output.spec.js gains an orientation-6 source; it and stack-crop.spec.js green on an isolated app
- [x] CI green on the code commit (28547517d, run 36574135426: unit + desktop 1-4)
- [x] Fabio crops Big Photos Test Media/imported_001.jpg (single card + stack) - both upright, 2026-09-29
