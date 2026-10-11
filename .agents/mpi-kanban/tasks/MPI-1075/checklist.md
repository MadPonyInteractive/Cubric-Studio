# MPI-1075 checklist

- [x] Find where the RunPod console reads image-pull progress / system logs, and whether our API key can read it
- [x] Compare the signal on a dead Pod vs a healthy boot (and a cached-image boot)
- [x] Decide the early-delete rule (60 s, no system line since startedAt, fail open)
- [x] Implement beside STALL_CAP_MS in routes/remotePodLifecycle.js
- [x] Test + docs
