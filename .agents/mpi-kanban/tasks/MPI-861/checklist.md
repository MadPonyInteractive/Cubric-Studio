# MPI-861 checklist

- [x] Resolve WHICH test failed - the error-context header said :402 while the source window showed :352-366
- [x] Prove the race deterministically (delay the reverse reload, expect the same `Expected: true, Received: false`)
- [x] Fix: the spec waits for the post-condition it triggered, not for the request
- [x] Prove the fix red on the unfixed shape and green on the fixed one
- [x] Re-run gif-cutout.spec.js + gif-workspace.spec.js together, repeatedly, all green
