# MPI-1213 checklist

- [ ] Pin the submodule commit the node's tree names (Coyote-A@2322caa4) in node_lock.json
- [ ] Build the node archive with the submodule inside, upload to R2, pin its sha256
- [ ] nodesDeps: the dep downloads that archive, sha256-checked
- [ ] Drift check: an empty submodule folder counts as drift, so 2.1.1 installs heal on boot
- [ ] Devkit installs the same archive
- [ ] Pod: wrapper volume-installs from the dep url, so it gets the same archive (no wrapper change)
- [ ] Test: lock, dep and drift check; CI green
- [ ] Live: fresh extract has a non-empty repositories/ultimate_sd_upscale, node imports with no fetch
