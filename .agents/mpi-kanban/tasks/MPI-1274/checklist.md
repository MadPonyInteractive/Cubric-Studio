# MPI-1274 checklist

- [x] `/engine/repair-python-deps` re-fetches every node pack that failed to import, at its pinned commit
- [x] It waits for the killed engine to exit before wiping (Windows file locks)
- [x] The drifted-folder pre-wipe in `_installOutstandingUwDeps` and this share one helper
- [x] A pack name with no DEPS entry is left alone (logged)
- [x] Tests: the failed pack is wiped and reinstalled; a healthy engine reinstalls nothing
- [x] `docs/comfy.md` says what Repair engine does now
