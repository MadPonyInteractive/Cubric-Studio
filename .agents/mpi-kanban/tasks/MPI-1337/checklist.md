# MPI-1337 Checklist

- [x] Confirm nothing needs VideoHelperSuite (workflows, JS, preview hook, Pod, paid Flows)
- [x] Remove it from node_lock.json, nodesDeps.js, the two Wan dependency lists
- [x] compile-node-deps --check + npm test (2 unrelated failures: peer's Video Edit file)
- [x] Every workflow node present on a scratch engine without VHS (replaces the GPU run)
