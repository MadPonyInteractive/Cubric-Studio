# MPI-1196 Checklist

- [x] Cause measured: frame 0 of flowVideoEdit_008 = the picture squeezed to the render's shape
- [x] Fix: nodes 27-29 crop the picture to the render's shape on template 6 (builder, API, raw) - a06a96432
- [x] Validator + 50 workflow tests; CI 39190517743 green on a06a96432
- [x] Fabio's eye test: the picture pre-cropped to 9:16 came out unstretched (flowVideoEdit_009)
- [x] The in-graph crop ran on the bench (W1): clean, not stretched
- [x] Late start split off to its own card (MPI-1197); bench so far in validation.md
