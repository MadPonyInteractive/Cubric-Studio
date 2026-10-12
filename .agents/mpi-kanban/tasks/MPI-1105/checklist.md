# MPI-1105 checklist

Reopened 2026-10-12: the earlier "dropped" close was a misreading. Fabio, restated: a job added
to the queue flashes a gradient strip on the right edge, the queue panel's height, ~100 px wide,
coloured by the job's subject (image rose, video orange, audio green), 3 flashes over ~3 s, with
an "Open queue" button.

- [ ] `MpiQueueFlash` component (Compound): strip + Open queue button, BEM, tokens only
- [ ] Event `queue:added` { mediaType } from `runCpuJob` (non-GPU) and `enqueueGeneration` (GPU)
- [ ] Skipped while the Cue panel is already open
- [ ] Open queue opens the Cue slide-over from any page (projects page included)
- [ ] Mounted once in the shell
- [ ] Registration: `preloadStyles.js` line (MPI-1101 claims it) + `types.js` props (MPI-623 claims it), when released
- [ ] Desktop spec
- [ ] Fabio's eye test
