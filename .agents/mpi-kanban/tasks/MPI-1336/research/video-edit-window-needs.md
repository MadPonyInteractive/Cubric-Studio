# What Video Edit (MPI-1335) needs from a window

From the Video Edit session, 2026-10-29. Its own detail: `tasks/MPI-1335/plan.md`,
`tasks/MPI-1335/research/viggle-animate.md`, `docs/playbooks/add-flow/existing-flows/video-edit.md`.

1. **Frame grid.** H3 runs on 17k+5 frames. Pad the last window up (hold last frame, silence on
   audio), render, cut back, so output length == input length exactly.
2. **Audio per window.** Each window gets its frame-aligned slice of source audio; a still lead-in
   gets matching silence. Final mux uses the untouched full-length source audio.
3. **Timing lock.** The Character Swap LoRA keeps source timing (lag 2.27 -> 0.00 frames); a seam
   must not lose it. Lip sync on ONE window (<=5 s) is tested first (MPI-1335 step 2b).
4. **RAM.** Clips over ~10 s needed a rented RTX PRO 6000. Only a window's frames should be
   resident. Viggle warns its chunking still scales with full clip length.

Candidates: MpiWindowedSampler (ComfyUi-MpiNodes sampler.py), Viggle five_frame_anchor with a
disk-checkpointed resumable chunk loop, Motion Context V2 (`motion-context-v2-video.md`).
**Conflict to bench (Video Edit, 2026-10-29):** above 768p Video Edit runs Fast Motion (base pass
at the 768p area -> MpiLatentUpscale -> 3-step MpiWindowedSampler refine), because one pass over
768p ran out of memory at 16 GB. Motion Context says single pass only. If it wins: either cap a
window at the 768p area, or the bench must also check seams through a base+refine chain.

**Fabio's direction (relayed 2026-10-29), supersedes the 768p framing above:**
- Windows of ~5 s, like Viggle (124 frames ~ 5.2 s at 24 fps); works on most cards.
- The 16 GB out-of-memory runs were clips of 10 s or more: LENGTH, not resolution. With 5 s windows
  even 2K may fit on 16 GB. Do not assume a 768p cap; measure per window.
- "Window" = Viggle's meaning: each window's latents saved to disk, one window in memory, a
  cancelled or crashed run resumes.
- Build on the existing MPI-1134 research (`tasks/MPI-1134/research/`), not from scratch.

The three-way bench replaces MPI-1335's own Viggle step; Video Edit tests the winner.
Fabio's earlier plan: bench Viggle-Animate as the windowing study before picking (MPI-1335 step 7);
waits on his credits.
