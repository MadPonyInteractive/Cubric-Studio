# MPI-1206 Checklist

- [x] Root cause from the install-d log: two `/comfy/start` calls 1.2 s apart both passed the already-running check during the pip pass.
- [x] `/comfy/start` runs one start at a time (`_oneStartAtATime`, routes/comfy.js).
- [x] Unit test `tests/comfy-start-single-flight.test.cjs`; `npm test` 3424/0.
- [ ] CI green on the commit.
- [ ] App-level proof on a build carrying it (update test: engine moved at launch, one pip pass, first picture renders).
- [ ] Ship: 2.1.1 re-cut 3 or 2.1.2 (Fabio's call), release-notes line.
