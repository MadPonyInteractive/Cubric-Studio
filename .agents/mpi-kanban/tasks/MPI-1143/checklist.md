# MPI-1143 checklist

- [x] MpiCompareView.open() stops quietly (returns false) when destroyed mid-load, both callers covered (MpiBaseFlow result pane, MpiCompareOverlay)
- [x] Desktop spec: a delayed image, destroy mid-load, no "failed to load the compare pair" error, open() resolves false
- [x] Spec fails on the old code, passes on the new
