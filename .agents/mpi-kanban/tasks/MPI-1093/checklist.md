# MPI-1093 checklist

- [x] Drop `url`/`mirrorUrl` from the six group-2 dep entries (MPI-698 shape, old URLs kept as comments)
- [x] Tests that touch DEPS pass (full suite: 3125 pass, 0 fail)
- [x] Commit + push (4174c7354), CI green
- [x] R2: delete all 7 keys, verify with `rclone lsl`
- [x] Re-run `research/r2_audit.py`: none of the 7 listed
