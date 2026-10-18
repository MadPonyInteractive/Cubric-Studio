# MPI-1178 checklist

- [x] `buildSizeFields` 'aspect': no ratio picked + a source size -> the source's nearest allowed `aspect_ratio`
- [x] A picked ratio / explicit size still wins; t2i with nothing still sends nothing
- [x] `tests/cloud-edit-follows-source.test.cjs` asserts it (was: Nano Banana sends nothing)
- [x] Cloud sizing tests green
