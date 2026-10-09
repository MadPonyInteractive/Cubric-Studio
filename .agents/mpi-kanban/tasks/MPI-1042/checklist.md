# MPI-1042 checklist

- [x] Bench graph (v2: Klein two samplings + Qwen one sampling, proven 2026-10-08, validation batch 17)
- [x] Body mode (batches 18-23, Fabio "1" 2026-10-08: describer clothing caption + Klein NSFW LoRA; body users -> Qwen)
- [x] Bench risks (risk 4, a haircut in the user text: the asked haircut won 8 of 8, batch 24)
- [x] Wire the Flow (code + graphs + tests; batch 25 pixel-identical to the approved sheets)
- [x] Fabio's in-app eye-test (verify mode user-ux) - 2026-10-09: "The graphics are fine. The workflow works." (Qwen, bikini picture)
- [x] Flow graphics (/mpi-flow-graphics) + release note in UNRELEASED.md (3a5464918; hero live once MPI-1036 adds the `video:` line, message 37d16a28)
