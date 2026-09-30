# MPI-923 Checklist

- [x] `ref2v` op + `i2v` end-frame slot (commandRegistry, both op registries)
- [x] `wan3-cloud` declares `ref2v`, end frame, audio slots
- [x] cloudExecutor sends slot-typed media; route builds Wan's `media` list
- [x] Unit test on the media list shape
- [x] Live run: ref2v, 480p 5 s (billed $0.595: ref video seconds bill; quote fixed)
- [ ] Live run: i2v with end frame, 480p 5 s ($0.25) - needs Fabio's fresh yes
- [x] docs/cloud-generation.md
