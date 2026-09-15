# MPI-762 checklist

- [x] Backend: `client.updateVolume` + `PATCH /runpod/volumes/:id` with size validation
- [x] Test: `tests/runpod-volume-update.test.cjs`
- [x] UI: size field + Update button + confirm under the volume badge
- [x] Docs: `docs/runpod-remote-engine.md` section 5 bullet
- [x] Isolated-app check of the row
- [x] User live check: grow a volume from the app (70 GB, 2026-09-15)
