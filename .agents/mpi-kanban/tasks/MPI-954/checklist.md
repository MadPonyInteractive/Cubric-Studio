# MPI-954 checklist

- [x] Root cause re-read: which applier runs on 1.x -> 2.0 (the installed 1.5.0 one), which launcher is running at that moment, per platform and per path (in-app vs update-from-zip)
- [x] A 2.0-side fix that holds for the INSTALLED 1.5.0 applier and launchers (nothing on the user's disk can change before the hop)
- [x] The 2.0 applier fixed at the root for later hops (no in-place truncating write of a file that may be executing)
- [x] Local proof: real stageUpdateBundle + real heal under test, mutation-checked (the POSIX before/after shell repro is skipped on Windows: it is the Linux-box step below)
- [x] Linux box re-run of the A/B kit through update.sh against a real 2.0 bundle (Fabio turns the box on)
