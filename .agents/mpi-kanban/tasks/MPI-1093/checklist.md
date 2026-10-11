# MPI-1093 checklist

- [ ] Drop `url`/`mirrorUrl` from the six group-2 dep entries (MPI-698 shape, old URLs kept as comments)
- [ ] Tests that touch DEPS pass
- [ ] Commit + push, CI green
- [ ] R2: delete all 7 keys, verify with `rclone lsl`
- [ ] Re-run `research/r2_audit.py`: none of the 7 listed
