# MPI-1213 checklist

- [x] Pin the submodule commit the node's tree names (Coyote-A@2322caa4) in node_lock.json
- [x] Pin the submodule archive sha256 (GitHub archive; R2 dropped: nodes stay on github.com, MPI-427)
- [x] nodesDeps: the dep downloads that archive, sha256-checked
- [x] Drift check: an empty submodule folder counts as drift, so 2.1.1 installs heal on boot
- [x] Devkit installs the same archive
- [ ] Pod: NOT done, the wrapper still lets the pack fetch master at import (follow-up proposed)
- [x] Test: lock, dep and drift check; CI green
- [x] Live: fresh extract has a non-empty repositories/ultimate_sd_upscale, node imports with no fetch
