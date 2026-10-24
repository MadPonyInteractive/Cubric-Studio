# MPI-1279 validation

Live (2026-10-24 log): two photo edits went to `klein-9b:kleinEdit` (rank 3), then `qwen-edit`
(rank 7), past `qwen-image-2-1:edit` (rank 1) and `flux3-klein:edit` (rank 2). The fit check run
offline for that PC (RTX 4060 Ti 16 GB, 64 GB RAM) reads every edit model as runnable, so
`best: true` was not the cause. The Model rule lets an op whose note matches the ask beat the
rank, and the notes did the steering:

| Note | Before | Now |
|---|---|---|
| `klein-9b:kleinEdit` | "follows the instruction and keeps the likeness" | "edits in place, but tends to cover a bare subject ..." |
| `qwen-image-2-1:edit` | ends "Research or evaluation use only: the images are not for commercial use" | "Its licence is research or evaluation only: say so when the user mentions selling or client work" |
| `flux3-klein:edit` | "takes up to ten images in one edit" | "edits one picture, or up to ten in one edit" |
| Boogu one-image note | fallback list "Qwen-Image 2.1, else kleinEdit, ..." (no FLUX.3) | "Qwen-Image 2.1, else the FLUX.3 Klein edit, else kleinEdit, ..." |

Evidence: `tests/edit-rank-decides.test.cjs` (4 tests) and `tests/model-priority.test.cjs`
pass; `npm run lint` clean; `npm test` 3,599 tests, 0 fail; pre-push green; CI Tests run
40126193744 green on the tip that contains `18379ccc0` (a peer's push superseded its own run).

Not run: a live Cosmo edit, and the agent bench (paid or local-GPU LLM calls).
