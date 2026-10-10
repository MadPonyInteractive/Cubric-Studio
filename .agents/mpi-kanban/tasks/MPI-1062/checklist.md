# MPI-1062 checklist

- [x] map a video mediaItem to its card sidecar thumb
- [x] clip stills joined to the picture check in `_judgeThenQueue` (thumb, else first frame, else refused)
- [x] tests: pure listing + live module (wait, refuse on YES / no still, innocent clip untouched)
- [x] docs/child-safety.md updated, clip gap replaced by the frame-0 gap
- [x] release-notes wording: Fabio said yes to "a picture or clip" (2026-10-10); applied
- [ ] CI green, card closed
