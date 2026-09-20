# MPI-851 Checklist

- [x] `provider` on the ModelDef + the first cloud model
- [x] The third `cloud` lane
- [x] cloudExecutor + the DeepInfra route
- [x] The install gates read a KEY, not a dep
- [x] The save path: real bytes, real extension, true cost in the sidecar
- [x] `npm test` green (1618 pass, 0 fail)
- [x] The live check in the user's own app — one real generation (verified 2026-09-20)
- [x] Batch of four on the provider's `num_images`, one call and one bill
- [ ] One live batch of four (~$0.002), and the keyless bail
