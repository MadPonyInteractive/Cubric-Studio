# MPI-820 Checklist

- [x] `duration` in NAMED_PARAM_KEYS + the generationControls resolver
- [x] H3 grid snapping reported back, so the answer says what the run ACTUALLY gets
      (`effectiveDuration`; the result carries `durationSeconds` + `frames`)
- [x] the out-of-trained-range case decided: REPORT, never refuse. `inTrainedRange` is
      computed and a 2 s clip still runs - refusing would block a legitimate short clip,
      and the agent now picks the length anyway
- [x] `namedParamsFor` advertises it as a RANGE, so `describe_model` offers it
- [x] the agent is told to judge length from the action it described (Fabio, 2026-09-19)
- [x] cubric-vision-generate skill updated
- [x] Fabio's own pass in the app: ask for a long action, get a long clip (2026-09-19, both
      halves, his words in `validation.md`)
