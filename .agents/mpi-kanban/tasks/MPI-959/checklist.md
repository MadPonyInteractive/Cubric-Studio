# MPI-959 checklist

Derived from the MPI-962 plan, Parallel Batch 1 (2026-09-29, session 1afba052).

- [ ] Unit test first: ramp image, orientation 6 and 8 (crop, both composites, import bake) - red before the fix
- [ ] Auto-orient every server consumer of canvas / engine coordinates (crop, composite x2, agent describe crop/box/size, llm describe, view_card size, GIF from stills, save-generation probe)
- [ ] Bake orientation on import (upload route + staged assets) - lands upright, orientation 1
- [ ] The four "why it fails" cases checked on real files (HEIC, PNG eXIf, stale tag, tag 1 on sideways pixels)
- [ ] crop-resize-output.spec.js gains an orientation-6 source; it and stack-crop.spec.js green on an isolated app
- [ ] CI green on the code commit
- [ ] Fabio crops Big Photos Test Media/imported_001.jpg (single card + stack)
