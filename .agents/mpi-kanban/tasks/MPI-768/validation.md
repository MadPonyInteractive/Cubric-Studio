# MPI-768 Validation

## 2026-09-15 - MPI-757 Batch 1, verified by the orchestrator

Worker report re-checked on disk and re-run, not accepted as-is.

| Check | Command | Result |
|---|---|---|
| Frames store tests | `node --test "tests/gif-frames.test.cjs"` | 9/9 pass (orchestrator re-run) |
| Full node suite | `node --test "tests/*.test.cjs"` | 1090 tests: 1089 pass, 0 fail, 1 skipped (pre-existing) |
| Bite checks (worker) | skip the GCE patch in `buildGif`; make `sweepGifFrames` ignore archived sidecars | each went RED, restored, green |

The 9 tests cover: exact delays (independent block walk + sharp read-back), delay floor 0/1 -> 2,
extract round trip on a variable-delay GIF, dedup, sweep keeps an archived reference and frees an
orphan, no-op sweep for a project with no GIF, Update mints a new `.gif` name and removes the old one
(E5), legacy `.gif` extracts lazily via `POST /gif/ensure-frames`, add-from-cards copies frames + thumbs.

Orchestrator review:
- `DELETE /project-media/:projectId/:filename` removes the sidecar BEFORE `sweepGifFrames`, so the
  deleted GIF's own frames are freed.
- `server.js` mount lines sit apart from MPI-774's uncommitted `agentRoutes` lines: commit by hunk.
- Frame and thumb URLs ride the existing `/project-file` route; no dedicated serve route (E3 drift).
- Open for MPI-772: `output.edgeColour: null` = opaque build with no explicit alpha flatten. Frames with
  transparent pixels (Make GIF padding, cut-out) must flatten onto a chosen background, never drop
  alpha (memory `tools/image-alpha-flatten.md`). Pin it with a pixel assertion.
- Sweep reads every sidecar on each delete in a project that has `.gif-frames`; fine for v1.
