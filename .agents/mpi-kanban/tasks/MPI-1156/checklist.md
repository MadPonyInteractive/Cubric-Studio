# MPI-1156 checklist

- [x] Phase 1 - map every config source -> where userWords gets set
- [x] Phase 2 - gate core: userWords + ctx.minorAge / pictureMinor / revealingRef in childSafety.js
- [x] Phase 3 - set userWords at every edge
- [x] Phase 4 - cached verdicts: pictures, clips (3 frames), Clothes reference
- [x] Phase 4b (Fabio 2026-10-16) - under-16 kids-at-play swimwear opening (stills only) + animation lock
- [x] Phase 4c (Fabio 2026-10-19) - controllers judged by what the model gets: control Pose by the words, Depth/Scribble/Canny by the map (`controlMapDescribe`), Video Edit Swap the person (whole) never looks at the clip; edits judged on their own look (no inherited YES). Bench: scratchpad, numbers in docs § Measured
- [x] Phase 5 (2026-10-19) - picture age guess (20+ clears, 006566d9a), map questions benched and left strict, docs/child-safety.md + Fabio's eye test PASSED (2.1 release held on this: control Pose / Depth on an adult photo + nude prompt, Video Edit Swap the person with his own clip)
