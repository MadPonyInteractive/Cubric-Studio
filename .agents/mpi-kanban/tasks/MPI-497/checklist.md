# MPI-497 Checklist

Fixed under the umbrella MPI-513 (Phase 2), commit `9c593af5f`.

- [x] Re-test against the single writer (MPI-513 Phase 1): both symptoms survived
- [x] Symptom 1: a job with every dep already on disk completes WITHOUT an "installed" toast
- [x] Symptom 2: a finished job expires (TTL belt runs), so it cannot paint a bar on another engine
- [x] Tests red without the fix, green with it; npm test green; CI green
