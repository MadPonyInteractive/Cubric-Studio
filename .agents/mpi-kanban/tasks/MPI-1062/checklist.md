# MPI-1062 checklist

- [x] map a video mediaItem to its card sidecar thumb
- [x] clip stills joined to the picture check in `_judgeThenQueue` (thumb, else first frame, else refused)
- [x] tests: pure listing + live module (wait, refuse on YES / no still, innocent clip untouched)
- [x] docs/child-safety.md updated, clip gap replaced by the frame-0 gap
- [x] release-notes wording: Fabio said yes to "a picture or clip" (2026-10-10); applied
- [x] CI green (run 38076045694), card closed

## Phase 2 (reopened 2026-10-10)

- [x] layer 1: non-Latin nudity/undress word list (CJK regex without boundaries)
- [x] layer 2: NUDITY_SYSTEM question on the judge backend, fail closed
- [x] `_judgeThenQueue`: look only on a list hit or a non-NO answer
- [x] tests: CJK + Russian hits, innocent Japanese edit on a child queued, injection still looked at
- [x] docs/child-safety.md: the two layers + known gaps
- [x] live check (safe triggers only), CI green (run 38085217411), card closed
