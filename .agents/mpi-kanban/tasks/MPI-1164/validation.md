# MPI-1164 Validation

- Code: 0e46aeb80 (reference clause, REF_NOTE, guides), e5f4f9a00 (look into the prompt as words), docs 9359ef377.
- Offline: agent suites 513/513, flow suites 267/267 (2026-10-17).
- Bench (DeepSeek V4 Flash): angle-picture-goes-to-reference 3/3 with bite; look-grain/grade/light-into-prompt: named quality in the prompt and the photo never sent, every run. Flips not run (spend).
- Eye test, Fabio 2026-10-17, live app: woman-in-bed picture + a reference clip for the camera move -> MiniMax H3 ref2va with the clip as reference, no picture edited; "the camera movement is correct", "the video is fine".
- Known gap, shipped by Fabio's call: a look reference also carries qualities nobody asked for (6/6 grain onto a light ask). Follow-up in MPI-1134 Phase 5b (vision chat model).
