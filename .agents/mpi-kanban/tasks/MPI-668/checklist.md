# MPI-668 - checklist

**RESHAPED 2026-10-01 (Fabio: yes, IN for 2.0, under MPI-894 / MPI-595).** The real hole for a
released user is not "core vs node_lock" but the SAVED Pod: `/remote/pod/reconnect` warm-resumes
the Pod the user created under the OLD app (`startPod(savedPodId)`), and a Pod keeps the image it
was created on. A 1.5.0 user who updates to 2.0 and presses Connect gets the 1.5.0 image back, and
2.0's graphs reject mid-generation. The only warning today ("Pod image is stale - rebuild needed",
MPI-222 baked-node drift) names a fix a user cannot do.

The fix: on reconnect, read the Pod's image from RunPod (`getPod` -> v2 `image`, v1 `imageName`)
and compare it to `podImageForCard(gpuTypeId)` - the exact tag this app would create with. Differs
-> skip the warm resume, delete + create fresh on the current image (the existing failed-resume
path; the network volume keeps the models). Unreadable -> resume as before (fail OPEN). This
covers dev builds too (the 2026-08-31 incident was a dev Pod on an old dev tag).

The original design notes (core version via `/system_stats`, `dev_mode`-only 8188) are in git
history; the image tag is the same signal without a Pod round trip, and it has no false positive.

- [x] `_isPodImageStale(pod, want)` pure + route test in `tests/runpod-remote-hardening.test.cjs`
- [x] reconnect: stale image -> delete + create fresh; unreadable -> warm resume (fail open)
- [x] `docs/runpod-remote-engine.md` line on the reconnect rule
- [ ] Live leg: folded into MPI-595 B3 at the cut (a real 1.5.0 Pod, then the 2.0 update, then Connect); pennies, Fabio's yes there;
  confirms v2 GET `/pods/{id}` returns `image`
