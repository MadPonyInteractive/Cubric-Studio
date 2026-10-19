# MPI-1206 Checklist

- [x] Root cause from the install-d log: two `/comfy/start` calls 1.2 s apart both passed the already-running check during the pip pass.
- [x] `/comfy/start` runs one start at a time (`_oneStartAtATime`, routes/comfy.js).
- [x] Unit test `tests/comfy-start-single-flight.test.cjs`; `npm test` 3424/0.
- [x] CI green on the commit: Tests run 39306413245 on d20daa9c3 (first attempt red on an unrelated upload-cancel ECONNRESET flake, re-run all green).
- [x] App-level proof on build b60ed53033cc (install e): engine moved at launch, one start, one pip pass, first picture renders.
- [x] Ship: Fabio took it into 2.1.1 (re-cut 3), notes line approved (hash acab3e0b, b60ed5303).
- [ ] 2.1.1 published.
