# MPI-1267 UMBRELLA: LTX 2.5 release

"LTX 2.5" is the release's name, not a version number: bug-fix releases may ship from master first,
and none of them removes a gate. Everything here is dev-gated until that release; the gates come off
together. Rewritten short 2026-10-29 (Fabio): Storyboard and Multi-angle are out of scope for now.

## Members

| Card | What | Session (2026-10-29) |
|---|---|---|
| MPI-1319 | **First.** Small delta updates; a skipped version gets a full-download button | not started |
| MPI-1336 | **The main one.** Infinite Video: chain MiniMax H3 windows past one clip's length | Infinite video 1 |
| MPI-1335 | Video Edit: lip sync (soundtrack into H3), short clips, lost tails | Video Edit Flow Issues 3 |
| MPI-1331 | Video Edit: the masked square never upscales the source (masking goes last) | Video Edit Flow Issues 3 |
| MPI-1348 | New H3 upscaler: NVIDIA Open-H3-Regenerate-2K. Bench, then wire into MiniMax H3 (Fabio expects it beats ours). H3 only | New H3 Upscaler 1 |
| MPI-578 | Upscale Video Flow: test LTX 2.5 tile upscale (Refine + Restore, tiled Native Resolution), add it + the MiniMax H3 upscaler. Joined 2026-10-29 from MPI-1179; MPI-688 (H3) merged in 2026-10-29 | doing |
| MPI-1266 | LTX 2.5 Stage 2: 2.5 in the LTX Flows, then `devOnly` off on `ltx-25` | not started |
| MPI-1185 | PiD 1.5: replaces `nvidia-pid` if it wins its bench | not started |
| MPI-1299 | Draw It In: fix the seams, bench FLUX.3 / Qwen-Image 2.1 vs Klein 9B (2.1.3 is out: unblocked) | not started |

## Release

1. MPI-1319 lands first; the release that carries it still ships a full bundle (see the card).
2. Every member done.
3. Its UNRELEASED entries, then ALL gates off in one change.

Closes when the last member does; `validation.md` records the release and that every gate came off.

**Verify mode:** user-ux
